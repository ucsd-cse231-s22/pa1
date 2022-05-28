import wabt from 'wabt';
import { BinOp, ClsDef, CondBody, Expr, FunDef, Literal, MemberExpr, Program, Stmt, Type, VarDef, getTypeStr, isRefType, TypedVar } from "./ast";
import { parseProgram } from './parser';
import { tcProgram } from './tc';

type Env = Map<string, boolean>;
type ClsEnv = Map<string, [ClsDef<Type>, number]>;
let wabtApi: any = null;
let selfVar = 0;
let selfVarMax = 0;


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
  if (wabtApi === null) {
    wabtApi = await wabt();
  }
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


export function codeGenArgs(args: Expr<Type>[], locals: Env, clsEnv: ClsEnv): Array<string> {
  return args.map(arg => {
    if (arg.tag === "id") {
      if (locals.has(arg.name))
        return `(local.get $${arg.name})`;
      else
        return `(global.get $${arg.name})`;
    }
    else
      return codeGenExpr(arg, locals, clsEnv);
  }).flat();
}

export function codeGenExpr(expr: Expr<Type>, locals: Env, clsEnv: ClsEnv): Array<string> {
  switch (expr.tag) {
    case "literal":
      return codeGenLit(expr.value);
    case "id":
      // Since we type-checked for making sure all variable exist, here we
      // just check if it's a local variable and assume it is global if not
      if (locals.has(expr.name)) { 
        if (locals.get(expr.name)) {
          return [`(local.get $${expr.name})`, `(i32.load)`];
        }
        return [`(local.get $${expr.name})`];
       }
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
      }
    case "call":
      // var valStmts = expr.args.map(e => codeGenExpr(e, locals, clsEnv)).flat();
      var valStmts = codeGenArgs(expr.args, locals, clsEnv);
      let toCall = expr.name;
      if (clsEnv.has(expr.name)) { // this is an object constructor
        const initstmts: Array<string> = [];
        const [clsdef, tableIdx] = clsEnv.get(expr.name);
        initstmts.push(
          `(global.get $heap)`, 
          `(i32.const ${tableIdx})`,
          `(i32.store)`
        );
        clsdef.fields.map((f, i) => {
          initstmts.push(
            `(global.get $heap)`,
            `(i32.add (i32.const ${4 * i + 4}))`,
            codeGenLit(f.init)[0],
            `(i32.store)`
          );
        });
        initstmts.push(
          `(global.get $heap) ;; return value of the object`, 
          `(global.get $heap) ;; the param self of __init__`, 
          `(global.get $heap)`,
          `(i32.add (i32.const ${clsdef.fields.length * 4 + 4}))`,
          `(global.set $heap)`,
        );
        let toCallIdx = clsdef.indexOfMethod.get("__init__");
        valStmts.push(
          `(i32.add (i32.const ${tableIdx}) (i32.const ${toCallIdx})) ;; get the index of the function in table`, 
          `(call_indirect (type ${clsdef.ptrOfMethod.get("__init__")}$type))`,
          `(local.set $scratch)`
        );
        return [...initstmts, ...valStmts];
      }
      if (expr.name === "print") {
        const arg = expr.args[0];
        switch (arg.a.tag) {
          case "bool": toCall = "print_bool"; break;
          case "int": toCall = "print_num"; break;
          case "none": toCall = "print_none"; break;
        }
        if (arg.tag === "id" && locals.get(arg.name))
          valStmts.push(`(i32.load)`);
      }
      valStmts.push(`(call $${toCall})`);
      return valStmts;
    case "getfield":
      var fieldStmts = codeGenMemberExpr(expr, locals, clsEnv);
      fieldStmts.push(`(i32.load)`);
      return fieldStmts;
    case "method":
      const clsName = getTypeStr(expr.obj.a);
      const [cls, tableIdx] = clsEnv.get(clsName);
      const objStmt = codeGenExpr(expr.obj, locals, clsEnv);
      selfVar += 1;
      selfVarMax = selfVar > selfVarMax ? selfVar : selfVarMax;
      const argInstrs = codeGenArgs(expr.args, locals, clsEnv).flat();
      selfVar -= 1
      let toCallIdx = cls.indexOfMethod.get(expr.name);
      return [...objStmt, // self
        `(global.set $self${selfVar})`, 
        `(global.get $self${selfVar})`, 
        `(call $check_init)`,
        ...argInstrs, 
        `(global.get $self${selfVar})`, 
        `(i32.load) ;; vtable`, 
        `(i32.add (i32.const ${toCallIdx}))`, 
        `(call_indirect (type ${cls.ptrOfMethod.get(expr.name)}$type))`
      ];
    }
}

