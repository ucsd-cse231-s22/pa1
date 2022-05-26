import { assertPrint, assertFail, assertTCFail, assertTC, assertFailContain } from "./asserts.test";
import { NUM, NONE, CLASS } from "./helpers.test"

describe("PA4 tests for nested function", () => {
    assertPrint("call a simple nested function", `
def f() -> int:
    def g(a: int) -> int:
        return a + 1
    return g(4) + g(5)
print(f())
    `, [`11`]);

    assertPrint("call a deep nested function", `
    def f() -> int:
        def g(a: int) -> int:
            def h(a: int) -> int:
                return a + 2
            return h(a) + 1
        def g1(a: int) -> int:
            return a + 1
        return g(4) + g1(5)
    print(f())
    `, [`13`]);

    assertPrint("call a nested function inside class method", `
class A(object):
    def f(self: A, a: int) -> int:
        def g(a: int) -> int:
            return a * 2
        return g(a)
a: A = None
a = A()
print(a.f(4))
    `, [`8`]);

    assertPrint("call a function referencing a non-local variable", `
    def f(a: int) -> int:
        def g(b: int) -> int:
            return a + b
        return g(4)
    print(f(3))
    `, [`7`]);

    assertPrint("call a function referencing a global variable", `
    a: int = 1
    def f() -> int:
        def g(b: int) -> int:
            return a + b
        return g(4)
    print(f())
    `, [`5`]);

    assertPrint("call a function writing to a non local variable", `
    def f(a: int) -> int:
        def g(b: int) -> int:
            nonlocal a
            a = a + 3
            return a + b
        return g(2) + g(2)
    print(f(1))
    `, [`15`]);


    assertPrint("call a deep nested function writing to a non local variable", `
    def f(a: int) -> int:
        def g(b: int) -> int:
            def h(c: int) -> int:
                nonlocal b
                b = b + 3
                return a + b
            return h(3) + h(3)
        return g(2)
    print(f(1))
    `, [`15`]);


    assertPrint("call a deep nested function reading and writing to same non local variable", `
    def f(a: int) -> int:
        def g(b: int) -> int:
            def h(c: int) -> int:
                nonlocal b
                return a + b
            def h1(c: int) -> int:
                nonlocal b
                b = b + 3
                return a + b
            return h(3) + h1(3)
        return g(2)
    print(f(1))
    `, [`9`]);

    assertPrint("call a deep nested function writing to a global variable", `
    b: int = 2
    def f(a: int) -> int:
        def g(b: int) -> int:
            def h(c: int) -> int:
                global b
                b = b + 3
                return a + b
            return h(3) + h(3)
        return g(2)
    print(f(1))
    `, [`15`]);
});



describe("PA4 tests for global and nonlocal", () => {
    // 1
    assertPrint("global-var", `
x:int = 1
def f():
    global x
    x = x + 1
f()
print(x)`, ["2"]);
    assertFailContain("global-redefine", `
x:int = 1
def f(x:int):
    global x
    x = x + 1`, `Duplicate declaration`);
    assertPrint("global-order", `
def f():
    y:int = 1
    global x
    z:int = 2
    x = x + y + z
x:int = 5
f()
print(x)`, [`8`]);
    assertFailContain("no-scope", `
global x
x:int = 5`, `not parse`);
    assertPrint("global-in-nested-1", `
x:int = 1
def f()->int:
    global x
    def g()->int:
        return x
    x = x + 1
    return g()
print(f())`, [`2`]);
    assertFailContain("nonlocal-of-a-global", `
x:int = 1
def f()->int:
    global x
    def g()->int:
        nonlocal x
        return x + 1
    return g()
print(f())`, `not a nonlocal`);
    assertPrint("global-in-nested-2", `
x:int = 1
def f():
    global x
    def g():
        global x
        x = x + 1
    g()
    x = x + 1
f()
print(x)`, [`3`]);

});
