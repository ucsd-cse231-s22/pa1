import wabt from 'wabt';
import { BinOp, ClsDef, CondBody, Expr, FunDef, Literal, MemberExpr, Program, Stmt, Type, VarDef, getTypeStr } from "./ast";
import { parseProgram } from './parser';
import { tcProgram } from './tc';

type Env = Map<string, boolean>;
type ClsEnv = Map<string, ClsDef<Type>>;

function addIndent(s: string, indent: number = 0): string {
  return "  ".repeat(indent) + s;
}

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

function varsFunsStmts(p: Program<Type>): [string[], FunDef<Type>[], ClsDef<Type>[], Stmt<Type>[]] {
  return [variableNames(p.vardefs), p.fundefs, p.clsdefs, p.stmts];
}

export async function run(watSource: string, config: any): Promise<any> {
  const wabtApi = await wabt();

  const parsed = wabtApi.parseWat("example", watSource);
  const binary = parsed.toBinary({});
  var memory = new WebAssembly.Memory({ initial: 10, maximum: 100 });
  config = { ...config, env: { memory: memory } };
  const wasmModule = await WebAssembly.instantiate(binary.buffer, config);
  return (wasmModule.instance.exports as any)._start();
}

export function opStmts(op: BinOp) {
  switch (op) {
    case "+": return [`(i32.add)`];
    case "-": return [`(i32.sub)`];
    case "*": return [`(i32.mul)`];
    case "//": return [`(i32.div_s)`];
    case "%": return [`(i32.rem_s)`];
    case ">": return [`(i32.gt_s)`];
    case "<": return [`(i32.lt_s)`];
    case ">=": return [`(i32.ge_s)`];
    case "<=": return [`(i32.le_s)`];
    case "==": return [`(i32.eq)`];
    case "!=": return [`(i32.ne)`];
    // case "and": return [`i32.and`];
    // case "or": return [`i32.or`];
    case "is": return [`i32.eq`];
    default:
      throw new Error(`Unhandled or unknown op: ${op}`);
  }
}

export function codeGenLit(lit: Literal<Type>): Array<string> {
  if (lit.tag === "number")
    return [`(i32.const ${lit.value})`];
  else if (lit.tag === "bool") {
    if (lit.value)
      return [`(i32.const 1)`];
    else
      return [`(i32.const 0)`];
  }
  else {
    return [`(i32.const 0)`];  // none
  }
}

export function codeGenExpr(expr: Expr<Type>, locals: Env, clsEnv: ClsEnv): Array<string> {
  switch (expr.tag) {
    case "literal":
      return codeGenLit(expr.value);
    case "id":
      // Since we type-checked for making sure all variable exist, here we
      // just check if it's a local variable and assume it is global if not
      if (locals.has(expr.name)) { return [`(local.get $${expr.name})`]; }
      else { return [`(global.get $${expr.name})`]; }
    case "binop": {
      const lhsExprs = codeGenExpr(expr.lhs, locals, clsEnv);
      const rhsExprs = codeGenExpr(expr.rhs, locals, clsEnv);
      const opstmts = opStmts(expr.op);
      return [...lhsExprs, ...rhsExprs, ...opstmts];
    }
    case "unop":
      const unaryStmts = codeGenExpr(expr.expr, locals, clsEnv);
      switch (expr.op) {
        case "-": return ["(i32.const 0)", ...unaryStmts, "(i32.sub)"];
        case "not": return ["(i32.const 1)", ...unaryStmts, "(i32.sub)"];
        // default:
        //   throw new Error(`Unhandled or unknown op: ${expr.op}`);
      }
    case "call":
      const valStmts = expr.args.map(e => codeGenExpr(e, locals, clsEnv)).flat();
      let toCall = expr.name;
      if (clsEnv.has(expr.name)) {
        const clsdef = clsEnv.get(expr.name);
        let fieldstmts: Array<string> = [];
        clsdef.fields.map((f, i) => {
          fieldstmts.push(
            `(global.get $heap)`,
            `(i32.add (i32.const ${4 * i}))`,
            codeGenLit(f.init)[0],
            `(i32.store)`
          );
        })
        fieldstmts.push(
          `(global.get $heap) ;; return value of the object`, 
          `(global.get $heap)`,
          `(i32.add (i32.const ${clsdef.fields.length * 4}))`,
          `(global.set $heap)`,
        );
        return fieldstmts;
      }
      if (expr.name === "print") {
        switch (expr.args[0].a) {
          case "bool": toCall = "print_bool"; break;
          case "int": toCall = "print_num"; break;
          case "none": toCall = "print_none"; break;
        }
      }
      valStmts.push(`(call $${toCall})`);
      return valStmts;
    case "getfield":
      const fieldStmts = codeGenMemberExpr(expr, locals, clsEnv);
      fieldStmts.push(`(i32.load)`);
      return fieldStmts;
    case "method":
      const objStmt = codeGenExpr(expr.obj, locals, clsEnv);
      const argInstrs = expr.args.map(a => codeGenExpr(a, locals, clsEnv)).flat();
      return [...objStmt, ...argInstrs, 
        `(call $${getTypeStr(expr.obj.a)}$${expr.name})`];
    }
}