export function codeGenMemberExpr(expr: MemberExpr<Type>, locals: Env, clsEnv: ClsEnv): Array<string> {
  const objStmt = codeGenExpr(expr.obj, locals, clsEnv);
  const [cls, tableIdx] = clsEnv.get(getTypeStr(expr.obj.a));
  
  objStmt.push(
    `(call $check_init)`,
    `(i32.add (i32.const ${cls.indexOfField.get(expr.field) * 4 + 4}))`
  );
  return objStmt;
}

export function codeGenCondBody(condbody: CondBody<Type>, locals: Env, clsEnv: ClsEnv, indent: number, tag = "if"): Array<string> {
  const cond = codeGenExpr(condbody.cond, locals, clsEnv).map(s => addIndent(s, indent));
  const body = condbody.body.map(s => codeGenStmt(s, locals, clsEnv, indent + 2)).flat();

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
        if (locals.has(stmt.target.name)) { 
          if (locals.get(stmt.target.name)) {
            valStmts.unshift(`(local.get $${stmt.target.name})`);
            valStmts.push(`(i32.store)`); 
          }
          else
            valStmts.push(`(local.set $${stmt.target.name})`); 
        }
        else { valStmts.push(`(global.set $${stmt.target.name})`); }
      }
      else if (stmt.target.tag === "getfield") {
        var tarStmts = codeGenMemberExpr(stmt.target, locals, clsEnv);
        valStmts = tarStmts.concat(valStmts);
        valStmts.push(`(i32.store)`)
      }
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
      const ifcondbody = codeGenCondBody(stmt.ifstmt, locals, clsEnv, indent).flat();
      const elifcondbody = stmt.elifstmt.map(p => codeGenCondBody(p, locals, clsEnv, indent + 2, "elif")).flat();
      const elsestmt = stmt.elsestmt.map(p => codeGenStmt(p, locals, clsEnv, indent + 2)).flat();
      if (elifcondbody.length !== 0 || elsestmt.length !== 0) 
        return [
          ...ifcondbody,
          addIndent(`(else`, indent + 1),
          ...elifcondbody,
          ...elsestmt,
          addIndent(`)`, indent + 1),
          addIndent(`)`, indent)
        ];
      return [...ifcondbody,
        addIndent(`)`, indent)
      ];
    case "while":
      const whilecondbody = codeGenCondBody(stmt.whilestmt, locals, clsEnv, indent + 2, "while");
      return [addIndent(`(block`, indent),
        addIndent(`(loop`, indent + 1),
        ...whilecondbody,
        addIndent(`)))`, indent)];
  }
}

