import { TreeCursor } from '@lezer/common';
import { parser } from '@lezer/python';
import { assert } from 'console';
import { TypedVar, Stmt, Expr, Type, isOp, isUnOp, CondBody, VarDef, MemberExpr, isCls, ScopeVar } from './ast';
import { FunDef, Program, Literal, LValue, ClsDef, isValidIdentifier } from './ast';
import { ParseError } from './error';

function isDecl(t: TreeCursor, s: string) {
  if (t.type.name === "FunctionDefinition" || 
    t.type.name === "ClassDefinition" ||
    t.type.name === "ScopeStatement") {
    return t.type.name;
  }
  else if (t.type.name === "AssignStatement") {
    t.firstChild();
    t.nextSibling();
    const name = t.type.name;
    t.parent();
    // @ts-ignore
    if (name !== "TypeDef")
      return false;
    return t.type.name;
  }
  return false;
}

export function parseProgram(source: string): Program<any> {
  const t = parser.parse(source).cursor();
  var vardefs: VarDef<any>[] = [];
  var fundefs: FunDef<any>[] = [];
  var clsdefs: ClsDef<any>[] = [];
  var stmts: Stmt<any>[] = [];

  traverseProgram(t, source, vardefs, fundefs, clsdefs, stmts);
  return { vardefs, fundefs, clsdefs, stmts }
}

export function traverseProgram(t: TreeCursor, s: string,
  vardefs: VarDef<any>[], fundefs: FunDef<any>[], clsdefs: ClsDef<any>[],
  stmts: Stmt<any>[]) {
  // The top node in the program is a Script node with a list of children
  // that are various statements
  switch (t.node.type.name) {
    case "Script":
      const idSet = new Set();
      if (!t.firstChild()) {//in case of empty program
        t.parent();
        return;
      }

      while (true) {
        const decl = isDecl(t, s);
        if (decl === "AssignStatement") {
          vardefs.push(traverseVarDef(t, s, idSet));
        } else if (decl === "FunctionDefinition") {
          fundefs.push(traverseFunDef(t, s, idSet));
        } else if (decl === "ClassDefinition") {
          clsdefs.push(traverseClsDef(t, s, idSet));
        } else {
          break;
        }
        if (!t.nextSibling()) {
          // All definitions
          t.parent();
          return;
        }
      }

      do {
        // if (isVarDecl(c, s) || isFunDef(c, s) || isClassDecl(t, s))
        //   throw new Error("PARSER ERROR: variable and function declaration must come before the body");
        stmts.push(traverseStmt(t, s));
      } while (t.nextSibling())
      break;

    default:
      throw new ParseError("Could not parse program at " + t.node.from + " " + t.node.to);
  }
}

export function traverseVarDef(t: TreeCursor, s: string, idSet: Set<any>): VarDef<any> {
  t.firstChild(); // focused on name (the first child)
  var name = s.substring(t.from, t.to);
  if (!isValidIdentifier(name)) {
    throw new Error(`Invalid identifier: ${name}`);
  } else if (idSet.has(name)) {
    throw new Error(`Duplicate declaration of identifier ` +
      `in the same scope: ${name}`);
  } else {
    idSet.add(name);
  }
  t.nextSibling(); // must be Typedef
  t.firstChild(); // focus on :
  t.nextSibling(); // focus on type
  var typ: Type = traverseType(t, s);
  t.parent();
  t.nextSibling(); // focus on = sign
  t.nextSibling(); // focused on the literal expression
  var init = traverseLit(t, s);
  t.parent();
  return {
    typedvar: { name, typ },
    init
  };
}


export function traverseFunDef(t: TreeCursor, s: string, idSet: Set<any>): FunDef<any> {
  t.firstChild();  // Focus on def
  t.nextSibling(); // Focus on name of function
  var name = s.substring(t.from, t.to);
  if (!isValidIdentifier(name)) {
    throw new Error(`Invalid identifier: ${name}`);
  } else if (idSet.has(name)) {
    throw new Error(`Duplicate declaration of identifier ` +
      `in the same scope: ${name}`);
  } else {
    idSet.add(name);
  }
  t.nextSibling(); // Focus on ParamList
  var curIdSet = new Set();
  var params = traverseParameters(t, s, curIdSet);
  t.nextSibling(); // Focus on Body or TypeDef
  var ret: Type = { tag: "none"};
  var maybeTD = t;
  if (maybeTD.type.name === "TypeDef") {
    t.firstChild();
    ret = traverseType(t, s);
    t.parent();
  }
  t.nextSibling(); // Focus on Body

  const [localvar, localfun, decls, body] = traverseFuncBody(t, s, curIdSet);
  t.parent();      // Pop to FunctionDefinition
  return {
    name, params, ret,
    body: { vardefs: localvar, fundefs: localfun, decls, stmts: body }
  };
}


