import { compile, run } from '../compiler';
import { expect } from 'chai';
import 'mocha';

function runTest(source : string) {
  return run(compile(source), importObject);
}

const importObject = {
  imports: {
    // we typically define print to mean logging to the console. To make testing
    // the compiler easier, we define print so it logs to a string object.
    //  We can then examine output to see what would have been printed in the
    //  console.
    print_num: (arg : any) => {
      importObject.output += arg;
      importObject.output += "\n";
      return arg;
    },
    print_bool: (arg : any) => {
      if(arg !== 0) { importObject.output += "True"; }
      else { importObject.output += "False"; }
      importObject.output += "\n";
    },
    print_none: (arg : any) => {
      importObject.output += "None";
      importObject.output += "\n";
    }
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
    it('returns the right number', async () => {
        const result = await runTest("987");
        expect(result).to.equal(987);
    });

    // Note: it is often helpful to write tests for a functionality before you
    // implement it. You will make this test pass!
    it('adds two numbers', async() => {
        const result = await runTest("2 + 3");
        expect(result).to.equal(5);
    });

    it('prints a boolean', async() => {
        await runTest("print(True)");
        expect(importObject.output).to.equal("True\n");
    });

    it('reference itself', async () => {
        await runTest("x:int = 1\nx = x+1\nprint(x)");
        expect(importObject.output).to.equal("2\n");
    });

  // it('prints a unary operation', async () => {
  //   await runTest("print(1)");
  //   expect(importObject.output).to.equal("1\n");
  // });

});

describe('test binary operation', () => {
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

    it('comparsion operation', async () => {
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

    // TODO: test "is"
    // it('is operation', async () => {
    //     await runTest("1 is 2");
    //     expect(importObject.output).to.equal("False\n");
    // });

});


describe('test unary operation', () => {
    const config = { importObject };

    it('prints a unary operation 1', async () => {
        await runTest("print(-2)");
        expect(importObject.output).to.equal("-2\n");
    });

    it('prints a unary operation 2', async () => {
        await runTest("print(not True)");
        expect(importObject.output).to.equal("False\n");
    });

    it('prints a unary operation 3', async () => {
        await runTest("y:int = -5\nx:int=-y\nprint(x)\nprint(-(-x))");
        expect(importObject.output).to.equal("5\n5\n");
    });
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
                print(2)
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
    
    // it('prints a unary operation 3', async () => {
    //     await runTest("y = -5\nx=-y\nprint(x)\nprint(-(-x))");
    //     expect(importObject.output).to.equal("5\n5\n");
    // });

});

describe('test functions', () => {
    const config = { importObject };

    it('function definition', async () => {
        await runTest(`
            x:int = 10
            def fun(x:int)->int:
                y:int = x
                x = 1
                return x
            z:int = fun(x)
            print(z)
        `);
        expect(importObject.output).to.equal("1\n");
    });

    it('global var', async () => {
        await runTest(`
            x:int = 10
            def fun():
                x = 1
                return
            fun()
            print(x)
        `);
        expect(importObject.output).to.equal("1\n");
    });

    it('local var', async () => {
        await runTest(`
            x:int = 10
            def fun(x: int):
                x = 1
                return
            fun(x)
            print(x)
        `);
        expect(importObject.output).to.equal("10\n");
    });

    // it('elif expression 1', async () => {
    //     await runTest(`
    //         x = 25
    //         if x < 2:
    //             print(0)
    //         elif x < 10:
    //             print(1)
    //         elif x > 30:
    //             print(2)
    //         else:
    //             print(3)
    //     `);
    //     expect(importObject.output).to.equal("3\n");
    // });

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



