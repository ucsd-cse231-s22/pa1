import { Stmt, Expr } from "./ast";
import { parse } from "./parser";

// https://learnxinyminutes.com/docs/wasm/

type LocalEnv = Map<string, boolean>;

type CompileResult = {
  wasmSource: string,
};

export function compile(source: string) : CompileResult {
  const ast = parse(source);
  // TODO(joe): make a set? What's the best pedagogic decision?
  const localDefines : Array<string> = [];
  ast.forEach(s => {
    switch(s.tag) {
      case "define":
        localDefines.push(`(local $${s.name} i32)`);
        break;
    }
  }); 

  const commandGroups = ast.map((stmt) => codeGen(stmt));
  const commands = localDefines.concat([].concat.apply([], commandGroups));
  console.log("Generated: ", commands.join("\n"));
  return {
    wasmSource: commands.join("\n"),
  };
}

function codeGen(stmt: Stmt) : Array<string> {
  switch(stmt.tag) {
    case "define":
      var valStmts = codeGenExpr(stmt.value);
      return valStmts.concat([`(local.set $${stmt.name})`]);
    case "print":
      var valStmts = codeGenExpr(stmt.value);
      return valStmts.concat([
        "(call $print)"
      ]);      
    case "expr":
      return codeGenExpr(stmt.expr);
  }
}

function codeGenExpr(expr : Expr) : Array<string> {
  switch(expr.tag) {
    case "num":
      return ["(i32.const " + expr.value + ")"];
    case "id":
      return [`(local.get $${expr.name})`];
  }
}
