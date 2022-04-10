import { TreeCursor } from 'lezer';
import { parser } from 'lezer-python';
import { Parameter, Stmt, Expr, Type, isOp, isUnOp, CondBody } from './ast';
import { ParseError } from './error';

export function parseProgram(source : string) : Array<Stmt<any>> {
  const t = parser.parse(source).cursor();
  return traverseStmts(t, source);
}

export function traverseStmts(t: TreeCursor, s: string) {
  // The top node in the program is a Script node with a list of children
  // that are various statements
  switch (t.node.type.name) {
    case "Script":
      var stmts = [];
      t.firstChild();
      do {
        console.log(t.type.name);
        stmts.push(traverseStmt(t, s));
      } while (t.nextSibling()); // t.nextSibling() returns false when it reaches
                                 //  the end of the list of children
      // console.log("traversed " + stmts.length + " statements ", stmts, "stopped at ", c.node);
      return stmts;
    case "Body":
      // focus on Body
      var stmts = [];
      t.firstChild(); // focus on semicolon
      t.nextSibling()
      do {
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
export function traverseStmt(t: TreeCursor, s: string,) : Stmt<any> {
  switch(t.type.name) {
    case "ReturnStatement":
      t.firstChild();  // Focus return keyword
      t.nextSibling(); // Focus expression
      var value = traverseExpr(t, s);
      t.parent();
      return { tag: "return", value };
    case "AssignStatement":
      t.firstChild(); // focused on name (the first child)
      var name = s.substring(t.from, t.to);
      t.nextSibling(); // focused on = sign. May need this for complex tasks, like +=!
      t.nextSibling(); // focused on the value expression

      var value = traverseExpr(t, s);
      t.parent();
      return { tag: "assign", name, value };
    case "ExpressionStatement":
      t.firstChild(); // The child is some kind of expression, the
                      // ExpressionStatement is just a wrapper with no information
      var expr = traverseExpr(t, s);
      t.parent();
      return { tag: "expr", expr: expr };
    case "FunctionDefinition":
      t.firstChild();  // Focus on def
      t.nextSibling(); // Focus on name of function
      var name = s.substring(t.from, t.to);
      t.nextSibling(); // Focus on ParamList
      var params = traverseParameters(t, s)
      t.nextSibling(); // Focus on Body or TypeDef
      let ret : Type = "none";
      let maybeTD = t;
      if(maybeTD.type.name === "TypeDef") {
        t.firstChild();
        ret = traverseType(t, s);
        t.parent();
      }
      t.nextSibling(); // Focus on single statement (for now)
      t.firstChild();  // Focus on :
      const body = [];
      while(t.nextSibling()) {
        body.push(traverseStmt(t, s));
      }
      t.parent();      // Pop to Body
      t.parent();      // Pop to FunctionDefinition
      return {
        tag: "define",
        name, params, body, ret
      }
    case "PassStatement":
      return { tag: "pass"}
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
      return { tag: "while", whilestmt};
  }
}

export function traverseType(t: TreeCursor, s: string) : Type {
  switch(t.type.name) {
    case "VariableName":
      const name = s.substring(t.from, t.to);
      if(name !== "int") {
        throw new Error("Unknown type: " + name)
      }
      return name;
    default:
      throw new Error("Unknown type: " + t.type.name)

  }
}

export function traverseParameters(t: TreeCursor, s: string,) : Parameter[] {
  t.firstChild();  // Focuses on open paren
  const parameters = []
  t.nextSibling(); // Focuses on a VariableName
  while(t.type.name !== ")") {
    let name = s.substring(t.from, t.to);
    t.nextSibling(); // Focuses on "TypeDef", hopefully, or "," if mistake
    let nextTagName = t.type.name; // NOTE(joe): a bit of a hack so the next line doesn't if-split
    if(nextTagName !== "TypeDef") { throw new Error("Missed type annotation for parameter " + name)};
    t.firstChild();  // Enter TypeDef
    t.nextSibling(); // Focuses on type itself
    let typ = traverseType(t, s);
    t.parent();
    t.nextSibling(); // Move on to comma or ")"
    parameters.push({name, typ});
    t.nextSibling(); // Focuses on a VariableName
  }
  t.parent();       // Pop to ParamList
  return parameters;
}

export function traverseExpr(t: TreeCursor, s: string) : Expr<any> {
  switch(t.type.name) {
    case "Boolean":
      if(s.substring(t.from, t.to) === "True") { return { tag: "true" }; }
      else { return { tag: "false" }; }
    case "Number":
      return { tag: "number", value: Number(s.substring(t.from, t.to)) };
    case "VariableName":
      return { tag: "id", name: s.substring(t.from, t.to) };
    case "CallExpression":
      t.firstChild(); // Focus name
      var name = s.substring(t.from, t.to);
      t.nextSibling(); // Focus ArgList
      t.firstChild(); // Focus open paren
      var args = traverseArguments(t, s);
      var result : Expr<any> = { tag: "call", name, args: args};
      t.parent();
      return result;
    case "BinaryExpression":
      t.firstChild(); // go to lhs
      const lhsExpr = traverseExpr(t, s);
      t.nextSibling(); // go to op
      var opStr = s.substring(t.from, t.to);
      if(!isOp(opStr)) {
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
      t.firstChild();
      t.nextSibling();
      var insideExpr = traverseExpr(t, s);
      t.parent();
      return insideExpr;
    default:
      throw new ParseError("Could not parse expr at " + t.from + " " + t.to + ": " + s.substring(t.from, t.to));
  }
}

export function traverseCondBody(t: TreeCursor, s: string) : CondBody<any> {
  //focus on if or elif or while etc
  t.nextSibling(); //focus on condition
  let cond = traverseExpr(t, s);
  t.nextSibling(); // focuse on body
  let body = traverseStmts(t, s);
  return {cond, body};
}


export function traverseArguments(t : TreeCursor, s : string) : Expr<any>[] {
  // c is the subtree of the arglist
  const args = [];
  t.firstChild(); // Focuses on open paren
  while (t.nextSibling()) { // Focuses on a VariableName
    args.push(traverseExpr(t, s));
    t.nextSibling(); // Focuses on either "," or ")"
  }
  t.parent(); // Pop to ArgList
  return args;
}