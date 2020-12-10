// https://github.com/AssemblyScript/wabt.js/
import * as wabt from 'wabt';
wabt().then((wabt : any) => {

  // https://developer.mozilla.org/en-US/docs/WebAssembly/Using_the_JavaScript_API
  var importObject = {
    imports: { imported_func: (arg : any) => console.log("Logging from WASM: ", arg) }
  };

  var myModule = wabt.parseWat("test.wat", `(module
    (func $i (import "imports" "imported_func") (param i32))
    (func (export "exported_func")
      i32.const 42
      call $i))
      `);

  var asBinary = myModule.toBinary({});
  var wasmModule = WebAssembly.instantiate(asBinary.buffer, importObject);
  wasmModule.then((wasmModule) => (wasmModule.instance.exports.exported_func as any)());

  console.log(myModule);
  console.log("hello");

});

