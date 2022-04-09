export type Type =
  | "int"
  | "bool"
  | "none"

export type Parameter =
  | { name: string, typ: Type }

export type Stmt<A> =
  | { a?: A, tag: "assign", name: string, value: Expr<A> }
  | { a?: A, tag: "expr", expr: Expr<A> }
  | { a?: A, tag: "define", name: string, params: Parameter[], ret: Type, body: Stmt<A>[] }
  | { a?: A, tag: "return", value: Expr<A> }
  | { a?: A, tag: "pass"}

export type Expr<A> = 
  | { a?: A, tag: "number", value: number }
  | { a?: A, tag: "true" }
  | { a?: A, tag: "false" }
  | { a?: A, tag: "binop", op: Op, lhs: Expr<A>, rhs: Expr<A> }
  | { a?: A, tag: "unop", op: UnOp, expr: Expr<A> }
  | { a?: A, tag: "id", name: string, global?: boolean }
  | { a?: A, tag: "call", name: string, args: Expr<A>[] }

// export enum UnOp {
//   Plus = "+",
//   Minus = "-",
// }

// export enum BinOp {
//   Plus = "+",
//   Minus = "-",
//   Mul = "*"
// }

const ops = {"+": true, "-": true, ">": true, "and": true, "or": true};
export type Op = keyof (typeof ops);
export function isOp(maybeOp : string) : maybeOp is Op {
  return maybeOp in ops;
}

const unops = { "-": true, "not": true};
export type UnOp = keyof (typeof unops);
export function isUnOp(maybeOp: string): maybeOp is UnOp {
  return maybeOp in unops;
}