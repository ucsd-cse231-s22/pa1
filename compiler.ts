import { stringInput } from "lezer-tree";
import { Stmt, Expr, Op } from "./ast";
import { parse } from "./parser";

// https://learnxinyminutes.com/docs/wasm/

// Numbers are offsets into global memory
export type GlobalEnv = {
  globals: Map<string, number>;
  offset: number;
}

export const emptyEnv = { globals: new Map(), offset: 0 };

export function augmentEnv(env: GlobalEnv, stmts: Array<Stmt>) : GlobalEnv {
  const newEnv = new Map(env.globals);
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

type CompileResult = {
  wasmSource: string,
  newEnv: GlobalEnv
};

export function compile(source: string, env: GlobalEnv) : CompileResult {
  const ast = parse(source);
  const withDefines = augmentEnv(env, ast);
  const defines = ast.filter((a) => a.tag == "define");
  const locals = defines.map((a) => (a as any).name);
  const localStmts = locals.map(l => `(local $${l} i32)`);
  return {
    wasmSource: [].concat.apply(localStmts, ast.map((stmt) => codeGen(stmt, withDefines))).join("\n"),
    newEnv: withDefines
  };
}

function envLookup(env : GlobalEnv, name : string) : number {
  if(!env.globals.has(name)) { console.log("Could not find " + name + " in ", env); throw new Error("Could not find name " + name); }
  return (env.globals.get(name) * 4); // 4-byte values
}

function codeGen(stmt: Stmt, env: GlobalEnv) : Array<string> {
  switch(stmt.tag) {
    case "define":
      var valStmts = codeGenExpr(stmt.value, env);
      return valStmts.concat([
        `(local.set $${stmt.name})`,
        `(i32.const ${envLookup(env, stmt.name)}) ;; ${stmt.name}`,
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
      return [`(i32.const ${envLookup(env, expr.name)})`, `i32.load `]
  }
}
