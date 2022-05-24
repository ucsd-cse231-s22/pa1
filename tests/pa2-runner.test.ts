import { compile, run } from '../compiler';
import { expect } from 'chai';
import 'mocha';

function runTest(source: string) {
    return run(compile(source), importObject);
}

const importObject = {
    imports: {
        // we typically define print to mean logging to the console. To make testing
        // the compiler easier, we define print so it logs to a string object.
        //  We can then examine output to see what would have been printed in the
        //  console.
        print_num: (arg: any) => {
            importObject.output += arg + "\n";
        },
        print_bool: (arg: any) => {
            if (arg !== 0) { importObject.output += "True"; }
            else { importObject.output += "False"; }
            importObject.output += "\n";
        },
        print_none: (arg: any) => {
            importObject.output += "None\n";
        },
        abs: Math.abs,
        min: Math.min,
        max: Math.max,
        pow: Math.pow,
    },
    check: {
        check_init: (arg: any) => {
            if (arg <= 0)
                throw new Error("RUNTIME ERROR: object not intialized");
            return arg;
        },
    },
    output: ""
};

// Clear the output before every test
beforeEach(function () {
    importObject.output = "";
});

// We write end-to-end tests here to make sure the compiler works as expected.
// You should write enough end-to-end tests until you are confident the compiler
// runs as expected. 
describe('run(source, config) function', () => {
    const config = { importObject };

    // We can test the behavior of the compiler in several ways:
    // 1- we can test the return value of a program
    // Note: since run is an async function, we use await to retrieve the
    // asynchronous return value.
    // Note: it is often helpful to write tests for a functionality before you
    // implement it. You will make this test pass!
    it('returns the right number', async () => {
        var result = await runTest("987");
        expect(result).to.equal(987);
        var result = await runTest("2 + 3");
        expect(result).to.equal(5);
    });

    it('print function', async () => {
        await runTest("print(11)\nprint(True)\nprint(None)");
        expect(importObject.output).to.equal("11\nTrue\nNone\n");
    });

    it('reference itself', async () => {
        await runTest("x:int = 1\nx = x+1\nprint(x)");
        expect(importObject.output).to.equal("2\n");
    });

    it('parenthesis expression', async () => {
        await runTest("x:int = 0\nx=(2 + 3) * (5 + 10 // 4)\nprint(x)");
        expect(importObject.output).to.equal("35\n");
    });
});

describe('test operations', () => {
    const config = { importObject };

    it('number operation', async () => {
        await runTest(`
            print(1+2)
            print(12-8)
            print(4*5)
            print(9//3)
            print(10 % 3)
        `);
        expect(importObject.output).to.equal("3\n4\n20\n3\n1\n");
    });

    it('relational operation', async () => {
        await runTest(`
print(1>2)
print(1<2)
print(3 >= 4)
print(3 <= 4)
print(5 == 6)
print(6!=10)
print(True == True)
        `);
        expect(importObject.output).to.equal("False\nTrue\nFalse\nTrue\nFalse\nTrue\nTrue\n");
    });

    it('is operation', async () => {
        await runTest(`
print(None is None)
        `);
        expect(importObject.output).to.equal("True\n");
    });

    it('unary operation', async () => {
        await runTest(`
y:int = 0\nx:int=1\ny=-5\nx=-y\nprint(x)\nprint(-(-x))
print(-2)
print(-(-4))
print(not True)
print(not False)
        `);
        expect(importObject.output).to.equal("5\n5\n-2\n4\nFalse\nTrue\n");
    });

    it('operation error', async () => {
        try {
            await runTest(`print(1+True)`);
            expect(true).to.equal(false);
        } catch (error) {
            expect(error.name).to.equal("TypeError");
        }
        try {
            await runTest(`
y:bool = True
x:int = 1
x = y
            `);
            expect(true).to.equal(false);
        } catch (error) {
            expect(error.message).to.equal(`TYPE ERROR: Expect type 'int'; got type 'bool'`);
        }
    });

    // TODO: test "is"
    // it('is operation', async () => {
    //     await runTest("1 is 2");
    //     expect(importObject.output).to.equal("False\n");
    // });

});

