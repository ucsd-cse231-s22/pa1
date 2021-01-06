import { BasicREPL } from '../repl';
import { GlobalEnv } from '../compiler';
import { expect } from 'chai';
import 'mocha';


const importObject = {
  imports: {
    imported_func: (arg : any) => {
      console.log("Logging from WASM: ", arg);
    },

    print_global_func: (pos: number, value: number) => {
      var name = importObject.nameMap[pos];
      console.log(name, "=", value);
    },

    // print_globals_func: () => {
    //   var env : GlobalEnv = (importObject as any).env;
    //   env.globals.forEach((pos, name) => {
    //     var value = new Uint32Array((importObject as any).js.memory.buffer)[pos];
    //     console.log(name, "=", value);
    //   });
    // }
  },

  nameMap: new Array<string>(),

  updateNameMap : (env : GlobalEnv) => {
    env.globals.forEach((pos, name) => {
      importObject.nameMap[pos] = name;
    })
  }
};

describe('run function', () => {
  const r = new BasicREPL(importObject);

  it('returns the same number', async () => {
    const result = await r.run("987");
    expect(result).to.equal(987);
  });

  it('adds two numbers', async() => {
    const result = await r.run("2 + 3");
    expect(result).to.equal(5);
  });
});