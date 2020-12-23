import {parser} from "lezer-python";
import {Tree, TreeCursor} from "lezer-tree";
import {Expr, Stmt, Op} from "./ast";

export function traverseExpr(c : TreeCursor, s : string) : Expr {
  switch(c.node.type.name) {
    case "Number":
      return {
        tag: "num",
        value: Number(s.substring(c.node.from, c.node.to))
      }
    case "VariableName":
      return {
        tag: "id",
        name: s.substring(c.node.from, c.node.to)
      }
    default:
      throw new Error("Could not parse expr at " + c.node.from + " " + c.node.to);
  }
}

export function traverseStmt(c : TreeCursor, s : string) : Stmt {
  switch(c.node.type.name) {
    case "AssignStatement":
      const nameChild = c.node.firstChild;
      const valChild = c.node.lastChild;
      return {
        tag: "define",
        name: s.substring(nameChild.from, nameChild.to),
        value: traverseExpr(valChild.cursor, s)
      }
    case "ExpressionStatement":
      const subC = c.node.firstChild.cursor;
      if(subC.node.type.name === "CallExpression") {
        return {
          tag: "print",
          // LOL TODO: not this
          value: traverseExpr(subC.node.lastChild.firstChild.nextSibling.cursor, s)
        };
      }
    default:
      throw new Error("Could not parse stmt at " + c.node.from + " " + c.node.to);
  }
}

export function traverse(c : TreeCursor, s : string) : Array<Stmt> {
  switch(c.node.type.name) {
    case "Script":
      const stmts = [];
      const firstChild = c.firstChild();
      do {
        stmts.push(traverseStmt(c, s));
      } while(c.nextSibling())
      return stmts;
    default:
      throw new Error("Could not parse program at " + c.node.from + " " + c.node.to);
  }
}
export function parse(source : string) : Array<Stmt> {
  const t = parser.parse(source);
  return traverse(t.cursor(), source);
}
