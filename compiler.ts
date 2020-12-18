import sexp from "sexp";

type Stmt = {
    tag: "assign",
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

enum Op { Plus, Minus } ;

function parseExpr(sexp : any) : Expr {
  if(typeof sexp === "number") { return { tag: "num", value: sexp}; }
  throw new Error("Could not parse, " + sexp);
}

export function parse(sexp : any) : Stmt {
  if(sexp[0] === "print") {
    return {
      tag: "print",
      value: parseExpr(sexp[1])
    };
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
    case "print":
      const valStmts = codeGenExpr(stmt.value)
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
