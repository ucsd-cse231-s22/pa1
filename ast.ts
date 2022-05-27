export type Program<A> = 
  { vardefs: VarDef<A>[], fundefs: FunDef<A>[], clsdefs:ClsDef<A>[], stmts: Stmt<A>[] }

export type VarDef<A> =
  { typedvar: TypedVar, init: Literal<A> };

export type FunDef<A> = 
  { name: string, params?: TypedVar[], ret?: Type, body: FuncBody<A> }

export type FuncBody<A> = 
  { vardefs: VarDef<A>[], fundefs?: FunDef<A>[], decls?: ScopeVar<A>[], stmts: Stmt<A>[] }

export type TypedVar =
  | { name: string, typ: Type }

export type ScopeVar<A> = 
  | { a?:A, name: string, nonlocal: boolean };

export type ClsDef<A> = 
  { tag: "class", name: string, super: string, 
    methods: FunDef<A>[], fields: VarDef<A>[], 
    indexOfField?: Map<string, number>,
    indexOfMethod?: Map<string, number>, 
    ptrOfMethod?: Map<string, string> }

export type ObjType = { tag: "object", class: string, ref?: boolean, refed?: boolean }
export type Type =
  | { tag: "int", ref?: boolean, refed?: boolean}
  | { tag: "bool", ref?: boolean, refed?: boolean}
  | { tag: "none", ref?: boolean, refed?: boolean }
  | ObjType

export type Literal<A> = 
  | { a?: A, tag: "number", value: number }
  | { a?: A, tag: "bool", value: boolean }
  | { a?: A, tag: "none" }


export type CondBody<A> = 
  { cond: Expr<A>, body: Stmt<A>[]}

export type MemberExpr<A> = 
  { a?: A, tag: "getfield", obj: Expr<A>, field: string }

export type IdVar<A> = 
  | { a?: A, tag: "id", name: string, global?: boolean }

export type LValue<A> = 
  | IdVar<A>
  | MemberExpr<A>

export type Stmt<A> =
  | { a?: A, tag: "assign", target: LValue<A>, value: Expr<A>, typ?: Type }
  | { a?: A, tag: "expr", expr: Expr<A> }
  | { a?: A, tag: "return", value: Expr<A> }
  | { a?: A, tag: "pass"}
  | { a?: A, tag: "if", ifstmt: CondBody<A>, elifstmt?: CondBody<A>[], elsestmt?: Stmt<A>[]}
  | { a?: A, tag: "while", whilestmt: CondBody<A> }


export type Expr<A> = 
  | { a?: A, tag: "literal", value: Literal<A> }
  | { a?: A, tag: "binop", op: BinOp, lhs: Expr<A>, rhs: Expr<A> }
  | { a?: A, tag: "unop", op: UnOp, expr: Expr<A> }
  | IdVar<A>
  | { a?: A, tag: "call", name: string, args: Expr<A>[] }
  | MemberExpr<A>
  | { a?: A, tag: "method", obj: Expr<A>, name: string, args: Expr<A>[]}


const binops = {
  "+": true, "-": true, "*": true, "//": true, "%": true,
  ">": true, "<": true, ">=": true, "<=": true, 
  "!=": true, "==": true,
  // "and": true, "or": true,
  "is": true
};
export type BinOp = keyof (typeof binops);
export function isOp(maybeOp : string) : maybeOp is BinOp {
  return maybeOp in binops;
}

const unops = { "-": true, "not": true};
export type UnOp = keyof (typeof unops);
export function isUnOp(maybeOp: string): maybeOp is UnOp {
  return maybeOp in unops;
}



export function isAssignable(src: Type, tar: Type): boolean {
  /* 
  if the type tar can be assigned to original type src 
  */
  return isTypeEqual(src, tar) || isSubType(src, tar);
}

export function isSubType(src: Type, tar: Type): boolean {
  // return if tar is a subType of src
  if (isCls(src)) {
    return isTypeEqual(tar, {tag: "none"});
  }
}

export function isTypeEqual(typ1: Type, typ2: Type): boolean {
  return getTypeStr(typ1) === getTypeStr(typ2);
}


export function getTypeStr(typ: Type): string {
  if (isSimpleType(typ))
    return typ.tag;
  else if (isCls(typ))
    return (typ as ObjType).class
}

export function isSimpleType(maybeTyp: Type): boolean {
  return (maybeTyp.tag === "int") || (maybeTyp.tag === "bool") || (maybeTyp.tag === "none");
}

export function isCls(maybeCls: Type): maybeCls is ObjType {
  return (maybeCls as ObjType).class !== undefined;
  // return "class" in (maybeCls as ObjType);
}

export function isRefType(maybeTyp: Type): boolean {
  return maybeTyp.ref !== undefined;
  // return "class" in (maybeCls as ObjType);
}

export const keywords = new Set<string>([
  "int", "bool", "None", "def", "if", "while", "else", "for", "elif", "return", "class",
  "global", "nonlocal", "str", "list", "import", "try", "except", "False", "True", "and",
  "as", "assert", "async", "await", "break", "continue", "del", "finally", "from", "in",
  "is", "lambda", "not", "or", "pass", "raise", "with", "yield"
]);

const idReg = /^[a-zA-Z\_][0-9a-zA-Z_]*/;

export function isValidIdentifier(id: string): boolean {
  if (keywords.has(id)) {
    return false;
  }
  return idReg.test(id);
}