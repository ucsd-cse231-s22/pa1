
export type Stmt = {
    tag: "define",
    name: string,
    value: Expr
  }
  | 
  {
    tag: "print",
    value: Expr
  }
  |
  {
    tag: "expr",
    expr: Expr
  }

export type Expr = {
    tag: "op",
    op: Op,
    left: Expr,
    right: Expr
  }
  |
  {
    tag: "num",
    value: number
  }
  |
  {
    tag: "id",
    name: string
  }

export enum Op { Plus, Minus } ;
