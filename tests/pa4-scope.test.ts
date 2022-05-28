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

describe("PA4 tests for global and nonlocal", () => {
    // 1
    assertFailContain("global-var", `
def add_b():
    global b
    def do_global():
        b = b + 1
        print(b)
    b = 0
    do_global()
    print(b)
b:int = 0
add_b()`, `not assign`);
    assertPrint("global variable", `
def add_b():
    def do_global():
        nonlocal b
        b = b + 1
        print(b)
    b:int = 0
    do_global()
    b=b+1
    print(b)
add_b()`, ["1", "2"]);
    assertPrint("nested function in class", `
class A(object):
    def cnt(self:A, x:int)->int:
        def getone()->int:
            return 1
        return getone() + x
class B(A):
    def cnt(self:B, x:int)->int:
        return x + 1
b:B = None
b = B()
print(b.cnt(5))`, [`6`]);
    assertFailContain("no-scope", `
global x
x:int = 5`, `not parse`);
    assertPrint("nonlocal-in-nested-1", `
def cnt(x:int)->int:
    y:int = 1
    def getone()->int:
        def h()->int:
            nonlocal y
            return 1
        return 1
    return getone() + x
print(cnt(1))
`, [`2`]);
    assertPrint("nonlocal-in-nested-2", `
def cnt(x:int)->int:
    y:int = 1
    def getone()->int:
        nonlocal y
        def h()->int:
            nonlocal y
            return 1
        return 1
    return getone() + x
print(cnt(1))
`, [`2`]);
    assertPrint("global-in-nested-2", `
class A(object):
    x:int = 1
    def get_x(self:A)->int:
        self.x = self.x+1
        return self.x

def inc(a:A)->int:
    a.x = a.x + 1
    return a.x

def f():
    a:A=None
    def g():
        x:int = 1
        x = inc(a)
    a = A()
    g()
    print(a.x)
f()`, [`2`]);
    assertPrint("deep-nested", `
def f()->int:
    a:int = 96
    def g():
        nonlocal a
        def h():
            nonlocal a
            def h1():
                nonlocal a
                a = a + 1
            h1()
            a = a + 1
        h()
        a = a + 1
    g()
    a = a + 1
    return a
print(f())
`, [`100`]);
    assertPrint("deep-nested-2", `
def f(a:int)->int:
    def g():
        nonlocal a
        def h():
            nonlocal a
            def h1():
                nonlocal a
                a = a + 1
            h1()
            a = a + 1
        h()
        a = a + 1
    g()
    a = a + 1
    return a
def g():
    a:int = 96
    def h():
        nonlocal a
        def h1():
            nonlocal a
            a = a + 1
        h1()
        a = a + 1
    h()
    a = a + 1
print(f(96))
`, [`100`]);
});
