// This is a mashup of tutorials from:
//
// - https://github.com/AssemblyScript/wabt.js/
// - https://developer.mozilla.org/en-US/docs/WebAssembly/Using_the_JavaScript_API

import wabt from 'wabt';
import * as compiler from './compiler';
wabt().then((wabt : any) => {
  document.addEventListener("DOMContentLoaded", function() {
    document.getElementById("run").addEventListener("click", function(e) {
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
      console.log("source: ", source, source.value);
      const compiled = compiler.compile(source.value);

      console.log(compiled);

      var myModule = wabt.parseWat("test.wat", `(module
        (func $print (import "imports" "imported_func") (param i32))
        (func (export "exported_func")
          ${compiled}
        )
      )`);

      var asBinary = myModule.toBinary({});
      var wasmModule = WebAssembly.instantiate(asBinary.buffer, importObject);
      wasmModule.then((wasmModule) => (wasmModule.instance.exports.exported_func as any)());

    });
  });

});

