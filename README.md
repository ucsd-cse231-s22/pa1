# PA1: Binary Operators and Builtin Functions

In this programming assignment, you will start from a compiler that we
(mostly) provide based on one from class. You will add binary arithmetic
operators and a few built-in Python functions.

## Problem Specification

The grammar of the language you should support is:

```
program := <stmt>
stmt := <name> = <expr>
      | <expr>
expr := <number>
      | <name>
      | <expr> <op> <expr>         (new!)
      | <builtin1>(<expr>)
      | <builtin2>(<expr>, <expr>) (new!)
op   := + | - | *
builtin1 := print | abs
builtin2 := max | min | pow
number := 32-bit integer literals
```

Your task will be to make it so input programs using the binary operators,
and the builtin functions listed above, have the following behavior:

- `+`, `-`, and `*` should use the corresponding WASM operators `i32.add`,
`i32.sub`, and `i32.mul` on the two operands after evaluating them
- `abs` should produce the absolute value of its argument
- `max`/`min`/`pow` should take two arguments and produce the larger of the
numbers, the smaller of the numbers, and the first number raised to the
other's power, respectively

Your implementation is up to you, but a likely approach is:

- Add expressions for binary operators and builtin2 to `ast.ts`
- Add parsing support for these expressions in `parser.ts`
- Add code generation for these expressions in `compiler.ts`
- Add TypeScript functions to implement the new builtins in `nodestart.ts`
and/or `webstart.ts`

We recommend implementing them one at a time (don't try to do both
expressions at once), so that you can test more incrementally.

## Testing

