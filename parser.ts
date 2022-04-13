import { TreeCursor } from 'lezer';
import { parser } from 'lezer-python';
import { TypedVar, Stmt, Expr, Type, isOp, isUnOp, CondBody, VarDef, FunDef, Program, Literal } from './ast';
import { ParseError } from './error';

export function parseProgram(source: string): Program<any> {
  const t = parser.parse(source).cursor();
  var vardefs: VarDef<any>[] = [];
  var fundefs: FunDef<any>[] = [];
  var stmts: Stmt<any>[] = [];
  traverseProgram(t, source, vardefs, fundefs, stmts);
  return { vardefs, fundefs, stmts }
}

export function traverseProgram(t: TreeCursor, s: string,
  vardefs: VarDef<any>[] = [], fundefs: FunDef<any>[] = [],
  stmts: Stmt<any>[] = []) {
  // The top node in the program is a Script node with a list of children
  // that are various statements
  switch (t.node.type.name) {
    case "Script":
      if (!t.firstChild()) //in case of empty program
        return
      while (traverseDefs(t, s, vardefs, fundefs)) {
        if (!t.nextSibling())
          return
      }
      do {
        traverseStmt(t, s, stmts);
      } while (t.nextSibling());
      break
    // t.nextSibling() returns false when it reaches
    //  the end of the list of children
    // console.log("traversed " + stmts.length + " statements ", stmts, "stopped at ", c.node);
    // return { vardefs, fundefs, stmts };
    case "Body":  // function body
      t.firstChild(); //focus on semicolon
      if (!t.nextSibling()) //in case of empty program
        return
      while (traverseDefs(t, s, vardefs, fundefs)) {
        if (!t.nextSibling())
          return
      }
      do {
        traverseStmt(t, s, stmts);
      } while (t.nextSibling());
      break
    default:
      throw new ParseError("Could not parse program at " + t.node.from + " " + t.node.to);
  }
}

export function traverseDefs(t: TreeCursor, s: string,
  vardefs: VarDef<any>[] = [], fundefs: FunDef<any>[] = []): boolean {
  switch (t.type.name) {
    case "AssignStatement":
      t.firstChild(); // focused on name (the first child)
      var name = s.substring(t.from, t.to);
      t.nextSibling(); // could be = sign or Typedef
      var typ: Type = undefined;
      var maybeTD = t;
      if (maybeTD.type.name !== "TypeDef") {
        t.parent()
        return false;
      }
      t.firstChild(); // focus on :
      t.nextSibling(); // focus on type
      typ = traverseType(t, s);
      t.parent();
      t.nextSibling(); // focus on = sign
      t.nextSibling(); // focused on the literal expression
      var init = traverseLit(t, s);
      t.parent();
      vardefs.push({
        typedvar: { name, typ },
        init
      });
      return true;

    case "FunctionDefinition":
      t.firstChild();  // Focus on def
      t.nextSibling(); // Focus on name of function
      var name = s.substring(t.from, t.to);
      t.nextSibling(); // Focus on ParamList
      var params = traverseParameters(t, s);
      t.nextSibling(); // Focus on Body or TypeDef
      var ret: Type = "none";
      var maybeTD = t;
      if (maybeTD.type.name === "TypeDef") {
        t.firstChild();
        ret = traverseType(t, s);
        t.parent();
      }
      t.nextSibling(); // Focus on Body

      const localvar: VarDef<any>[] = [];
      const localfun: FunDef<any>[] = [];
      const body: Stmt<any>[] = [];
      traverseProgram(t, s, localvar, localfun, body);
      t.parent();      // Pop to Body !!
      t.parent();      // Pop to FunctionDefinition
      fundefs.push({
        name, params, ret,
        body: { vardefs: localvar, stmts: body }
      });
      return true;
    default:
      return false;
  }
}

export function traverseStmts(t: TreeCursor, s: string) {
  // The top node in the program is a Script node with a list of children
  // that are various statements
  switch (t.node.type.name) {
    case "Body":
      // focus on Body
      var stmts: Stmt<any>[] = []
      t.firstChild(); // focus on semicolon
      t.nextSibling()
      do {
        traverseStmt(t, s, stmts);
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
export function traverseStmt(t: TreeCursor, s: string,
  stmts: Stmt<any>[] = []) {
  switch (t.type.name) {
    case "ReturnStatement":
      t.firstChild();  // Focus return keyword
      t.nextSibling(); // Focus expression
      var maybeRT = t;
      var value: Expr<any>;
      if (maybeRT.type.name === "⚠")
        value = { tag: "literal", value: { tag: "none" } };
      else
        value = traverseExpr(t, s);
      t.parent();
      stmts.push({ tag: "return", value });
      break;
    case "AssignStatement":
      // assign: x = 1
      t.firstChild(); // focused on name (the first child)
      var name = s.substring(t.from, t.to);
      t.nextSibling(); // focused on = sign. May need this for complex tasks, like +=!
      t.nextSibling(); // focused on the value expression
      var value = traverseExpr(t, s);
      t.parent();
      stmts.push({ tag: "assign", name, value });
      break;
    case "ExpressionStatement":
      t.firstChild(); // The child is some kind of expression, the
      // ExpressionStatement is just a wrapper with no information
      var expr = traverseExpr(t, s);
      t.parent();
      stmts.push({ tag: "expr", expr: expr });
      break;
    case "PassStatement":
      stmts.push({ tag: "pass" }); break;
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
      stmts.push({
        tag: "if",
        ifstmt, elifstmt, elsestmt
      });
      break;
    case "WhileStatement":
      t.firstChild();  // Focus on while
      let whilestmt = traverseCondBody(t, s);
      t.parent();
      stmts.push({ tag: "while", whilestmt });
      break;
  }
}


export function traverseType(t: TreeCursor, s: string): Type {
  switch (t.type.name) {
    case "VariableName":
      const name = s.substring(t.from, t.to);
      if (name !== "int" && name !== "bool" && name != "none") {
        throw new Error("Unknown type: " + name);
      }
      return name;
    default:
      throw new Error("Unknown type: " + t.type.name);

  }
}

export function traverseParameters(t: TreeCursor, s: string,): TypedVar[] {
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
    t.firstChild();  // Enter TypeDef
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
      return { tag: "id", name: s.substring(t.from, t.to) };
    case "CallExpression":
      t.firstChild(); // Focus name
      var name = s.substring(t.from, t.to);
      t.nextSibling(); // Focus ArgList
      // t.firstChild(); // Focus open paren
      var args = traverseArguments(t, s);
      var result: Expr<any> = { tag: "call", name, args: args };
      t.parent();
      return result;
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
      break
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