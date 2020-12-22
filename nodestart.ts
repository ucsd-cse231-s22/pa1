import {run} from './jit';

async function nodeStart(source : string) {
  var importObject = {
    imports: {
      imported_func: (arg : any) => {
        console.log("Logging from WASM: ", arg);
      }
    }
  };
  const result = run(source, importObject);
}

nodeStart("(print 5)");
nodeStart("(print 50)");

