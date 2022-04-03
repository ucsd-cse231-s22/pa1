import { run } from '../runner';
import { expect } from 'chai';
import 'mocha';

const importObject = {
  imports: {
    // we typically define print to mean logging to the console. To make testing
    // the compiler easier, we define print so it logs to a string object.
    //  We can then examine output to see what would have been printed in the
    //  console.
    print: (arg : any) => {
      importObject.output += arg;
      importObject.output += "\n";
      return arg;
    },
    abs: Math.abs,
    max: Math.max,
    min: Math.min,
    pow: Math.pow,
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
    const result = await run("987", config);
    expect(result).to.equal(987);
  });

  // 2- we can test the behavior of the compiler by also looking at the log 
  // resulting from running the program
  it('prints something right', async() => {
    var result = await run("print(1337)", config);
    expect(config.importObject.output).to.equal("1337\n");
  });

  // 3- we can also combine both type of assertions, or feel free to use any 
  // other assertions provided by chai.
  it('prints two numbers but returns last one', async () => {
    var result = await run("print(987)", config);
    expect(result).to.equal(987);
    result = await run("print(123)", config);
    expect(result).to.equal(123);
    
    expect(config.importObject.output).to.equal("987\n123\n");
  });

  // Note: it is often helpful to write tests for a functionality before you
  // implement it. You will make this test pass!
  it('adds two numbers', async() => {
    const result = await run("2 + 3", config);
    expect(result).to.equal(5);
  });

  // TODO: add additional tests here to ensure the compiler runs as expected
  it('adds two numbers', async () => {
    const result = await run("-1 + 3", config);
    expect(result).to.equal(2);
  });
  it('minus two numbers', async () => {
    const result = await run("-1 - 3", config);
    expect(result).to.equal(-4);
  });
  it('multiply two numbers', async () => {
    const result = await run("-1 * 3", config);
    expect(result).to.equal(-3);
  });
  it('max 1', async () => {
    const result = await run("max(-1, -2)", config);
    expect(result).to.equal(-1);
  });
  it('max 2', async () => {
    const result = await run("x=-1\ny=2\nmax(x, y)", config);
    expect(result).to.equal(2);
  });
  it('min 1', async () => {
    const result = await run("min(8, 9)", config);
    expect(result).to.equal(8);
  });
  it('min 2', async () => {
    const result = await run("y=2\nmin(4, y)", config);
    expect(result).to.equal(2);
  });
  it('pow 1', async () => {
    const result = await run("pow(8, 3)", config);
    expect(result).to.equal(512);
  });
  it('pow 2', async () => {
    const result = await run("pow(2, 31)", config);
    expect(result).to.equal(-2147483648);
  });
  it('pow 3', async () => {
    const result = await run("pow(-2, 31)", config);
    expect(result).to.equal(-2147483648);
  });
  it('abs 1', async () => {
    const result = await run("abs(8)", config);
    expect(result).to.equal(8);
  });
  it('abs 2', async () => {
    const result = await run("abs(0)", config);
    expect(result).to.equal(0);
  });
  it('abs 3', async () => {
    const result = await run("abs(-2)", config);
    expect(result).to.equal(2);
  });
  it('abs 4', async () => {
    const result = await run("x=-1\nabs(x)", config);
    expect(result).to.equal(1);
  });
  it('abs 5', async () => {
    const result = await run("x=-1\nabs(-x)", config);
    expect(result).to.equal(1);
  });

  it('calculation 1', async () => {
    const result = await run("1 + 2 * 3 - 5 * 4", config);
    expect(result).to.equal(-13);
  });

  it('calculation 2', async () => {
    const result = await run("5 * 9 * 12 + 4 - 6 * 16", config);
    expect(result).to.equal(448);
  });

  it('calculation 3', async () => {
    const result = await run("-60 + 2 * 3 - 5 * 4", config);
    expect(result).to.equal(-74);
  });

  it('calculation 4', async () => {
    const result = await run("max(3*4, pow(5,2)) + min(2 * 3, 5 + 4)", config);
    expect(result).to.equal(31);
  });

  it('calculation 5', async () => {
    const result = await run("x=5\ny=x+4\nprint(y)", config);
    expect(result).to.equal(9);
  });

  it('calculation 6', async () => {
    var result = await run("x = -1\ny=-x\nz=2*x - y\nprint(z)\nx = -pow(z, abs(2 * y))\nprint(x)", config);
    expect(config.importObject.output).to.equal("-3\n-9\n");
  });

  it('calculation 7', async () => {
    var result = await run("y=-x\nprint(y)", config);
    expect(config.importObject.output).to.equal("-3\n-9\n");
  });

});