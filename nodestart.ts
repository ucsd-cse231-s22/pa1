import {run} from "./runner";

const importObject = {
  imports: {
    imported_func: (arg : any) => {
      console.log("Logging from WASM: ", arg);
    },
  }
};

async function nodeStart(source : string) {
  run(source, { importObject });
}

nodeStart("x = 5\nprint(x)");
nodeStart("y = 10\nprint(y)");