describe('test control flow', () => {
    const config = { importObject };

    it('pass expression', async () => {
        await runTest("x:int=1\npass\nprint(x)");
        expect(importObject.output).to.equal("1\n");
    });

    it('if expression', async () => {
        await runTest(`
x:int = 3
if x > 2:
    print(x)
else:
    print(-x)
        `);
        expect(importObject.output).to.equal("3\n");
    });

    it('elif expression 1', async () => {
        await runTest(`
x:int = 25
if x < 2:
    print(0)
elif x < 10:
    print(1)
elif x > 30:
    pass
else:
    print(3)
        `);
        expect(importObject.output).to.equal("3\n");
    });

    it('elif expression 2', async () => {
        await runTest(`
x:int = 5
if x <= 2:
    x=0
elif x <= 10:
    x=1
elif x >= 30:
    x=2
else:
    x=3
print(x)
        `);
        expect(importObject.output).to.equal("1\n");
    });

    it('while expression', async () => {
        await runTest(`
limit:int = 100
x:int = 1
while x < limit:
    x = x + 1
print(x)
        `);
        expect(importObject.output).to.equal("100\n");
    });

    it('return', async () => {
        try {
            await runTest(`
def f(x:int) -> bool:
    if x > 0:
        return x
            `);
            expect(true).to.equal(false);
        } catch (error) {
            expect(error.message).to.equal("TYPE ERROR: All path in this function/method " +
                "must have a return statement: f");
        }

        try {
            await runTest(`
def f(x:int) -> bool:
    while True:
        x = x + 1
        if x > 10:
            return True
            `);
            expect(true).to.equal(false);
        } catch (error) {
            expect(error.message).to.equal("TYPE ERROR: All path in this function/method " +
                "must have a return statement: f");
        }
    });

    // it('prints a unary operation 3', async () => {
    //     await runTest("y = -5\nx=-y\nprint(x)\nprint(-(-x))");
    //     expect(importObject.output).to.equal("5\n5\n");
    // });

});

describe('test functions', () => {
    const config = { importObject };

    it('function definition 1', async () => {
        await runTest(`
x:int = 10
def fun(x:int)->int:
    y:int = 0
    y = x
    x = 1
    return x
z:int = 0
z = fun(x)
print(z)
        `);
        expect(importObject.output).to.equal("1\n");
    });

    it('function definition 2', async () => {
        await runTest(`
def f():
    pass
print(f())
        `);
        expect(importObject.output).to.equal("None\n");
    });

    it('function definition 3', async () => {
        await runTest(`
x: int = 1
def f(x: int) -> int:
    y:int = 2
    y = x + y + 1
    x = x + 1
    return x * y
print(f(x))
print(x)
        `);
        expect(importObject.output).to.equal("8\n1\n");
    });


    it('local var', async () => {
        await runTest(`
x:int = 10
def fun1(x: int):
    x = 1
    return
def fun2():
    x:int = 1
    return
fun1(x)
print(x)
x = 10
fun2()
print(x)
        `);
        expect(importObject.output).to.equal("10\n10\n");
    });

    it('function test 1', async () => {
        await runTest(`
y:bool = False
def f(x:int)->bool:
    return x == 1
y = f(1)
print(y)
        `);
        expect(importObject.output).to.equal("True\n");
    });

    it('function test 2', async () => {
        await runTest(`
x:int = 4
y:int = 0
def sqr(x:int)->int:
    return x * x
y = sqr(3) + sqr(x)
print(y)
        `);
        expect(importObject.output).to.equal("25\n");
    });

    it('function test 3', async () => {
        await runTest(`
def f(x:int)->int:
    return x * x

a:int = 1
res:int = 0
while a <= 10:
    res = res + f(a)
    a = a + 1
print(res)
        `);
        expect(importObject.output).to.equal("385\n");
    });


    it('none', async () => {
        await runTest(`
def fun1():
    return None
def fun2():
    return
print(fun1())
print(fun2())
        `);
        expect(importObject.output).to.equal("None\nNone\n");
    });


    it('function error', async () => {
        try {
            await runTest(`
def f(x:int)->int:
    y:bool = False
    return y
            `);
            expect(true).to.equal(false);
        } catch (error) {
            expect(error.name).to.equal("TypeError");
        }
        try {
            await runTest(`
y:bool = False
def f(x:int)->int:
    return x
f(y)
            `);
            expect(true).to.equal(false);
        } catch (error) {
            expect(error.name).to.equal("TypeError");
        }
        try {
            await runTest(`
y:int = 1
def f(x:int)->int:
    return x
f(y, y)
            `);
            expect(true).to.equal(false);
        } catch (error) {
            expect(error.message).to.equal(`Expected 1 arguments; got 2`);
        }

        try {
            await runTest(`
y:int = 1
def f(x:int)->bool:
    return x == 1
y = f(1)
            `);
            expect(true).to.equal(false);
        } catch (error) {
            expect(error.name).to.equal(`TypeError`);
        }

    });

    it('function variable scope error', async () => {
        try {
            await runTest(`
x:int = 10
def fun():
    x = 1
    return
fun()
print(x)
            `);
            expect(true).to.equal(false);
        } catch (error) {
            expect(error.message).to.equal("Cannot assign variable " +
                "that is not explicitly declared in this scope: x");
        }

        try {
            await runTest(`
y:bool = False
def f(x:int)->int:
    return x
f(y)
            `);
            expect(true).to.equal(false);
        } catch (error) {
            expect(error.name).to.equal("TypeError");
        }

        try {
            await runTest(`
y:int = 1
def f(x:int)->bool:
    return x == 1
y = f(1)
            `);
            expect(true).to.equal(false);
        } catch (error) {
            expect(error.name).to.equal(`TypeError`);
        }

    });


    it('redefinition', async () => {
        try {
            await runTest(`
x:int = 1
x:int = 2
            `);
            expect(true).to.equal(false);
        } catch (error) {
            expect(error.message).to.equal("Duplicate declaration of identifier in the same scope: x");
        }

        try {
            await runTest(`
x:int = 1
def f(x:int)->int:
    x:int = 1
    return x
x = f(x)
            `);
            expect(true).to.equal(false);
        } catch (error) {
            expect(error.message).to.equal("Duplicate declaration of identifier in the same scope: x");
        }

        try {
            await runTest(`
x:int = 1
def x()
    return
            `);
            expect(true).to.equal(false);
        } catch (error) {
            expect(error.message).to.equal("Duplicate declaration of identifier in the same scope: x");
        }

        try {
            await runTest(`
x:int = 1
def x()
    return
            `);
            expect(true).to.equal(false);
        } catch (error) {
            expect(error.message).to.equal("Duplicate declaration of identifier in the same scope: x");
        }

        try {
            await runTest(`
def f(x:int, x:bool):
    return
            `);
            expect(true).to.equal(false);
        } catch (error) {
            expect(error.message).to.equal("Duplicate declaration of identifier in the same scope: x");
        }


    });

    // it('elif expression 2', async () => {
    //     await runTest(`
    //         x = 5
    //         if x <= 2:
    //             x=0
    //         elif x <= 10:
    //             y=2
    //             x=1
    //         elif x >= 30:
    //             z=3
    //             x=2
    //         else:
    //             x=3
    //         print(x)
    //     `);
    //     expect(importObject.output).to.equal("1\n");
    // });

    // it('while expression', async () => {
    //     await runTest(`
    //         limit = 100
    //         x = 1
    //         while x < limit:
    //             x = x + 1
    //         print(x)
    //     `);
    //     expect(importObject.output).to.equal("100\n");
    // });

    // it('prints a unary operation 3', async () => {
    //     await runTest("y = -5\nx=-y\nprint(x)\nprint(-(-x))");
    //     expect(importObject.output).to.equal("5\n5\n");
    // });

});

