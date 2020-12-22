import {run} from './jit';

function webStart() {
  document.addEventListener("DOMContentLoaded", function() {
    document.getElementById("run").addEventListener("click", async function(e) {
      var importObject = {
        imports: {
          imported_func: (arg : any) => {
            console.log("Logging from WASM: ", arg);
            const elt = document.createElement("pre");
            document.getElementById("output").appendChild(elt);
            elt.innerText = arg;
          }
        }
      };

      const source = document.getElementById("user-code") as HTMLTextAreaElement;
      const result = await run(source.value, importObject);
    });
  });
}

webStart();
