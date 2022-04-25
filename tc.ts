/* 
The type checker uses an array of BodyEnv as different level of scopes,
making it easier(?) to add keywords like global and nonlocal
This idea is borrowed from my classmate, Shanbin Ke.
*/
import { ClsDef, CondBody, Expr, FunDef, Literal, MemberExpr, Program, Stmt, Type, VarDef, objType, isCls, getTypeStr } from "./ast";
import { TypeError } from "./error"
// type FunctionsEnv = Map<string, [Type[], Type]>;
// type BodyEnv = Map<string, Type>;
type FunctionsEnv = Env<[Type[], Type]>;
type BodyEnv = Env<Type>;
// type Class
type ClassEnv = Env<OneClass<Type>>;

class Env<T> {
  decls: Map<string, T | undefined>[];
  constructor() {
    this.decls = [];
    this.addScope();
  }

  addScope() {
    this.decls.push(new Map<string, T>());
  }

  removeScope() {
    return this.decls.pop();
  }

  getCurScope() {
    return this.decls[this.decls.length - 1];
  }

  addDecl(id: string, value: T | undefined) {
    this.getCurScope().set(id, value);
  }

  lookUpVar(id: string, scope: number = -1): [boolean, T | undefined] {
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

class OneClass<T> {
  vars: Map<string, T>;
  funs: Map<string, [Type[], Type]>;
  constructor() {
    this.vars = new Map<string, T>();
    this.funs = new Map<string, [Type[], Type]>();
  }
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

export function tcExpr(e: Expr<any>, variables: BodyEnv, functions: FunctionsEnv, classes: ClassEnv): Expr<Type> {
  switch (e.tag) {
    case "literal":
      const lit = tcLit(e.value);
      return { ...e, value: lit, a: lit.a };

    case "binop": {
      const nLHS = tcExpr(e.lhs, variables, functions, classes);
      const nRHS = tcExpr(e.rhs, variables, functions, classes);
      const nLHStyp = getTypeStr(nLHS.a);
      const nRHStyp = getTypeStr(nRHS.a);
      switch (e.op) {
        case "+":
        case "-":
        case "*":
        case "//":
        case "%":
          if (nLHStyp === "int" && nRHStyp === "int") {
            return { ...e, a: "int", lhs: nLHS, rhs: nRHS };
          }
          else {
            throw new TypeError(`Cannot apply operator '${e.op}' on types '${nLHStyp}' and '${nRHStyp}'`);
          }
        case ">":
        case "<":
        case ">=":
        case "<=":
          if (nLHStyp === "int" && nRHStyp === "int") {
            return { ...e, a: "bool", lhs: nLHS, rhs: nRHS };
          }
          else {
            throw new TypeError(`Cannot apply operator '${e.op}' on types '${nLHStyp}' and '${nRHStyp}'`);
          }
        case "==":
        case "!=":
          if (nLHStyp === nRHStyp && !isCls(nLHS.a)) {
            return { ...e, a: "bool", lhs: nLHS, rhs: nRHS };
          }
          else {
            throw new TypeError(`Cannot apply operator '${e.op}' on types '${nLHStyp}' and '${nRHStyp}'`);
          }
        // case "and": return { ...e, a: "bool" };
        // case "or": return { ...e, a: "bool" };
        case "is":
          // TODO: "is" operation is not complete yet
          if (!isCls(nLHS.a) && !assignable(nRHS.a, nLHS.a)) {
            throw new TypeError(`Cannot apply operator '${e.op}' on types '${nLHStyp}' and '${nRHStyp}'`)
          }
          return { ...e, a: "bool", lhs: nLHS, rhs: nRHS };

        // default: throw new Error(`Unhandled op ${e.op}`);
      }
    }
    case "unop": {
      const nExpr = tcExpr(e.expr, variables, functions, classes);
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
        var newArgs = [tcExpr(e.args[0], variables, functions, classes)];
        return { ...e, a: "none", args: newArgs };
      }
      var [found, cls] = classes.lookUpVar(e.name);
      if (found) {
        return { ...e, a: {tag: "object", class: e.name} };
      }
      var [found, [args, ret]] = functions.lookUpVar(e.name, 0);
      if (!found) {
        throw new Error(`Not a function or class: ${e.name}`);
        // throw new Error(`function ${e.name} not found`);
      }

      // const [args, ret] = typ;
      if (args.length !== e.args.length) {
        throw new Error(`Expected ${args.length} arguments; got ${e.args.length}`);
      }

      var newArgs = args.map((a, i) => {
        const argtyp = tcExpr(e.args[i], variables, functions, classes);
        if (!assignable(a, argtyp.a)) {
          throw new TypeError(`Expected ${getTypeStr(a)}; got type ${getTypeStr(argtyp.a)} in parameter ${i + 1}`);
        }
        return argtyp;
      });
      return { ...e, a: ret, args: newArgs };
    case "getfield":
      return tcMemberExpr(e, variables, functions, classes);
    case "method":
      const newObj = tcExpr(e.obj, variables, functions, classes);
      if (newObj.a === "int" || newObj.a === "bool" || newObj.a === "none") {
        throw new Error(`There is no method named ${e.name} in class ${newObj.a}`);
      }
      var [found, cls] = classes.lookUpVar((newObj.a as objType).class);
      if (!found) {
        throw new Error("Should not happened");
      }
      if (!cls.funs.has(e.name)) {
        throw new Error(`There is no method named ${e.name} in class ${newObj.a}`);
      }
      // var newArgs = e.args.map(a => tcExpr(a, variables, functions, classes));
      const [argsTyp, retTyp] = cls.funs.get(e.name);
      if (argsTyp.length !== e.args.length) {
        throw new Error(`RUNTIME ERROR: Expected ${argsTyp.length} arguments; got ${e.args.length}`);
      }
      var newArgs = e.args.map((a, i) => {
        let newa = tcExpr(a, variables, functions, classes);
        // if (newa.a !== argsTyp[i]) {
        if (!assignable(argsTyp[i], newa.a)) {
          throw new TypeError(`Expected ${argsTyp[i]}; got type ${newa.a} in parameter ${i + 1}`);
        }
        return newa;
      });
      return { ...e, obj:newObj, args:newArgs, a: retTyp };
  }
}

function assignable(src: Type, tar: Type): boolean {
  /* 
  if the type tar can be assigned to original type src 
  */
  const s = getTypeStr(src);
  const t = getTypeStr(tar);
  if (s === t) {
    return true;
  }
  else if (isCls(src)) {
    return tar === "none";
  }
  return false;
}


export function tcMemberExpr(e: MemberExpr<any>, variables: BodyEnv, functions: FunctionsEnv, classes: ClassEnv): MemberExpr<Type> {
  const obj = tcExpr(e.obj, variables, functions, classes);
  if (obj.a === "int" || obj.a === "bool" || obj.a === "none") {
    throw new Error(`There is no attribute named ${e.field} in class ${obj.a}`);
  }
  // TODO: check if object is initialized
  const [found, cls] = classes.lookUpVar((obj.a as objType).class);  
  if (!found) {
    throw new Error(`Invalid type annotation; there is no class named: ${obj.a}`);
  }
  if (!cls.vars.has(e.field)) {
    throw new Error(`There is no attribute named ${e.field} in class ${obj.a}`);
  }
  return { ...e, a: cls.vars.get(e.field), obj };
}

export function tcStmt(s: Stmt<any>, variables: BodyEnv, 
  functions: FunctionsEnv, classes: ClassEnv,
  currentReturn: Type): Stmt<Type> {
  switch (s.tag) {
    case "assign": {
      const rhs = tcExpr(s.value, variables, functions, classes);
      // if (s?.typ) {
      //   variables.set(s.name, rhs.a);
      // }
      if (s.target.tag === "id"){
        const [found, typ] = variables.lookUpVar(s.target.name, -1); //locally
        if (!found) {
          const [allFound] = variables.lookUpVar(s.target.name, 0); // all scopes
          if (allFound)
            throw new Error(`Cannot assign variable that is not explicitly ` +
              `declared in this scope: ${s.target.name}`);
          else
            throw new ReferenceError(`Not a variable: ${s.target}`);
        }
        if (!assignable(typ, rhs.a)) {
          throw new TypeError(`Expect type '${getTypeStr(typ)}'; got type '${getTypeStr(rhs.a)}'`);
        }
        if (isCls(typ)) {
          // TODO: tag initialized for object
        }

        return { ...s, value: rhs };
      } else if (s.target.tag === "getfield") {
        const target = tcMemberExpr(s.target, variables, functions, classes);
        if (!assignable(target.a, rhs.a)) {
          throw new TypeError(`Expect type '${getTypeStr(target.a)}'; got type '${getTypeStr(rhs.a)}'`);
        }
        return { ...s, target, value: rhs};

      }
      else {
        throw new Error("not implemented");
      }
      
    }
    case "expr": {
      const ret = tcExpr(s.expr, variables, functions, classes);
      return { ...s, expr: ret };
    }
    case "return": {
      const valTyp = tcExpr(s.value, variables, functions, classes);
      if (!assignable(currentReturn, valTyp.a)) {
        throw new TypeError(`${getTypeStr(valTyp.a)} returned but ${getTypeStr(currentReturn)} expected.`);
      }
      return { ...s, value: valTyp };
    }
    case "pass": {
      return s;
    }
    case "if": {
      const ifstmt = tcCondBody(s.ifstmt, variables, functions, classes, currentReturn);
      const elifstmt = s.elifstmt.map(p => tcCondBody(p, variables, functions, classes, currentReturn));
      const elsestmt = s.elsestmt.map(p => tcStmt(p, variables, functions, classes, currentReturn));
      return { ...s, ifstmt, elifstmt, elsestmt };
    }
    case "while": {
      const whilestmt = tcCondBody(s.whilestmt, variables, functions, classes, currentReturn);
      return { ...s, whilestmt };
    }
  }
  return s;
}

export function tcCondBody(condbody: CondBody<any>, variables: BodyEnv, 
  functions: FunctionsEnv, classes: ClassEnv,
  currentReturn: Type): CondBody<Type> {
  const newCond = tcExpr(condbody.cond, variables, functions, classes);
  const newBody = condbody.body.map(bs => tcStmt(bs, variables, functions, classes, currentReturn));
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

export function tcFuncDef(f: FunDef<any>, variables: BodyEnv, functions: FunctionsEnv, classes: ClassEnv) {
  // const bodyvars = new Map<string, Type>(variables.entries());
  if (f.ret !== "none" && !f.body.stmts.some(returnable)) {
    throw new TypeError(`All path in this function/method ` +
      `must have a return statement: ${f.name}`);
  }
  // let bodyvars = new Map<string, Type>();
  variables.addScope();
  // functions.addScope();
  f.params.forEach(p => { variables.addDecl(p.name, p.typ) });
  const newvardefs = f.body.vardefs.map(v => tcVarDef(v, variables, classes));
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
  const newStmts = f.body.stmts.map(bs => tcStmt(bs, variables, functions, classes, f.ret));
  variables.removeScope();
  // functions.removeScope();
  return { ...f, body: { vardefs: newvardefs, stmts: newStmts } };
}

export function tcClsDef(c: ClsDef<any>, variables: BodyEnv,
  functions: FunctionsEnv, classes: ClassEnv): ClsDef<Type> {
  const [found] = classes.lookUpVar(c.super);
  if (!found) {
    throw new Error(`Super class not defined: ${c.super}`)
  }
  // the class name must be unique, which is guaranteed in parser
  variables.addScope();
  functions.addScope();
  c.methods.forEach(m => {
    functions.addDecl(m.name, [m.params.map(p => p.typ), m.ret]);
  });
  variables.addDecl("self", {tag:"object", class: c.name});
  const newFields = c.fields.map(v => tcVarDef(v, variables, classes));
  classes.addDecl(c.name, {
    vars: variables.getCurScope(), 
    funs: functions.getCurScope(),
  });
  const newMethods = c.methods.map(s => tcFuncDef(s, variables, functions, classes));
  // no redefinition error
  // const newMethods = c.methods.map(s => {
  //   let method = tcFuncDef(s, variables, functions, classes);
  //   return {...method, name: `${c.name}$${method.name}`}
  // });
  classes.addDecl(c.name, { 
    vars: variables.removeScope(), 
    funs: functions.removeScope()
  });
  let indexOfField = new Map<string, number>();
  newFields.forEach((f, i) => indexOfField.set(f.typedvar.name, i));
  return { ...c, methods: newMethods, fields: newFields, indexOfField };
}

export function tcVarDef(s: VarDef<any>, local: BodyEnv, classes: ClassEnv): VarDef<Type> {
  const rhs = tcLit(s.init);
  // const [found, typ] = local.lookUpVar(s.typedvar.name, -1);
  local.addDecl(s.typedvar.name, s.typedvar.typ); // no redefinition error
  if (!isCls(s.typedvar.typ)) {
    if (s.typedvar.typ !== rhs.a) {
      throw new TypeError(`Expect type '${s.typedvar.typ}'; ` +
        `got type '${rhs.a}'`);
    }
  } 
  else {
    const clsName = s.typedvar.typ;
    const [found] = classes.lookUpVar((clsName as objType).class);
    if (!found) {
      throw new Error(`Invalid type annotation; ` + 
        `there is no class named: ${clsName}`);
    }
    if (rhs.a !== "none") {
      throw new TypeError(`Expect type '${clsName}'; ` +
        `got type '${rhs.a}'`);
    }
  } 
  return { ...s, init: rhs };
}

export function tcProgram(p: Program<any>): Program<Type> {
  const functions = new Env<[Type[], Type]>();
  p.fundefs.forEach(s => {
    functions.addDecl(s.name, [s.params.map(p => p.typ), s.ret]);
  }); // no redefinition error
  const classes = new Env<OneClass<Type>>();
  classes.addDecl("object", undefined);
  p.clsdefs.forEach(c => {
    classes.addDecl(c.name, undefined);
  })

  const variables = new Env<Type>();
  const vardefs = p.vardefs.map(s => tcVarDef(s, variables, classes));
  const clsdefs = p.clsdefs.map(s => tcClsDef(s, variables, functions, classes));
  const fundefs = p.fundefs.map(s => tcFuncDef(s, variables, functions, classes));

  const stmts = p.stmts.map(s => {
    const res = tcStmt(s, variables, functions, classes, "none");
    return res;
  });
  return { ...p, vardefs, fundefs, clsdefs, stmts };
}