export function traverseClsDef(t: TreeCursor, s: string, idSet: Set<any>): ClsDef<any> {
  t.firstChild(); // focus on class
  t.nextSibling(); // focus on class name
  var name = s.substring(t.from, t.to);
  if (!isValidIdentifier(name)) {
    throw new Error(`Invalid identifier: ${name}`);
  } else if (idSet.has(name)) {
    throw new Error(`Duplicate declaration of identifier ` +
      `in the same scope: ${name}`);
  } else {
    idSet.add(name);
  }
  var curIdSet = new Set();
  t.nextSibling(); // focus on father object (ArgList)
  t.firstChild(); // (
  t.nextSibling(); 
  const superName = s.substring(t.from, t.to);
  t.parent();
  t.nextSibling(); // focus on body

  const [fields, methods] = traverseClsBody(t, s, curIdSet);
  t.parent();
  return {
    tag: "class", name, super: superName, 
    methods, fields
  };
}

export function traverseFuncBody(t: TreeCursor, s: string, idSet: Set<any>):
  [VarDef<any>[], FunDef<any>[], ScopeVar<any>[], Stmt<any>[]] {
  switch (t.node.type.name) {
    case "Body":  // function body
      let vardefs: VarDef<any>[] = [];
      let fundefs: FunDef<any>[] = [];
      let decls: ScopeVar<any>[] = [];
      let stmts: Stmt<any>[] = []; 
      t.firstChild(); //focus on semicolon
      // if (!t.nextSibling()) { //in case of empty program
      //   t.parent();
      // }
      t.nextSibling();
      while (true) {
        const decl = isDecl(t, s);
        if (decl === "AssignStatement") {
          vardefs.push(traverseVarDef(t, s, idSet));
        } else if (decl === "FunctionDefinition") {
          fundefs.push(traverseFunDef(t, s, idSet));
          // throw new Error("nested function not supported");
        } else if (decl === "ScopeStatement") {
          decls.push(traverseDecl(t, s, idSet));
        } else {
          break;
        }
        if (!t.nextSibling()){
          // All definitions
          t.parent();
          return;
        }
      }

      do {
        // if (isVarDecl(c, s) || isFunDef(c, s) || isClassDecl(t, s))
        //   throw new Error("PARSER ERROR: variable and function declaration must come before the body");
        if (t.type.name.search("Statement") !== -1)
          stmts.push(traverseStmt(t, s));
      } while (t.nextSibling())
      t.parent();
      return [vardefs, fundefs, decls, stmts];
  }
}

export function traverseDecl(t: TreeCursor, s: string, idSet: Set<any>) {
  t.firstChild();
  if (t.name !== "global" && t.name !== "nonlocal") {
    throw new Error(`Wrong scope identifier: ${t.name}`);
  }
  const nonlocal:boolean = t.name === "nonlocal";
  t.nextSibling();
  const name = s.substring(t.from, t.to);
  if (!isValidIdentifier(name)) {
    throw new Error(`Invalid identifier: ${name}`);
  } else if (idSet.has(name)) {
    throw new Error(`Duplicate declaration of identifier ` +
      `in the same scope: ${name}`);
  } else {
    idSet.add(name);
  }
  t.parent();
  return { name, nonlocal };
}

export function traverseClsBody(t: TreeCursor, s: string, idSet: Set<any>):
  [VarDef<any>[], FunDef<any>[]] {
  switch (t.node.type.name) {
    case "Body":  // function body
      let vardefs: VarDef<any>[] = [];
      let fundefs: FunDef<any>[] = [];
      t.firstChild(); //focus on semicolon
      // if (!t.nextSibling()) { //in case of empty program
      //   t.parent();
      // }
      while (t.nextSibling()) {
        const decl = isDecl(t, s);
        if (decl === "AssignStatement") {
          vardefs.push(traverseVarDef(t, s, idSet));
        } else if (decl === "FunctionDefinition") {
          let func = traverseFunDef(t, s, idSet);
          fundefs.push(func);
        } else if (t.type.name !== "PassStatement") {
          // if (t.type.name.search("Statement") !== -1)
          throw new ParseError("Could not parse statement at " +
            t.from + " " + t.to + ": " + s.substring(t.from, t.to));
        }
      }
      t.parent();
      return [vardefs, fundefs];
  }
}

