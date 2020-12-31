import {BasicREPL} from './repl';
import {emptyEnv} from './compiler';
import { output } from './webpack.config';


function webStart() {
  document.addEventListener("DOMContentLoaded", function() {

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
    const env = emptyEnv;
    var repl = new BasicREPL(importObject);


    function setupRepl() {
      document.getElementById("output").innerHTML = "";
      const replCodeElement = document.getElementById("next-code") as HTMLInputElement;
      replCodeElement.addEventListener("keypress", (e) => {
        if(e.key === "Enter") {
          const output = document.createElement("div");
          const prompt = document.createElement("span");
          prompt.innerText = "»";
          output.appendChild(prompt);
          const elt = document.createElement("input");
          elt.type = "text";
          elt.disabled = true;
          elt.className = "repl-code";
          output.appendChild(elt);
          document.getElementById("output").appendChild(output);
          const source = replCodeElement.value;
          elt.value = source;
          replCodeElement.value = "";
          repl.run(source).then(() => console.log ("run finished")).catch((e) => console.log("run failed", e));;
        }
      });
    }


    document.getElementById("run").addEventListener("click", function(e) {
      repl = new BasicREPL(importObject);
      const source = document.getElementById("user-code") as HTMLTextAreaElement;
      setupRepl();
      repl.run(source.value).then(() => console.log ("run finished")).catch((e) => console.log("run failed", e));
    });
  });
}

webStart();
