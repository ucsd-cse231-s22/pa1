import * as repl from 'repl';
import { globalEnv } from './compiler';
import * as pyRepl from './repl';

const importObject = {
  imports: {
    imported_func: (arg : any) => {
      console.log("Logging from WASM: ", arg);
    },
    // TODO: this is not a good solution for printing globals
    // 1) we shouldn't have to pass the environment as a global value
    // 2) as of right now there's no reason why the environment should be a map
    //    instead it looks like it's just an array
    print_global_func: (pos: Number, value: Number) => {
      globalEnv.globals.forEach((mpos, name) => {
        if (mpos == pos) {
          console.log(name, "=", value);
        }
      });
    }
  }
};
const r = new pyRepl.BasicREPL(importObject);

function myEval(cmd : string, context : any, filename : string, callback : any) {
  r.run(cmd).then((r) => { console.log("Result from repl: ", r); callback(null, r) }).catch((e) => console.error(e));
}

repl.start({ prompt: ">>> ", eval: myEval });