export function traverseStmts(t: TreeCursor, s: string): Stmt<any>[] {
  // The top node in the program is a Script node with a list of children
  // that are various statements
  switch (t.node.type.name) {
    case "Body":
      // focus on Body
      var stmts: Stmt<any>[] = []
      t.firstChild(); // focus on semicolon
      t.nextSibling();
      do {
        if (t.type.name.search("Statement") !== -1)
          stmts.push(traverseStmt(t, s));
      } while (t.nextSibling()); // t.nextSibling() returns false when it reaches
      //  the end of the list of children
      t.parent();
      return stmts;
    default:
      throw new ParseError("Could not parse program at " + t.node.from + " " + t.node.to);
  }
}


/*
  Invariant – t must focus on the same node at the end of the traversal
*/
export function traverseStmt(t: TreeCursor, s: string): Stmt<any> {
  switch (t.type.name) {
    case "ReturnStatement":
      t.firstChild();  // Focus return keyword
      var value: Expr<any>;
      if (t.nextSibling()) // Focus expression
        value = traverseExpr(t, s);
      else
        value = { tag: "literal", value: { tag: "none" } };
      t.parent();
      return { tag: "return", value };
    case "AssignStatement":
      // assign: x = 1
      t.firstChild(); // focused on name (the first child)
      var name = traverseLValue(t, s);
      t.nextSibling(); // focused on = sign. May need this for complex tasks, like +=!
      t.nextSibling(); // focused on the value expression
      var value = traverseExpr(t, s);
      t.parent();
      return { tag: "assign", target: name, value };
      break;
    case "ExpressionStatement":
      t.firstChild(); // The child is some kind of expression, the
      // ExpressionStatement is just a wrapper with no information
      var expr = traverseExpr(t, s);
      t.parent();
      return { tag: "expr", expr: expr };
    case "PassStatement":
      return { tag: "pass" };
    case "IfStatement":
      t.firstChild();  // Focus on if
      let ifstmt = traverseCondBody(t, s);

      let elifstmt: CondBody<any>[] = [];
      let elsestmt: Stmt<any>[] = [];
      t.nextSibling(); // Focus on possible elifs
      while (s.substring(t.from, t.to) === "elif") {
        elifstmt.push(traverseCondBody(t, s));
        t.nextSibling();
      }
      if (s.substring(t.from, t.to) === "else") {
        t.nextSibling(); // Focus on body
        elsestmt = traverseStmts(t, s);
      }
      t.parent();
      return {
        tag: "if",
        ifstmt, elifstmt, elsestmt
      };
    case "WhileStatement":
      t.firstChild();  // Focus on while
      let whilestmt = traverseCondBody(t, s);
      t.parent();
      return { tag: "while", whilestmt };
    default:
      throw new ParseError("Could not parse statement at " +
        t.from + " " + t.to + ": " + s.substring(t.from, t.to));
  }
}

export function traverseMemberExpr(t:TreeCursor, s:string): MemberExpr<any> {
  t.firstChild(); // member expr or variable
  const obj = traverseExpr(t, s);
  t.nextSibling(); // dot
  t.nextSibling(); // PropertyName
  const field = s.substring(t.from, t.to);
  t.parent();
  return { tag: "getfield", obj, field };
}

export function traverseLValue(t: TreeCursor, s: string): LValue <any> {
  switch(t.type.name) {
    case "VariableName":
      return { tag: "id", name: s.substring(t.from, t.to) };
    case "MemberExpression":
      return traverseMemberExpr(t, s);
    default:
      throw new ParseError("Could not parse expr at " +
        t.from + " " + t.to + ": " + s.substring(t.from, t.to));
  }
}

export function traverseType(t: TreeCursor, s: string): Type {
  switch (t.type.name) {
    case "VariableName":
      const name = s.substring(t.from, t.to);
      // return name;
      if (name === "int" || name === "bool" || name === "none") {
        return { tag: name };
      } else {
        return { tag: "object", class: name };
      }
    default:
      throw new Error("Unknown type: " + t.type.name);

  }
}

export function traverseParameters(t: TreeCursor, s: string, idSet: Set<any>): TypedVar[] {
  t.firstChild();  // Focuses on open paren
  const parameters = [];
  t.nextSibling(); // Focuses on a VariableName
  while (t.type.name !== ")") {
    let name = s.substring(t.from, t.to);
    t.nextSibling(); // Focuses on "TypeDef", hopefully, or "," if mistake
    let nextTagName = t.type.name; // NOTE(joe): a bit of a hack so the next line doesn't if-split
    if (nextTagName !== "TypeDef") {
      throw new Error("Missed type annotation for parameter " + name)
    };
    if (!isValidIdentifier(name)) {
      throw new Error(`Invalid identifier: ${name}`);
    } else if (idSet.has(name)) {
      throw new Error(`Duplicate declaration of identifier ` +
        `in the same scope: ${name}`);
    } else {
      idSet.add(name);
    }
    t.firstChild();  // Enter TypeDef, foucs on semicolon
    t.nextSibling(); // Focuses on type itself
    let typ = traverseType(t, s);
    t.parent();
    t.nextSibling(); // Move on to comma or ")"
    parameters.push({ name, typ });
    t.nextSibling(); // Focuses on a VariableName
  }
  t.parent();       // Pop to ParamList
  return parameters;
}