export function codeGenMemberExpr(expr: MemberExpr<Type>, locals: Env, clsEnv: ClsEnv): Array<string> {
  const objStmt = codeGenExpr(expr.obj, locals, clsEnv);
  const cls = clsEnv.get(getTypeStr(expr.obj.a));
  
  objStmt.push(
    `(call $ObjInit)`,
    `(i32.add (i32.const ${cls.indexOfField.get(expr.field) * 4}))`
  );
  return objStmt;
}

export function codeGenCondBody(condbody: CondBody<Type>, locals: Env, clsEnv: ClsEnv, indent: number, tag = "if"): Array<string> {
  const cond = codeGenExpr(condbody.cond, locals, clsEnv).map(s => addIndent(s, indent));
  const body = condbody.body.map(s => codeGenStmt(s, locals, clsEnv, indent + 2)).flat();

  // let stmt = cond.concat([`(if`, `(then`, ...body]);
  let stmt = [...cond,
    addIndent(`(if`, indent),
    addIndent(`(then`, indent + 1),
    ...body,
  ]
  if (tag === "elif") {
    stmt = stmt.concat([
      addIndent(`(br 1)`, indent + 2),
      addIndent(`)`, indent + 1),
      addIndent(`)`, indent)
    ]);
  }
  else if (tag === "while") {
    stmt = stmt.concat([
      addIndent(`(br 1)`, indent + 2),
      addIndent(`)`, indent + 1),
    ]);
  }
  else {
    stmt = stmt.concat([addIndent(`)`, indent + 1)]);
  }
  return stmt;
}


export function codeGenStmt(stmt: Stmt<Type>, locals: Env, clsEnv: ClsEnv, indent: number): Array<string> {
  switch (stmt.tag) {
    case "return":
      var valStmts = codeGenExpr(stmt.value, locals, clsEnv);
      valStmts.push("return");
      return valStmts.map(s => addIndent(s, indent));
    case "assign":
      var valStmts: Array<string> = codeGenExpr(stmt.value, locals, clsEnv);
      if (stmt.target.tag === "id") {
        if (locals.has(stmt.target.name)) { valStmts.push(`(local.set $${stmt.target.name})`); }
        else { valStmts.push(`(global.set $${stmt.target.name})`); }
      }
      else if (stmt.target.tag === "getfield") {
        var tarStmts = codeGenMemberExpr(stmt.target, locals, clsEnv);
        valStmts = tarStmts.concat(valStmts);
        valStmts.push(`(i32.store)`)
      }
      // valStmts = valStmts.concat(codeGenExpr(stmt.value, locals, clsEnv));
      // if (stmt.target.tag === "id") {
      //   if (locals.has(stmt.target.name)) { valStmts.push(`(local.set $${stmt.target.name})`); }
      //   else { valStmts.push(`(global.set $${stmt.target.name})`); }
      // }
      // else if (stmt.target.tag === "getfield") {
      //   const tarStmt = codeGenMemberExpr(stmt.target, locals, clsEnv);
      //   valStmts.concat();
      // }
      else {
        throw new Error("not implemented");
      }
      return valStmts.map(s => addIndent(s, indent));
    case "expr":
      const result = codeGenExpr(stmt.expr, locals, clsEnv);
      result.push("(local.set $scratch)");
      return result.map(s => addIndent(s, indent));
    case "pass":
      return [];
    case "if":
      const ifcondbody = codeGenCondBody(stmt.ifstmt, locals, clsEnv, indent);
      const elifcondbody = stmt.elifstmt.map(p => codeGenCondBody(p, locals, clsEnv, indent + 2, "elif")).flat();
      const elsestmt = stmt.elsestmt.map(p => codeGenStmt(p, locals, clsEnv, indent + 2)).flat();
      // console.log([...ifcondbody, `(else`, ...elifcondbody, ...elsestmt, `br 0`, `)`]);
      return [...ifcondbody,
        addIndent(`(else`, indent + 1),
        ...elifcondbody,
        ...elsestmt,
        addIndent(`(br 0)`, indent + 2),
        addIndent(`)`, indent + 1),
        addIndent(`)`, indent)
      ];
    case "while":
      const whilecondbody = codeGenCondBody(stmt.whilestmt, locals, clsEnv, indent + 2, "while");
      // let cond = codeGenExpr(stmt.whilestmt.cond, locals, indent + 2);
      // const body = stmt.whilestmt.body.map(s => codeGenStmt(s, locals, indent + 4)).flat();
      return [addIndent(`(block`, indent),
        addIndent(`(loop`, indent + 1),
        // ...cond, 
        // addIndent(`(if`, indent + 2),
        // addIndent(`(then`, indent + 3),
        // ...body, 
        // addIndent(`(br 1))`, indent + 4),
        ...whilecondbody,
        addIndent(`(else`, indent + 3),
        addIndent(`(br 2))`, indent + 4),
        addIndent(`)))`, indent)];
  }
}

