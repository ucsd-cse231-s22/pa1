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
  const commandGroups = ast.map((stmt) => codeGen(stmt, withDefines));
  const commands = [].concat.apply([], commandGroups);
  return {
    wasmSource: commands.join("\n"),
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
      const locationToStore = [`(i32.const ${envLookup(env, stmt.name)}) ;; ${stmt.name}`];
      var valStmts = codeGenExpr(stmt.value, env);
      return locationToStore.concat(valStmts).concat([`(i32.store)`]);
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
    case "op":
      return codeGenOp(expr.op, expr.left, expr.right, env);
  }
}

function codeGenOp(op: Op, left: Expr, right: Expr, env: GlobalEnv): Array<string> {
  var leftStmts = codeGenExpr(left, env);
  var rightStmts = codeGenExpr(right, env);

  return leftStmts.concat(rightStmts.concat([
    `(i32.add )`
  ]));
}