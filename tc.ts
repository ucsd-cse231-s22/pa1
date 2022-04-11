import { CondBody, Expr, FuncBody, FunDef, Literal, Program, Stmt, Type, VarDef } from "./ast";
import { ParseError } from "./cli/error";

type FunctionsEnv = Map<string, [Type[], Type]>;
type BodyEnv = Map<string, Type>;

export function tcExpr(e : Expr<any>, functions : FunctionsEnv, variables : BodyEnv) : Expr<Type> {
  switch(e.tag) {
    // case "number": return { ...e, a: "int" };
    // case "true": return { ...e, a: "bool" };
    // case "false": return { ...e, a: "bool" };
    case "literal":
      switch(e.value.tag) {
        case "number":
          return { ...e, a: "int" };
        case "bool":
          return { ...e, a: "bool" };
        case "none": 
          return {...e, a: "none"};
      }

    case "binop": {
      const nLHS = tcExpr(e.lhs, functions, variables);
      const nRHS = tcExpr(e.rhs, functions, variables);
      switch(e.op) {
        case "+":
        case "-":
        case "*":
        case "//":
        case "%":
          if (nLHS.a === "int" && nRHS.a === "int")
          {
            return { ...e, a: "int", lhs: nLHS, rhs: nRHS};
          }
          else {
            throw new TypeError(`Cannot apply operator '${e.op}' on
            types '${nLHS.a}' and '${nRHS.a}'`)
          } 
        case ">":
        case "<":
        case ">=":
        case "<=":
          if (nLHS.a === "int" && nRHS.a === "int") {
            return { ...e, a: "bool", lhs: nLHS, rhs: nRHS };
          }
          else {
            throw new TypeError(`Cannot apply operator '${e.op}' on
            types '${nLHS.a}' and '${nRHS.a}'`)
          }
        case "==":
        case "!=": 
          if (nLHS.a === nRHS.a) {
            return { ...e, a: "bool", lhs: nLHS, rhs: nRHS};
          }
          else {
            throw new TypeError(`Cannot apply operator '${e.op}' on
              types '${nLHS.a}' and '${nRHS.a}'`)
          }
        // case "and": return { ...e, a: "bool" };
        // case "or": return { ...e, a: "bool" };
        case "is":
          // TODO: "is" operation is not complete yet
          if (nRHS.a != "none" || nLHS.a != "none") {
            throw new TypeError(`Cannot apply operator '${e.op}' on
              types '${nLHS.a}' and '${nRHS.a}'`)
          }
          return { ...e, a: "bool", lhs: nLHS, rhs: nRHS};
        // default: throw new Error(`Unhandled op ${e.op}`);
      }
    }
    case "unop": {
      const nExpr = tcExpr(e.expr, functions, variables);
      switch (e.op) {
        case "-": 
          if (nExpr.a === "int")
            return { ...e, a: "int", expr: nExpr};
          else 
            throw new TypeError(`Cannot apply operator '${e.op}' on
              types '${nExpr.a}'`)
        case "not": 
          if (nExpr.a === "bool")
            return { ...e, a: "bool", expr: nExpr};
          else
            throw new TypeError(`Cannot apply operator '${e.op}' on
              types '${nExpr.a}'`)
        // default: throw new Error(`Unhandled op ${e.op}`);
      }
    }
    case "id": return { ...e, a: variables.get(e.name) };
    case "call":
      if(e.name === "print") {
        if(e.args.length !== 1) { throw new Error("print expects a single argument"); }
        const newArgs = [tcExpr(e.args[0], functions, variables)];
        const res : Expr<Type> = { ...e, a: "none", args: newArgs } ;
        return res;
      }
      if(!functions.has(e.name)) {
        throw new Error(`Not a function or class: ${e.name}`);
        // throw new Error(`function ${e.name} not found`);
      }

      const [args, ret] = functions.get(e.name);
      if(args.length !== e.args.length) {
        throw new Error(`Expected ${args.length} arguments; got ${e.args.length}`);
      }

      const newArgs = args.map((a, i) => {
        const argtyp = tcExpr(e.args[i], functions, variables);
        if(a !== argtyp.a) { 
          throw new Error(`Expected ${a}; got type ${argtyp} in parameter ${i + 1}`); 
        }
        return argtyp
      });

      return { ...e, a: ret, args: newArgs };
  }
}