export function codeGenFun(f: FunDef<Type>, locals: Env, clsEnv: ClsEnv, indent: number, methodName: string = null): Array<string> {
  const withParamsAndVariables = new Map<string, boolean>(locals.entries());

  // Construct the environment for the function body
  /*
  |-------------------------------------------------------------------------------------------------------|
  | CodeGen    |    params:    |     vardef       |      params      |      params     |      global      |
  |            |   original    |     original     |   nonlocal decl  |   nonlocal use  |   use or decls   |
  |-------------------------------------------------------------------------------------------------------|
  | ref        |   undefined   |   undefined      |       True       |     False       |         /        | ref is whether this var is nonlocal
  | refed      |   true/false  |   True / False   |   True / False   |     False       |         /        | refed is whether this var is used in the nested function
  | in funcdef |     wrap if refed is true        |  already wrapped |   don't wrap    |         /        | wrap means putting the var in the heap and use load store to access it
  |            |    add in locals with refed      |         add in locals with ref     |   not in locals  | locals with T/F means whether the var is wrapped
  | use by id  | load if refed is true, else get  |       load       |      get        |    global.get    | => if true in locals, load; else get  
  | assign tar | store if refed is true, else set |       store      |       /         |    global.set    | => if true in locals, store; else set  
  | as arg     |                      directly local.get                               |    global.get    |  
  |-------------------------------------------------------------------------------------------------------|
 */
  const variables = variableNames(f.body.vardefs);
  f.body.vardefs.forEach(v => withParamsAndVariables.set(v.typedvar.name, v.typedvar.typ.refed));
  f.params.forEach(p => {
    let flag = isRefType(p.typ) ? p.typ.ref : p.typ.refed;
    withParamsAndVariables.set(p.name, flag);
  });

  // Construct the code for params and variable declarations in the body
  let params = f.params.map(p => `(param $${p.name} i32)`).join(" ");
  const paramWrap = f.params.map(p => {
    const paramStmt = [];
    if (!p.typ.ref && p.typ.refed) {
      paramStmt.push(
        `(global.get $heap)`, 
        `(local.get $${p.name})`, 
        `(i32.store)`,
        `(global.get $heap) ;; addr of param ${p.name}`, 
        `(local.set $${p.name})`,
        `(global.get $heap)`, 
        `(i32.add (i32.const 4))`,
        `(global.set $heap)`, 
      )
    }
    return paramStmt.map(s => addIndent(s, indent + 1));
  }).flat().join("\n");

  const varDecls = variables.map(v => {
    return addIndent(`(local $${v} i32)`, indent + 1)
  }).join("\n");

  const varAssign = f.body.vardefs.map(v => codeGenVars(v, withParamsAndVariables, indent + 1)).join("\n");

  const stmts = f.body.stmts.map(s => codeGenStmt(s, withParamsAndVariables, clsEnv, indent + 1)).flat();

  const stmtsBody = stmts.join("\n");
  const fname = methodName ? methodName : f.name;
  return [`(func $${fname} ${params} (result i32)`,
  addIndent(`(local $scratch i32)`, indent + 1),
  varDecls,
  paramWrap,
  varAssign,
  stmtsBody,
  addIndent(`(i32.const 0))`, indent + 1)].filter(s => s.length !== 0);
}

export function codeGenVars(v: VarDef<Type>, locals: Env, indent: number): string {
  var valStmts: Array<string> = codeGenLit(v.init).flat();
  // valStmts = valStmts.concat();
  if (locals.has(v.typedvar.name)) {
    if (v.typedvar.typ.refed) {
      // put on the heap
      valStmts.unshift(`(global.get $heap)`)
      valStmts.push(
        `(i32.store)`,
        `(global.get $heap) ;; addr of the value`,
        `(global.get $heap)`,
        `(i32.add (i32.const 4))`,
        `(global.set $heap)`
      );
    }
    valStmts.push(`(local.set $${v.typedvar.name})`);
  }
  else { valStmts.push(`(global.set $${v.typedvar.name})`); }
  return valStmts.map(s => addIndent(s, indent)).join("\n");
}

export function codeGenCls(c: ClsDef<Type>, locals: Env, clsEnv: ClsEnv, indent: number): Array<string> {
  locals.set("self", true);
  const methods = c.methods.map(m => {
    if (c.indexOfMethod.has(m.name)) {
      return codeGenFun(m, locals, clsEnv, indent, `${c.name}$${m.name}`);
    } else { // a lifted nested function
      return codeGenFun(m, locals, clsEnv, indent);
    }
  }).flat();
  locals.delete("self");
  return methods.flat();
}

