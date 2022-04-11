import wabt from 'wabt';
import { BinOp, CondBody, Expr, FuncBody, FunDef, Literal, Program, Stmt, Type, VarDef } from "./ast";
import { parseProgram } from './parser';
import { tcProgram } from './tc';

type Env = Map<string, boolean>;

function variableNames(vardefs: VarDef<Type>[]): string[] {
  const vars: Array<string> = [];
  const var_set = new Set();

  vardefs.forEach((vardef) => {
    if (!var_set.has(vardef.typedvar.name)) {
      vars.push(vardef.typedvar.name);
      var_set.add(vardef.typedvar.name);
    }
  });
  return vars;
}

function varsFunsStmts(p: Program<Type>): [string[], FunDef<Type>[], Stmt<Type>[]] {
  return [variableNames(p.vardefs), p.fundefs, p.stmts];
}

export async function run(watSource: string, config: any): Promise<number> {
  const wabtApi = await wabt();

  const parsed = wabtApi.parseWat("example", watSource);
  const binary = parsed.toBinary({});
  const wasmModule = await WebAssembly.instantiate(binary.buffer, config);
  return (wasmModule.instance.exports as any)._start();
}

export function opStmts(op: BinOp) {
  switch (op) {
    case "+": return [`i32.add`];
    case "-": return [`i32.sub`];
    case "*": return [`i32.mul`];
    case "//": return [`i32.div_s`];
    case "%": return [`i32.rem_s`];
    case ">": return [`i32.gt_s`];
    case "<": return [`i32.lt_s`];
    case ">=": return [`i32.ge_s`];
    case "<=": return [`i32.le_s`];
    case "==": return [`i32.eq`];
    case "!=": return [`i32.ne`];
    // case "and": return [`i32.and`];
    // case "or": return [`i32.or`];
    case "is": return [`i32.eq`];
    default:
      throw new Error(`Unhandled or unknown op: ${op}`);
  }
}

export function codeGenExpr(expr: Expr<Type>, locals: Env): Array<string> {
  switch (expr.tag) {
    case "literal":
      if (expr.value.tag === "number")
        return [`(i32.const ${expr.value.value})`];
      else if (expr.value.tag === "bool") {
        if (expr.value.value)
          return [`(i32.const 1)`];
        else
          return [`(i32.const 0)`];
      }
      else {
        return [`(i32.const 0)`];  // none
      }
    // case "true": return [`(i32.const 1)`];
    // case "false": 
    case "id":
      // Since we type-checked for making sure all variable exist, here we
      // just check if it's a local variable and assume it is global if not
      if (locals.has(expr.name)) { return [`(local.get $${expr.name})`]; }
      else { return [`(global.get $${expr.name})`]; }
    case "binop": {
      const lhsExprs = codeGenExpr(expr.lhs, locals);
      const rhsExprs = codeGenExpr(expr.rhs, locals);
      const opstmts = opStmts(expr.op);
      return [...lhsExprs, ...rhsExprs, ...opstmts];
    }
    case "unop":
      const unaryStmts = codeGenExpr(expr.expr, locals);
      switch (expr.op) {
        case "-": return ["(i32.const 0)", ...unaryStmts, "(i32.sub)"];
        case "not": return ["(i32.const 1)", ...unaryStmts, "(i32.sub)"];
        // default:
        //   throw new Error(`Unhandled or unknown op: ${expr.op}`);
      }
    case "call":
      const valStmts = expr.args.map(e => codeGenExpr(e, locals)).flat();
      let toCall = expr.name;
      if (expr.name === "print") {
        switch (expr.args[0].a) {
          case "bool": toCall = "print_bool"; break;
          case "int": toCall = "print_num"; break;
          case "none": toCall = "print_none"; break;
        }
      }
      valStmts.push(`(call $${toCall})`);
      return valStmts;
  }
}


export function codeGenCondBody(condbody: CondBody<Type>, locals: Env, tag = "if"): Array<string> {
  const body = condbody.body.map(s => codeGenStmt(s, locals)).flat();
  const cond = codeGenExpr(condbody.cond, locals);
  // let stmt = cond.concat([`(if`, `(then`, ...body]);
  let stmt = [`
    ${cond.join("\n")}
    (if
    (then
      ${body.join("\n")}
  `];
  if (tag === "elif") {
    stmt = stmt.concat([`br 1`, `)`]);
  }
  stmt = stmt.concat([`)`]);
  return stmt;
}


