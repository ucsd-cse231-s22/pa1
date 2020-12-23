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

nodeStart("(define x 5) (print x)");
nodeStart("(define y 10) (print y)");


async function tryRepl() {
  const r = new BasicREPL(importObject);
  await r.run("(define foo 1000)");
  await r.run("(print foo)");
  await r.run("(define bar 99)");
  await r.run("(print bar)");
  await r.run("(print bar)");
  await r.run("(print foo)");
  await r.run("(print bar)");
}
tryRepl();