export function codeGenTable(classes: ClsDef<Type>[], clsEnv: ClsEnv, indent: number): Array<string> {
  let funcNums = 0
  const tableContents: string[] = [];
  const typeSigSet = new Set<string>();
  
  classes.forEach(c => {
    clsEnv.set(c.name, [c, funcNums]);
    funcNums += c.indexOfMethod.size;
    tableContents.push(addIndent(`;; start for class ${c.name}`, 1));
    c.ptrOfMethod.forEach((fullName, shortName) => {
      tableContents.push(addIndent(fullName, 1));
    });
  });
  
  classes.forEach(c => {
    c.methods.forEach(m => {
      if (!c.ptrOfMethod.has(m.name)) { // if not a method, a nested func
        return
      }
      const paramsStr = m.params.map(p => `(param i32)`).join(" ");
      const name = `${c.ptrOfMethod.get(m.name)}$type`;
      typeSigSet.add(`(type ${name} (func ${paramsStr} (result i32)))`)
    });
  });
  const typeSigStmts = Array.from(typeSigSet);

  const tableStmts = [
    ...typeSigStmts,
    `(table ${funcNums} funcref)`, 
    `(elem (i32.const 0)`,
    ...tableContents, 
    `)`
  ];

  return tableStmts.map(stmt => addIndent(stmt, indent));
}


export function codeGenAllGlobalVar(vars: string[], indent: number): string[] {
  const varSelf = [];
  for (let i = 0; i <= selfVarMax; i++) {
    varSelf.push(addIndent(`(global $self${i} (mut i32) (i32.const 0))`, indent));
  }
  var varUser = vars.map(v => addIndent(`(global $${v} (mut i32) (i32.const 0))`, 1));
  // const forLoopLabels = []
  // for (let i = 0; i < for_label; i++) {
  //   forLoopLabels.push(
  //     `(global $ForLoopIter${i} (mut i32) (i32.const 0))`,
  //     `(global $ForLoopCnt${i} (mut i32) (i32.const 0))`,
  //     `(global $ForLoopLen${i} (mut i32) (i32.const 0))`
  //   );
  // }
  // var varHelper = addIndent(forLoopLabels, 1).join("\n");
  // return varUser + varHelper;
  return [...varSelf, ...varUser];
}

export function compile(source: string): string {
  let ast = parseProgram(source);
  ast = tcProgram(ast);
  let basicIndent = 1;
  const emptyEnv = new Map<string, boolean>();
  const clsEnv = new Map<string, [ClsDef<Type>, number]>();
  const [vars, funs, classes, stmts] = varsFunsStmts(ast);
  // classes.map(c => clsEnv.set(c.name, c)); //move into table
  const tableStmts = codeGenTable(classes, clsEnv, basicIndent).join("\n");
  const clsCode: string[] = classes.map(c => codeGenCls(c, emptyEnv, clsEnv, basicIndent)).map(f => f.join("\n"));
  const allCls = clsCode.join("\n\n");
  const funsCode: string[] = funs.map(f => codeGenFun(f, emptyEnv, clsEnv, basicIndent)).map(f => f.join("\n"));
  const allFuns = funsCode.join("\n\n");
  const varAssign = ast.vardefs.map(v => codeGenVars(v, emptyEnv, basicIndent + 1));
  const allStmts = stmts.map(s => codeGenStmt(s, emptyEnv, clsEnv, basicIndent + 1)).flat();
  // const varDecls = vars.map(v => addIndent(`(global $${v} (mut i32) (i32.const 0))`, basicIndent));
  const varDecls = codeGenAllGlobalVar(vars, basicIndent);
  const varCode = [
    `(global $heap (mut i32) (i32.const 4))`,
    ...varDecls
  ].join("\n");

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
  (func $check_init (import "check" "check_init") (param i32) (result i32))
  (func $abs(import "imports" "abs") (param i32) (result i32))
  (func $min(import "imports" "min") (param i32) (param i32) (result i32))
  (func $max(import "imports" "max") (param i32) (param i32) (result i32))
  (func $pow(import "imports" "pow") (param i32) (param i32) (result i32))
  ${tableStmts}
  ${varCode}
  ${allFuns}
  ${allCls}
  
  (func (export "_start") ${retType}
    ${main}
    ${retVal}
  )
) 
  `;
}

