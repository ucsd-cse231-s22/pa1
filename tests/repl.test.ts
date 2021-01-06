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

describe('run function', () => {
  const config = { importObject };
  it('returns the right number', async () => {
    const result = await run("987", config);
    expect(result).to.equal(987);
  });


  it('prints two numbers but returns last one', async () => {
    const result = await run("print(987)\nprint(123)", config);
    expect(config.importObject.output).to.equal("987\n123\n");
    expect(result).to.equal(123);
  });

  it('adds two numbers', async() => {
    const result = await run("2 + 3", config);
    expect(result).to.equal(5);
  });
});