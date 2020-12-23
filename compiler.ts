import { stringInput } from "lezer-tree";
import sexp from "sexp";

// https://learnxinyminutes.com/docs/wasm/

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
  name: string
}

enum Op { Plus, Minus } ;

// Numbers are offsets into global memory
export type GlobalEnv = {
  globals: Map<string, number>;
  offset: number;
}

export const emptyEnv = { globals: new Map(), offset: 0 };

function parseExpr(sexp : any) : Expr {
  if(typeof sexp === "number") { return { tag: "num", value: sexp}; }
  if(typeof sexp === "string") { return { tag: "id", name: sexp}; }
  throw new Error("Could not parse, " + sexp);
}

export function parseProgram(sexp : any) : Array<Stmt> {
  return sexp.map(parseStmt); 
}

function parseStmt(sexp : any) : Stmt {
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
      };
  }
}

export function augmentEnv(env: GlobalEnv, stmts: Array<Stmt>) : GlobalEnv {
  const newEnv = new Map();
  var newOffset = env.offset;
  stmts.forEach((s) => {
    switch(s.tag) {
      case "define":
        newEnv.set(s.name, newOffset);
        newOffset += 1;
        break;
    }
  })
  return {
    globals: newEnv,
    offset: newOffset
  }
}

export function compile(source: string, env: GlobalEnv) : string {
  const asSexp = (sexp as any)(`(${source})`);
  console.log(asSexp);
  const ast = parseProgram(asSexp);
  console.log(ast);
  const withDefines = augmentEnv(env, ast);
  const defines = ast.filter((a) => a.tag == "define");
  const locals = defines.map((a) => (a as any).name);
  const localStmts = locals.map(l => `(local $${l} i32)`);
  return [].concat.apply(localStmts, ast.map((stmt) => codeGen(stmt, withDefines))).join("\n");
}

function codeGen(stmt: Stmt, env: GlobalEnv) : Array<string> {
  switch(stmt.tag) {
    case "define":
      var valStmts = codeGenExpr(stmt.value, env);
      return valStmts.concat([
        `(local.set $${stmt.name})`,
        `(i32.const ${env.globals.get(stmt.name)})`,
        `(local.get $${stmt.name})`,
        `(i32.store )`
      ]);
    case "print":
      var valStmts = codeGenExpr(stmt.value, env);
      return valStmts.concat([
        "(call $print)"
      ]);
  }
}

function codeGenExpr(expr : Expr, env: GlobalEnv) : Array<string> {
  switch(expr.tag) {
    case "num":
      return ["(i32.const " + expr.value + ")"];
    case "id":
      return [`(i32.const ${env.globals.get(expr.name)})`, `i32.load `]
  }
}