export function tcStmt(s : Stmt<any>, functions : FunctionsEnv, variables : BodyEnv, currentReturn : Type) : Stmt<Type> {
  switch(s.tag) {
    case "assign": {
      const rhs = tcExpr(s.value, functions, variables);
      if (s?.typ) {
        variables.set(s.name, rhs.a);
      }
      if (!variables.has(s.name)) {
        throw new Error(`Not a variable: ${s.name}`);
      }
      else if (variables.get(s.name) !== rhs.a) {
        throw new Error(`Cannot assign ${rhs} to ${variables.get(s.name)}`);
      }
      // if(variables.has(s.name) && variables.get(s.name) !== rhs.a) {
      //   throw new Error(`Cannot assign ${rhs} to ${variables.get(s.name)}`);
      // }
      // else {
      //   variables.set(s.name, rhs.a);
      // }
      return { ...s, value: rhs };
    }
    case "expr": {
      const ret = tcExpr(s.expr, functions, variables);
      return { ...s, expr: ret };
    }
    case "return": {
      const valTyp = tcExpr(s.value, functions, variables);
      if(valTyp.a !== currentReturn) {
        throw new Error(`${valTyp} returned but ${currentReturn} expected.`);
      }
      return { ...s, value: valTyp };
    }
    case "pass": {
      return s;
    }
    case "if": {
      const ifstmt = tcCondBody(s.ifstmt, functions, variables, currentReturn);
      const elifstmt = s.elifstmt.map(p => tcCondBody(p, functions, variables, currentReturn));
      const elsestmt = s.elsestmt.map(p => tcStmt(p, functions, variables, currentReturn));
      return { ...s, ifstmt, elifstmt, elsestmt};
    }
    case "while": {
      const whilestmt = tcCondBody(s.whilestmt, functions, variables, currentReturn);
      return { ...s, whilestmt };
    }
  }
  return s;
}

export function tcCondBody(condbody: CondBody<any>, functions: FunctionsEnv, variables: BodyEnv, currentReturn: Type): CondBody<Type> {
  const newCond = tcExpr(condbody.cond, functions, variables);
  const newBody = condbody.body.map(bs => tcStmt(bs, functions, variables, currentReturn));
  return { cond: newCond, body: newBody};
}

export function tcFunc(f: FunDef<any>, functions: FunctionsEnv, variables: BodyEnv, currentReturn: Type) {
  const bodyvars = new Map<string, Type>(variables.entries());
  f.params.forEach(p => { bodyvars.set(p.name, p.typ) });
  const newvardefs = f.body.vardefs.map(v => tcVarDef(v, functions, bodyvars, variables))
  const newStmts = f.body.stmts.map(bs => tcStmt(bs, functions, bodyvars, f.ret));
  return { ...f, body: { vardefs: newvardefs, stmts: newStmts } };
}

export function tcVarDef(s: VarDef<any>, functions: FunctionsEnv, local: BodyEnv, global: BodyEnv): VarDef<Type> {
  const rhs = tcExpr(s.value, functions, local);
  if (local.has(s.var.name) && !global.has(s.var.name)) {
    throw new Error(`Duplicate declaration of identifier in the same scope: ${s.var.name}`);
  }
  else
    local.set(s.var.name, s.var.typ);
  if (local.get(s.var.name) !== rhs.a) {
    throw new Error(`Cannot assign ${rhs.a} to ${local.get(s.var.name)}`);
  }
  return { ...s, value: rhs };
}

export function tcProgram(p: Program<any>): Program<Type> {
  const functions = new Map<string, [Type[], Type]>();
  p.fundefs.forEach(s => {
    functions.set(s.name, [s.params.map(p => p.typ), s.ret]);
  });

  const globals = new Map<string, Type>();
  const vardefs = p.vardefs.map(s => tcVarDef(s, functions, globals, new Map<string, Type>()));
  const fundefs = p.fundefs.map(s => tcFunc(s, functions, globals, "none"));

  const stmts =  p.stmts.map(s => {
    const res = tcStmt(s, functions, globals, "none");
    return res;
  });
  return { vardefs, fundefs, stmts };
}