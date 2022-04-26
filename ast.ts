export type Program<A> = 
  { vardefs: VarDef<A>[], fundefs: FunDef<A>[], clsdefs:ClsDef<A>[], stmts: Stmt<A>[] }

export type VarDef<A> =
  { typedvar: TypedVar, init: Literal<A> };

export type FunDef<A> = 
  { name: string, params?: TypedVar[], ret?: Type, body: FuncBody<A> }

export type FuncBody<A> = 
  { vardefs: VarDef<A>[],  stmts: Stmt<A>[] }

export type TypedVar =
  | { name: string, typ: Type }

export type ClsDef<A> = 
  { tag: "class", name: string, super: string, methods: FunDef<A>[], fields: VarDef<A>[], 
    builtins?: Map<string, FunDef<A>>, indexOfField?: Map<string, number> }

export type ObjType = { tag: "object", class: string }
export type Type =
  | "int"
  | "bool"
  | "none"
  | ObjType

export type Literal<A> = 
  | { a?: A, tag: "number", value: number }
  | { a?: A, tag: "bool", value: boolean }
  | { a?: A, tag: "none" }


export type CondBody<A> = 
  { cond: Expr<A>, body: Stmt<A>[]}

export type MemberExpr<A> = 
  { a?: A, tag: "getfield", obj: Expr<A>, field: string }

export type LValue<A> = 
  | { a?: A, tag: "id", name: string, global?: boolean }
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
  | { a?: A, tag: "id", name: string, global?: boolean }
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

export function isCls(maybeCls: Type): maybeCls is Type {
  return (maybeCls !== "int") && (maybeCls !== "bool") && (maybeCls !== "none")
}


export function getTypeStr(typ: Type): string {
  if (typeof typ === "string")
    return typ;
  else
    return (typ as ObjType).class
}