export function codeGenFun(f: FunDef<Type>, locals: Env, clsEnv: ClsEnv, indent: number, isMethod: boolean = false): Array<string> {
  const withParamsAndVariables = new Map<string, boolean>(locals.entries());

  // Construct the environment for the function body
  const variables = variableNames(f.body.vardefs);
  variables.forEach(v => withParamsAndVariables.set(v, true));
  f.params.forEach(p => withParamsAndVariables.set(p.name, true));

  // Construct the code for params and variable declarations in the body
  let params = f.params.map(p => `(param $${p.name} i32)`).join(" ");
  if (isMethod) {
    params = `(param $self i32) ` + params;
  }
  const varDecls = variables.map(v => `(local $${v} i32)`).map(v => addIndent(v, indent + 1)).join("\n");
  const varAssign = f.body.vardefs.map(v => codeGenVars(v, withParamsAndVariables, indent + 1)).join("\n");

  const stmts = f.body.stmts.map(s => codeGenStmt(s, withParamsAndVariables, clsEnv, indent + 1)).flat();
  const stmtsBody = stmts.join("\n");
  return [`(func $${f.name} ${params} (result i32)`,
  addIndent(`(local $scratch i32)`, indent + 1),
  varDecls,
  varAssign,
  stmtsBody,
  addIndent(`(i32.const 0))`, indent + 1)];
}

export function codeGenVars(v: VarDef<Type>, locals: Env, indent: number): string {
  var valStmts: Array<string> = codeGenLit(v.init).flat();
  // valStmts = valStmts.concat();
  if (locals.has(v.typedvar.name)) {
    valStmts.push(`(local.set $${v.typedvar.name})`);
  }
  else { valStmts.push(`(global.set $${v.typedvar.name})`); }
  return valStmts.map(s => addIndent(s, indent)).join("\n");
}

export function codeGenCls(c: ClsDef<Type>, locals: Env, clsEnv: ClsEnv, indent: number): Array<string> {
  locals.set("self", true);
  const methods = c.methods.map(m => {
    m.name = `${c.name}$${m.name}`;
    return codeGenFun(m, locals, clsEnv, indent, true);
  }).flat();
  locals.delete("self");
  return methods;
}

export function compile(source: string): string {
  let ast = parseProgram(source);
  ast = tcProgram(ast);
  let basicIndent = 1;
  const emptyEnv = new Map<string, boolean>();
  const clsEnv = new Map<string, ClsDef<Type>>();
  const [vars, funs, classes, stmts] = varsFunsStmts(ast);
  classes.map(c => clsEnv.set(c.name, c));
  const clsCode: string[] = classes.map(c => codeGenCls(c, emptyEnv, clsEnv, basicIndent)).map(f => f.join("\n"));
  const allCls = clsCode.join("\n\n");
  const funsCode: string[] = funs.map(f => codeGenFun(f, emptyEnv, clsEnv, basicIndent)).map(f => f.join("\n"));
  const allFuns = funsCode.join("\n\n");
  const varDecls = vars.map(v => `(global $${v} (mut i32) (i32.const 0))`).join("\n");
  const varAssign = ast.vardefs.map(v => codeGenVars(v, emptyEnv, basicIndent + 1));
  const allStmts = stmts.map(s => codeGenStmt(s, emptyEnv, clsEnv, basicIndent + 1)).flat();

  const main = [`(local $scratch i32)`, ...varAssign, ...allStmts].join("\n");

  const lastStmt = ast.stmts[ast.stmts.length - 1];
  const isExpr = (lastStmt && lastStmt.tag === "expr");
  var retType = "";
  var retVal = "";
  if (isExpr) {
    retType = "(result i32)";
    retVal = "(local.get $scratch)"
  }

  return `(module
  (import "env" "memory" (memory $0 1))
  (func $print_num (import "imports" "print_num") (param i32) (result i32))
  (func $print_bool (import "imports" "print_bool") (param i32) (result i32))
  (func $print_none (import "imports" "print_none") (param i32) (result i32))
  (func $ObjInit (import "imports" "ObjInit") (param i32) (result i32))
  (func $abs(import "imports" "abs") (param i32) (result i32))
  (func $min(import "imports" "min") (param i32) (param i32) (result i32))
  (func $max(import "imports" "max") (param i32) (param i32) (result i32))
  (func $pow(import "imports" "pow") (param i32) (param i32) (result i32))
  (global $heap (mut i32) (i32.const 4))
  ${varDecls}
  ${allFuns}
  ${allCls}
  
  (func (export "_start") ${retType}
    ${main}
    ${retVal}
  )
) 
  `;
}