export function codeGenStmt(stmt: Stmt<Type>, locals: Env): Array<string> {
  switch (stmt.tag) {
    case "return":
      var valStmts = codeGenExpr(stmt.value, locals);
      valStmts.push("return");
      return valStmts;
    case "assign":
      var valStmts: Array<string> = [];
      // if (stmt?.ret) { // declare
      //   locals.set(stmt.name, true);
      //   valStmts.push(`(local $${stmt.name} i32)`);
      // }
      valStmts = valStmts.concat(codeGenExpr(stmt.value, locals));
      if (locals.has(stmt.name)) { valStmts.push(`(local.set $${stmt.name})`); }
      else { valStmts.push(`(global.set $${stmt.name})`); }
      return valStmts;
    case "expr":
      const result = codeGenExpr(stmt.expr, locals);
      result.push("(local.set $scratch)");
      return result;
    case "pass":
      return [];
    case "if":
      const ifcondbody = codeGenCondBody(stmt.ifstmt, locals);
      const elifcondbody = stmt.elifstmt.map(p => codeGenCondBody(p, locals, "elif")).flat();
      const elsestmt = stmt.elsestmt.map(p => codeGenStmt(p, locals)).flat();
      // console.log([...ifcondbody, `(else`, ...elifcondbody, ...elsestmt, `br 0`, `)`]);
      return [...ifcondbody, `(else`, ...elifcondbody, ...elsestmt, `br 0`, `)`, `)`];
    case "while":
      let cond = codeGenExpr(stmt.whilestmt.cond, locals).join("\n");
      const body = stmt.whilestmt.body.map(s => codeGenStmt(s, locals)).flat().join("\n");
      return [`(block
        (loop
          ${cond}
          (if
            (then
              ${body}
              br 1
            )
            (else
              br 2
            )
          )
        )
      )`];
  }
}

export function codeGenFun(f: FunDef<Type>, locals: Env): Array<string> {
  const withParamsAndVariables = new Map<string, boolean>(locals.entries());

  // Construct the environment for the function body
  const variables = variableNames(f.body.vardefs);
  variables.forEach(v => withParamsAndVariables.set(v, true));
  f.params.forEach(p => withParamsAndVariables.set(p.name, true));

  // Construct the code for params and variable declarations in the body
  const params = f.params.map(p => `(param $${p.name} i32)`).join(" ");
  const varDecls = variables.map(v => `(local $${v} i32)`).join("\n");
  const varAssign = f.body.vardefs.map(v => codeGenVars(v, withParamsAndVariables)).join("\n");

  const stmts = f.body.stmts.map(s => codeGenStmt(s, withParamsAndVariables)).flat();
  const stmtsBody = stmts.join("\n");
  return [`(func $${f.name} ${params} (result i32)
        (local $scratch i32)
        ${varDecls}
        ${varAssign}
        ${stmtsBody}
        (i32.const 0))`];
}

export function codeGenVars(v: VarDef<Type>, locals: Env): string {
  var valStmts: Array<string> = codeGenExpr(v.value, locals).flat();
  // valStmts = valStmts.concat();
  if (locals.has(v.typedvar.name)) {
    valStmts.push(`(local.set $${v.typedvar.name})`);
  }
  else { valStmts.push(`(global.set $${v.typedvar.name})`); }
  return valStmts.join("\n");
}

export function compile(source: string): string {
  let ast = parseProgram(source);
  ast = tcProgram(ast);
  const emptyEnv = new Map<string, boolean>();
  const [vars, funs, stmts] = varsFunsStmts(ast);
  const funsCode: string[] = funs.map(f => codeGenFun(f, emptyEnv)).map(f => f.join("\n"));
  const allFuns = funsCode.join("\n\n");
  const varDecls = vars.map(v => `(global $${v} (mut i32) (i32.const 0))`).join("\n");
  const varAssign = ast.vardefs.map(v => codeGenVars(v, emptyEnv));

  const allStmts = stmts.map(s => codeGenStmt(s, emptyEnv)).flat();

  const main = [`(local $scratch i32)`, ...varAssign, ...allStmts].join("\n");

  const lastStmt = ast.stmts[ast.stmts.length - 1];
  const isExpr = (lastStmt && lastStmt.tag === "expr");
  var retType = "";
  var retVal = "";
  if (isExpr) {
    retType = "(result i32)";
    retVal = "(local.get $scratch)"
  }

  return `
    (module
      (func $print_num (import "imports" "print_num") (param i32) (result i32))
      (func $print_bool (import "imports" "print_bool") (param i32) (result i32))
      (func $print_none (import "imports" "print_none") (param i32) (result i32))
      ${varDecls}
      ${allFuns}
      
      (func (export "_start") ${retType}
        ${main}
        ${retVal}
      )
    ) 
  `;
}
