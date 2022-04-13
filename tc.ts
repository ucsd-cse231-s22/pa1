/* 
The type checker uses an array of BodyEnv as different level of scopes,
making it easier(?) to add keywords like global and nonlocal
This idea is borrowed from my classmate, Shanbin Ke.
*/
import { type } from "os";
import { CondBody, Expr, FunDef, Literal, Program, Stmt, Type, VarDef } from "./ast";

// type FunctionsEnv = Map<string, [Type[], Type]>;
// type BodyEnv = Map<string, Type>;
type FunctionsEnv = Env<[Type[], Type]>;
type BodyEnv = Env<Type>;


class Env<T> {
  decls: Map<string, T>[];
  constructor() {
    this.decls = [];
    this.addScope();
  }

  addScope() {
    this.decls.push(new Map<string, T>());
  }

  removeScope() {
    this.decls.pop();
  }

  getCurScope() {
    return this.decls[this.decls.length - 1];
  }

  addDecl(id: string, value: T) {
    this.getCurScope().set(id, value);
  }

  lookUpVar(id: string, scope: number = -1): [boolean, T] {
    // scope: 0 - search all scopes
    //        1 - search globally (only the global vars)
    //       -1 - search locally (only the last scope, current scope)
    // return: True - found, Type: type for id
    //         False - not found, Type: "none"
    let start: number = this.decls.length - 1;
    let end: number = 0;
    if (scope === 1)
      start = 0;
    else if (scope === -1)
      end = this.decls.length - 1;
    for (let i = start; i >= end; i--) {
      if (this.decls[i].has(id))
        return [true, this.decls[i].get(id)];
    }
    return [false, undefined];
  }
}

export function tcExpr(e: Expr<any>, functions: FunctionsEnv, variables: BodyEnv): Expr<Type> {
  switch (e.tag) {
    case "literal":
      const lit = tcLit(e.value);
      return { ...e, value: lit, a: lit.a };

    case "binop": {
      const nLHS = tcExpr(e.lhs, functions, variables);
      const nRHS = tcExpr(e.rhs, functions, variables);
      switch (e.op) {
        case "+":
        case "-":
        case "*":
        case "//":
        case "%":
          if (nLHS.a === "int" && nRHS.a === "int") {
            return { ...e, a: "int", lhs: nLHS, rhs: nRHS };
          }
          else {
            throw new TypeError(`Cannot apply operator '${e.op}' on types '${nLHS.a}' and '${nRHS.a}'`);
          }
        case ">":
        case "<":
        case ">=":
        case "<=":
          if (nLHS.a === "int" && nRHS.a === "int") {
            return { ...e, a: "bool", lhs: nLHS, rhs: nRHS };
          }
          else {
            throw new TypeError(`Cannot apply operator '${e.op}' on types '${nLHS.a}' and '${nRHS.a}'`);
          }
        case "==":
        case "!=":
          if (nLHS.a === nRHS.a) {
            return { ...e, a: "bool", lhs: nLHS, rhs: nRHS };
          }
          else {
            throw new TypeError(`Cannot apply operator '${e.op}' on types '${nLHS.a}' and '${nRHS.a}'`);
          }
        // case "and": return { ...e, a: "bool" };
        // case "or": return { ...e, a: "bool" };
        case "is":
          // TODO: "is" operation is not complete yet
          if (nRHS.a != "none" || nLHS.a != "none") {
            throw new TypeError(`Cannot apply operator '${e.op}' on types '${nLHS.a}' and '${nRHS.a}'`)
          }
          return { ...e, a: "bool", lhs: nLHS, rhs: nRHS };
        // default: throw new Error(`Unhandled op ${e.op}`);
      }
    }
    case "unop": {
      const nExpr = tcExpr(e.expr, functions, variables);
      switch (e.op) {
        case "-":
          if (nExpr.a === "int")
            return { ...e, a: "int", expr: nExpr };
          else
            throw new TypeError(`Cannot apply operator '${e.op}' on type '${nExpr.a}'`)
        case "not":
          if (nExpr.a === "bool")
            return { ...e, a: "bool", expr: nExpr };
          else
            throw new TypeError(`Cannot apply operator '${e.op}' on type '${nExpr.a}'`)
        // default: throw new Error(`Unhandled op ${e.op}`);
      }
    }
    case "id":
      // search for the id globally
      var [found, typ] = variables.lookUpVar(e.name, 0)
      if (!found)
        throw new ReferenceError(`Not a variable: ${e.name}`);
      return { ...e, a: typ };

    case "call":
      if (e.name === "print") {
        if (e.args.length !== 1)
          throw new Error("print expects a single argument");
        const newArgs = [tcExpr(e.args[0], functions, variables)];
        return { ...e, a: "none", args: newArgs };
      }
      var [found, [args, ret]] = functions.lookUpVar(e.name, 0)
      if (!found) {
        throw new Error(`Not a function or class: ${e.name}`);
        // throw new Error(`function ${e.name} not found`);
      }

      // const [args, ret] = typ;
      if (args.length !== e.args.length) {
        throw new Error(`Expected ${args.length} arguments; got ${e.args.length}`);
      }

      const newArgs = args.map((a, i) => {
        const argtyp = tcExpr(e.args[i], functions, variables);
        if (a !== argtyp.a) {
          throw new TypeError(`Expected ${a}; got type ${argtyp} in parameter ${i + 1}`);
        }
        return argtyp;
      });
      return { ...e, a: ret, args: newArgs };
  }
}

