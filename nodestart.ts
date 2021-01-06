import {run} from "./runner";

const importObject = {
  imports: {
    print: (arg : any) => {
      console.log("Logging from WASM: ", arg);
      return arg;
    },
  }
};

async function nodeStart(source : string) {
  run(source, { importObject });
}

nodeStart("x = 5\nprint(x)");
nodeStart("y = 10\nprint(y)");
