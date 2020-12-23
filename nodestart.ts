import {run} from "./runner";
import {emptyEnv} from "./compiler";
import {BasicREPL} from "./repl";

const importObject = {
  imports: {
    imported_func: (arg : any) => {
      console.log("Logging from WASM: ", arg);
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
  await r.run("print(bar)");
  await r.run("print(bar)");
  await r.run("print(foo)");
  await r.run("print(bar)");
}
tryRepl();