export function tcStmt(s: Stmt<any>, functions: FunctionsEnv,
  variables: BodyEnv, currentReturn: Type): Stmt<Type> {
  switch (s.tag) {
    case "assign": {
      const rhs = tcExpr(s.value, functions, variables);
      // if (s?.typ) {
      //   variables.set(s.name, rhs.a);
      // }
      const [found, typ] = variables.lookUpVar(s.name, -1); //locally
      if (!found) {
        const [allFound] = variables.lookUpVar(s.name, 0); // all scopes
        if (allFound)
          throw new Error(`Cannot assign variable that is not explicitly declared in this scope: ${s.name}`);
        else
          throw new ReferenceError(`Not a variable: ${s.name}`);
      }
      else if (typ !== rhs.a) {
        throw new TypeError(`Expect type '${typ}'; got type '${rhs.a}'`);
      }
      return { ...s, value: rhs };
    }
    case "expr": {
      const ret = tcExpr(s.expr, functions, variables);
      return { ...s, expr: ret };
    }
    case "return": {
      const valTyp = tcExpr(s.value, functions, variables);
      if (valTyp.a !== currentReturn) {
        throw new TypeError(`${valTyp} returned but ${currentReturn} expected.`);
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
      return { ...s, ifstmt, elifstmt, elsestmt };
    }
    case "while": {
      const whilestmt = tcCondBody(s.whilestmt, functions, variables, currentReturn);
      return { ...s, whilestmt };
    }
  }
  return s;
}

export function tcCondBody(condbody: CondBody<any>, functions: FunctionsEnv,
  variables: BodyEnv, currentReturn: Type): CondBody<Type> {
  const newCond = tcExpr(condbody.cond, functions, variables);
  const newBody = condbody.body.map(bs => tcStmt(bs, functions, variables, currentReturn));
  if (newCond.a !== "bool") {
    throw new TypeError(`Condition expression cannot be of type '${newCond.a}'`);
  }
  return { cond: newCond, body: newBody };
}

export function returnable(stmt: Stmt<Type>): boolean {
  if (stmt.tag === "return")
    return true;
  else if (stmt.tag === "if") {
    if (stmt.elsestmt.length === 0)
      return false;
    let res = stmt.ifstmt.body.some(returnable)
      && stmt.elsestmt.some(returnable)
      && stmt.elifstmt.map(condstmt =>
        condstmt.body.some(returnable)).every(x => x)
    return res;
  }
  return false;
}

export function tcFunc(f: FunDef<any>, functions: FunctionsEnv, variables: BodyEnv) {
  // const bodyvars = new Map<string, Type>(variables.entries());
  if (f.ret !== "none" && !f.body.stmts.some(returnable)) {
    throw new Error(`All path in this function/method ` +
      `must have a return statement: ${f.name}`);
  }
  // let bodyvars = new Map<string, Type>();
  variables.addScope();
  // functions.addScope();
  f.params.forEach(p => { variables.addDecl(p.name, p.typ) });
  const newvardefs = f.body.vardefs.map(v => tcVarDef(v, variables));
  // this is for adding the global variable
  // if we allow nested functions 
  // we will need to add an new scope of global env for the inside function
  // with new globel env = global + body vars(?)
  // decision making: if inside function could use the outside variables
  // variables.forEach((v, k) => {
  //   if (!bodyvars.has(k))
  //     bodyvars.set(k, v)
  // });
  // above: solved by this new scope strategy
  const newStmts = f.body.stmts.map(bs => tcStmt(bs, functions, variables, f.ret));
  variables.removeScope();
  // functions.removeScope();
  return { ...f, body: { vardefs: newvardefs, stmts: newStmts } };
}

export function tcLit(lit: Literal<any>): Literal<Type> {
  switch (lit.tag) {
    case "number":
      return { ...lit, a: "int" };
    case "bool":
      return { ...lit, a: "bool" };
    case "none":
      return { ...lit, a: "none" };
  }
}

export function tcVarDef(s: VarDef<any>, local: BodyEnv): VarDef<Type> {
  const rhs = tcLit(s.init);
  const [found, typ] = local.lookUpVar(s.typedvar.name, -1);
  if (found)
    throw new Error(`Duplicate declaration of identifier ` +
      `in the same scope: ${s.typedvar.name}`);
  else
    local.addDecl(s.typedvar.name, s.typedvar.typ);
  if (s.typedvar.typ !== rhs.a) {
    throw new TypeError(`Expect type '${s.typedvar.typ}'; ` +
      `got type '${rhs.a}'`);
  }
  return { ...s, init: rhs };
}

export function tcProgram(p: Program<any>): Program<Type> {
  const functions = new Env<[Type[], Type]>();
  p.fundefs.forEach(s => {
    functions.addDecl(s.name, [s.params.map(p => p.typ), s.ret]);
  });

  const variables = new Env<Type>();
  const vardefs = p.vardefs.map(s => tcVarDef(s, variables));
  const fundefs = p.fundefs.map(s => tcFunc(s, functions, variables));

  const stmts = p.stmts.map(s => {
    const res = tcStmt(s, functions, variables, "none");
    return res;
  });
  return { vardefs, fundefs, stmts };
}