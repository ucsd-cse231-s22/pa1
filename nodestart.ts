import {run} from "./runner";
import {emptyEnv, GlobalEnv, globalEnv} from "./compiler";
import {BasicREPL} from "./repl";

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
async function nodeStart(source : string) {
  const env = emptyEnv;
  run(source, { importObject, env });
}

nodeStart("x = 5\nprint(x)");
nodeStart("y = 10\nprint(y)");


async function tryRepl() {
  const r = new BasicREPL(importObject);
  await r.run("foo = 1000");
  await r.run("print(foo)");
  await r.run("bar = 99");
  await r.run("foo = 50");
  await r.run("print(bar)");
  await r.run("print(bar)");
  await r.run("print(foo)");
  await r.run("print(bar)");
  await r.run("globals()");
}
tryRepl();