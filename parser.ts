import {parser} from "lezer-python";
import {TreeCursor} from "lezer-tree";
import {BinOp, Expr, Stmt, UnOp} from "./ast";
import { ParseError } from "./error";

export function traverseArgs(c: TreeCursor, s: string): Array<Expr> {
  // c is the subtree of the arglist
  const args = [];
  c.firstChild(); // (
  // c.nextSibling(); // the first arg
  // do {
  //   if (c.type.name !== ",") {
  //     args.push(traverseExpr(c, s));
  //   }
  //   c.nextSibling();
  // } while (c.type.name !== ")")
  while (c.nextSibling()) {
    // better logic to skip (,)
    args.push(traverseExpr(c, s));
    c.nextSibling();
  }
  c.parent();
  return args;
}


export function traverseExpr(c : TreeCursor, s : string) : Expr {
  switch(c.type.name) {
    case "Number":
      return {
        tag: "num",
        value: Number(s.substring(c.from, c.to))
      }
    case "VariableName":
      return {
        tag: "id",
        name: s.substring(c.from, c.to)
      }
    case "CallExpression":
      c.firstChild();
      const callName = s.substring(c.from, c.to);
      c.nextSibling(); // go to arglist
      const args = traverseArgs(c, s);
      // c.firstChild(); // go into arglist
      // c.nextSibling(); // find single argument in arglist
      // const arg = traverseExpr(c, s);
      // c.parent(); // pop arglist
      c.parent(); // pop CallExpression
      if (args.length === 1) {
        if (!(["print", "abs"].includes(callName))) {
          throw new ParseError("unsupported builtin1 function");
        }
        return {
          tag: "builtin1",
          name: callName,
          arg: args[0]
        };
      }
      else if (args.length === 2) {
        if (!(["max", "min", "pow"].includes(callName))) {
          throw new ParseError("unsupported builtin2 function");
        }
        return {
          tag: "builtin2",
          name: callName,
          arg1: args[0],
          arg2: args[1]
        };
      }
      else {
        throw new ParseError("unsupported number of args");
      }
    case "BinaryExpression":
      c.firstChild(); // go to left arg 
      const left = traverseExpr(c, s);
      c.nextSibling(); // go to op
      // const op = s.substring(c.from, c.to);
      var op: BinOp;
      switch (s.substring(c.from, c.to)) {
        case "+":
          op = BinOp.Plus;
          break;
        case "-":
          op = BinOp.Minus;
          break;
        case "*":
          op = BinOp.Mul;
          break;
        default:
          throw new ParseError("unknown binary operator");
      }
      c.nextSibling(); // go to right arg
      const right = traverseExpr(c, s);
      c.parent();
      return {
        tag: "binexpr",
        op: op,
        left: left,
        right: right
      };
    case "UnaryExpression":
      c.firstChild();
      var uop: UnOp;
      switch (s.substring(c.from, c.to)) {
        case "-":
          uop = UnOp.Minus;
          break;
        case "+":
          uop = UnOp.Plus;
          break;
        default:
          throw new ParseError("unknown unary operator");
      }
      c.nextSibling(); // go to right arg
      const uarg = traverseExpr(c, s);
      c.parent();
      return { tag: "unexpr", op: uop, expr: uarg };
    default:
      throw new ParseError("Could not parse expr at " + c.from + " " + c.to + ": " + s.substring(c.from, c.to));
  }
}

export function traverseStmt(c : TreeCursor, s : string) : Stmt {
  switch(c.node.type.name) {
    case "AssignStatement":
      c.firstChild(); // go to name
      const name = s.substring(c.from, c.to);
      c.nextSibling(); // go to equals
      c.nextSibling(); // go to value
      const value = traverseExpr(c, s);
      c.parent();
      return {
        tag: "define",
        name: name,
        value: value
      }
    case "ExpressionStatement":
      c.firstChild();
      const expr = traverseExpr(c, s);
      c.parent(); // pop going into stmt
      return { tag: "expr", expr: expr }
    default:
      throw new ParseError("Could not parse stmt at " + c.node.from + " " + c.node.to + ": " + s.substring(c.from, c.to));
  }
}

export function traverse(c : TreeCursor, s : string) : Array<Stmt> {
  switch(c.node.type.name) {
    case "Script":
      const stmts = [];
      c.firstChild();
      do {
        stmts.push(traverseStmt(c, s));
      } while(c.nextSibling())
      console.log("traversed " + stmts.length + " statements ", stmts, "stopped at " , c.node);
      return stmts;
    default:
      throw new ParseError("Could not parse program at " + c.node.from + " " + c.node.to);
  }
}
export function parse(source : string) : Array<Stmt> {
  const t = parser.parse(source);
  return traverse(t.cursor(), source);
}