export function traverseLit(t: TreeCursor, s: string): Literal<any> {
  switch (t.type.name) {
    case "Boolean":
      if (s.substring(t.from, t.to) === "True")
        return { tag: "bool", value: true };
      else
        return { tag: "bool", value: false };
    case "Number":
      return { tag: "number", value: Number(s.substring(t.from, t.to)) };
    case "None":
      return { tag: "none" };
    default:
      throw new ParseError(`Not a literal: ${t.type.name}`);
  }
}

export function traverseExpr(t: TreeCursor, s: string): Expr<any> {
  switch (t.type.name) {
    case "Boolean":
    case "Number":
    case "None":
      return { tag: "literal", value: traverseLit(t, s) };
    case "VariableName":
    case "self":
    case "PropertyName":
      return { tag: "id", name: s.substring(t.from, t.to) };
    case "CallExpression":
      t.firstChild(); // Focus name
      let node = t;
      if (node.type.name === "VariableName") {
        var name = s.substring(t.from, t.to);
        t.nextSibling(); // Focus ArgList
        // t.firstChild(); // Focus open paren
        var args = traverseArguments(t, s);
        var result: Expr<any> = { tag: "call", name, args };
        t.parent();
        return result;
      }
      else if (node.type.name === "MemberExpression") {
        t.firstChild(); // VariableName
        var obj = traverseExpr(t, s);
        t.nextSibling(); // dot
        t.nextSibling(); // PropertyName
        var name = s.substring(t.from, t.to);
        t.parent();
        t.nextSibling(); // ArgList
        var args = traverseArguments(t, s);
        var result: Expr<any> = { tag: "method", obj, name, args };
        t.parent();
        return result;
      }
      break;

    case "BinaryExpression":
      t.firstChild(); // go to lhs
      const lhsExpr = traverseExpr(t, s);
      t.nextSibling(); // go to op
      var opStr = s.substring(t.from, t.to);
      if (!isOp(opStr)) {
        throw new Error(`Unknown or unhandled op: ${opStr}`);
      }
      t.nextSibling(); // go to rhs
      const rhsExpr = traverseExpr(t, s);
      t.parent();
      return {
        tag: "binop", op: opStr,
        lhs: lhsExpr, rhs: rhsExpr
      };
    case "UnaryExpression":
      t.firstChild();
      var uop = s.substring(t.from, t.to);
      if (!isUnOp(uop)) {
        throw new Error(`Unknown or unhandled op: ${uop}`);
      }
      t.nextSibling(); // go to right arg
      const uarg = traverseExpr(t, s);
      t.parent();
      return { tag: "unop", op: uop, expr: uarg };
    case "ParenthesizedExpression":
      t.firstChild(); //focus on (
      t.nextSibling();
      const insideExpr = traverseExpr(t, s);
      t.nextSibling();
      const maybeParen = t;
      if (maybeParen.type.name !== ")")
        throw new ParseError("Could not parse expr at " +
          t.from + " " + t.to + ": " + s.substring(t.from, t.to));
      t.parent();
      return insideExpr;
    case "MemberExpression":
      return traverseMemberExpr(t, s);
    default:
      throw new ParseError("Could not parse expr at " +
        t.from + " " + t.to + ": " + s.substring(t.from, t.to));
  }
}

export function traverseCondBody(t: TreeCursor, s: string): CondBody<any> {
  //focus on if or elif or while etc
  t.nextSibling(); //focus on condition
  let cond = traverseExpr(t, s);
  t.nextSibling(); // focuse on body
  let body = traverseStmts(t, s);
  return { cond, body };
}

export function traverseArguments(t: TreeCursor, s: string): Expr<any>[] {
  // c is the subtree of the arglist
  const args = [];
  t.firstChild(); // Focuses on open paren
  while (t.nextSibling()) { // Focuses on a VariableName
    if (t.type.name === ")") { // maybe no args
      break;
    }
    args.push(traverseExpr(t, s));
    t.nextSibling(); // Focuses on either "," or ")"
    if (t.type.name !== ")" && t.type.name !== ",") { // maybe no args
      throw new ParseError("Could not parse expr at " +
        t.from + " " + t.to + ": " + s.substring(t.from, t.to));
    }
  }
  t.parent(); // Pop to ArgList
  return args;
}