describe('test classes', () => {
    const config = { importObject };
    it('class definition', async () => {
        await runTest(`
class Counter(object):
    n: int = 456
c:Counter = None
c = Counter()
print(c.n)
c.n = 1
print(c.n)
        `);
        expect(importObject.output).to.equal("456\n1\n");
    });

    it('class definition', async () => {
        await runTest(`
class Rat(object):
    n: int = 123
    d: int = 456
    def __init__(self: Rat):
        pass
x:int = 1
r1: Rat = None
r1 = Rat()
r1.n = 4
r1.d = 5
print(r1.n)
x = r1.n
print(x + r1.d)
        `);
        expect(importObject.output).to.equal("4\n9\n");
    });

    it('method test', async () => {
        await runTest(`
class Counter(object):
    n: int = 0
    def inc(self:Counter):
        self.n = self.n + 1
c:Counter = None
c = Counter()
c.inc()
print(c.n)
c.inc()
print(c.n)
        `);
        expect(importObject.output).to.equal("1\n2\n");
    });

    it('method test', async () => {
        await runTest(`
class Counter(object):
    n: int = 0
    def inc(self:Counter, n: int):
        self.n = self.n + n
c:Counter = None
c = Counter()
c.inc(5)
print(c.n)
        `);
        expect(importObject.output).to.equal("5\n");
    });

    it('method test', async () => {
        await runTest(`
class Counter(object):
    n: int = 0
    def inc(self:Counter):
        self.n = self.n + 1
c:int = 1
c = Counter().n
print(c)
        `);
        expect(importObject.output).to.equal("0\n");
    });

    it('class test', async () => {
        await runTest(`
class Point(object):
    x : int = 77
    y : int = 99

def flip(toflip : Point) -> Point:
    flipped : Point = None
    flipped = Point()
    flipped.x = toflip.y
    flipped.y = toflip.x
    return flipped

p : Point = None
p = Point()
print(flip(flip(flip(p))).x)
        `);
        expect(importObject.output).to.equal("99\n");
    });


    // it('prints a unary operation 3', async () => {
    //     await runTest("y = -5\nx=-y\nprint(x)\nprint(-(-x))");
    //     expect(importObject.output).to.equal("5\n5\n");
    // });

});


