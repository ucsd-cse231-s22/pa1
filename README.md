# PA1: Binary Operators and Builtin Functions

In this programming assignment, you will start from a compiler that we
(mostly) provide based on one from class. You will add binary arithmetic
operators and a few built-in Python functions.

## Problem Specification

The grammar of the language you should support is:

```
program := <stmt> ...
stmt := <name> = <expr>
      | <expr>
expr := <number>
      | <name>
      | <expr> <op> <expr>         (you!)
      | <builtin1>(<expr>)
      | <builtin2>(<expr>, <expr>) (you!)
op   := + | - | *                  (you!)
builtin1 := print | abs
builtin2 := max | min | pow        (you!)
number := 32-bit integer literals
```

You can see this (mostly) reflected in the `ast.ts`:

```
export type Stmt =
  | { tag: "define", name: string, value: Expr }
  | { tag: "expr", expr: Expr }

export type Expr =
    { tag: "num", value: number }
  | { tag: "id", name: string }
  | { tag: "builtin1", name: string, arg: Expr }
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
and `webstart.ts`
- Test this as you go by adding tests in the tests/ directory
- Watch your program work in the browser by opening build/index.html in a
browser of your choice.

We recommend implementing them one at a time (don't try to do both
expressions at once), so that you can test more incrementally.

## Testing

We use the [Mocha test framework](https://mochajs.org/) along with 
[Chai assertion library](https://www.chaijs.com/) to simplify testing the 
compiler. We provide some starter testing code in `tests/parser.test.ts` and 
`tests/runner.test.ts`. We included comments in these files to get you started
testing the compiler and we added to-dos where we expect additional tests.
We encourage you to test other parts of the compiler individually if you
find yourself stuck, like `compile`.


## Building and Running

To get started, make sure you have NodeJS installed
[https://nodejs.org/en/download/](https://nodejs.org/en/download/), and check
out this repository. In the repository, run

```
npm install
```

This will download and install the necessary WASM and Typescript dependencies.

You can build `index.html` by running:

```
npm run build-web
```

And then open the created file in `build/index.html` in a browser to get the
textbox and run button for your code.

You can run test suits using the following command, and it will print a summary
of passing and failing tests:

```
npm test
```

## Writeup

In a file called `written.txt`, answer the following questions:

1. Approximately how many hours did it take you to complete the assignment?
What parts took the longest?
2. What advice would you give yourself if you were to start the assignment
from the beginning?
3. What resources did you find most helpful in completing the assignment?
4. Who (if anyone) in the class did you work with on the assignment?


## Submission

You can submit your code to the `pa1` assignment on Gradescope, which will be
released Friday and has a set of autograder tests to check your work.

## Grading

Most of your grade on this assignment comes simply from the autograded
component – we want to make sure you have everything built successfully. A
note that future assignments will have a larger written component with design
questions.

- 90% Autograder Tests
- 10% Written Responses

## Useful References

- Lezer, particularly TreeCursor
[https://lezer.codemirror.net/docs/ref/#tree.TreeCursor](https://lezer.codemirror.net/docs/ref/#tree.TreeCursor),
which we are using for a parser library
- lezer-python, which is an open-source grammar for Python developed for lezer [https://github.com/lezer-parser/python/blob/master/src/python.grammar](https://github.com/lezer-parser/python/blob/master/src/python.grammar)
- Typescript [https://www.typescriptlang.org/docs](https://www.typescriptlang.org/docs)
- A useful WASM quick tutorial [https://learnxinyminutes.com/docs/wasm/](https://learnxinyminutes.com/docs/wasm/)
- A description of tagged unions in Typescript [https://basarat.gitbook.io/typescript/type-system/discriminated-unions](https://basarat.gitbook.io/typescript/type-system/discriminated-unions), which is how the AST we chose is structured
