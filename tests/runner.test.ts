import { run } from '../runner';
import { expect } from 'chai';
import 'mocha';

const importObject = {
  imports: {
    print: (arg : any) => {
      importObject.output += arg;
      importObject.output += "\n";
      return arg;
    },
  },

  output: ""
};

describe('run(source, config) function', () => {
  const config = { importObject };

  // suppress console logging so output of mocha is clear
  before(function () {
    console.log = function () {};
  });
  
  it('returns the right number', async () => {
    const result = await run("987", config);
    expect(result).to.equal(987);
  });

  it('prints two numbers but returns last one', async () => {
    var result = await run("print(987)", config);
    expect(result).to.equal(987);
    result = await run("print(123)", config);
    expect(result).to.equal(123);
    
    expect(config.importObject.output).to.equal("987\n123\n");
  });

  it('adds two numbers', async() => {
    const result = await run("2 + 3", config);
    expect(result).to.equal(5);
  });
});