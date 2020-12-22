import sexp from "sexp";

type Stmt = {
    tag: "define",
    name: string,
    value: Expr
  }
  | 
  {
    tag: "print",
    value: Expr
  }

type Expr = {
  tag: "op",
  op: Op,
  left: Expr,
  right: Expr
}
|
{
  tag: "num",
  value: number
}
|
{
  tag: "id",
  value: string
}

enum Op { Plus, Minus } ;

function parseExpr(sexp : any) : Expr {
  if(typeof sexp === "number") { return { tag: "num", value: sexp}; }
  throw new Error("Could not parse, " + sexp);
}

export function parse(sexp : any) : Stmt {
  switch(sexp[0]) {
    case "print":
      return {
        tag: "print",
        value: parseExpr(sexp[1])
      };
    case "define":
      return {
        tag: "define",
        name: sexp[1],
        value: parseExpr(sexp[2])
      }
  }
}

export function compile(source: string) : string {
  const asSexp = (sexp as any)(source);
  console.log(asSexp);
  const ast = parse(asSexp);
  console.log(ast);
  return codeGen(ast).join("\n");
}

function codeGen(stmt : Stmt) : Array<string> {
  switch(stmt.tag) {
    case "define":
      var valStmts = codeGenExpr(stmt.value);
      return valStmts.concat([
        "call $print"
      ]);
    case "print":
      var valStmts = codeGenExpr(stmt.value);
      return valStmts.concat([
        "call $print"
      ]);
  }
}

function codeGenExpr(expr : Expr) : Array<string> {
  switch(expr.tag) {
    case "num":
      return ["i32.const " + expr.value];
  }
}
