import { Stmt, Expr, BinOp, UnOp } from "./ast";
import { parse } from "./parser";

// https://learnxinyminutes.com/docs/wasm/

type LocalEnv = Map<string, boolean>;
var definedVars = new Set();
type CompileResult = {
  wasmSource: string,
};

export function compile(source: string): CompileResult {
  const ast = parse(source);
  definedVars = new Set();
  ast.forEach(s => {
    switch (s.tag) {
      case "define":
        definedVars.add(s.name);
        break;
    }
  });
  const scratchVar: string = `(local $$last i32)`;
  const localDefines = [scratchVar];
  definedVars.forEach(v => {
    localDefines.push(`(local $${v} i32)`);
  })

  const commandGroups = ast.map((stmt) => codeGen(stmt));
  const commands = localDefines.concat([].concat.apply([], commandGroups));
  console.log("Generated: ", commands.join("\n"));
  return {
    wasmSource: commands.join("\n"),
  };
}

function codeGen(stmt: Stmt): Array<string> {
  switch (stmt.tag) {
    case "define":
      var valStmts = codeGenExpr(stmt.value);
      return valStmts.concat([`(local.set $${stmt.name})`]);
    case "expr":
      var exprStmts = codeGenExpr(stmt.expr);
      return exprStmts.concat([`(local.set $$last)`]);
  }
}

function codeGenExpr(expr: Expr): Array<string> {
  switch (expr.tag) {
    case "builtin1":
      const argStmts = codeGenExpr(expr.arg);
      return argStmts.concat([`(call $${expr.name})`]);
    case "builtin2":
      const arg1Stmts = codeGenExpr(expr.arg1);
      const arg2Stmts = codeGenExpr(expr.arg2);
      return [...arg1Stmts, ...arg2Stmts, `(call $${expr.name})`]
    case "num":
      return ["(i32.const " + expr.value + ")"];
    case "id":
      if (!definedVars.has(expr.name)) {
        throw new ReferenceError(`name ${expr.name} is not defined`);
      }
      return [`(local.get $${expr.name})`];
    case "binexpr":
      const leftStmts = codeGenExpr(expr.left);
      const rightStmts = codeGenExpr(expr.right);
      const opStmt = codeGenBinOp(expr.op);
      return [...leftStmts, ...rightStmts, opStmt];
    case "unexpr":
      const unaryStmts = codeGenExpr(expr.expr);
      return codeGenUnOp(expr.op, unaryStmts);
  }
}

function codeGenBinOp(op: BinOp): string {
  switch (op) {
    case BinOp.Plus:
      return "(i32.add)";
    case BinOp.Minus:
      return "(i32.sub)";
    case BinOp.Mul:
      return "(i32.mul)";
    default:
      throw new Error("COMPILE ERROR: unknown binary operator");
  }
}

function codeGenUnOp(op: UnOp, unaryStmts: Array<string>): Array<string> {
  switch (op) {
    case UnOp.Minus:
      return ["(i32.const 0)", ...unaryStmts, "(i32.sub)"]
    case UnOp.Plus:
      return unaryStmts
    default:
      throw new Error("COMPILE ERROR: unknown unary operator");
  }
}
