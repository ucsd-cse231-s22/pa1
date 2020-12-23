import {run} from './runner';

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

nodeStart("(define x 5) (print x)");
nodeStart("(define y 10) (print y)");

