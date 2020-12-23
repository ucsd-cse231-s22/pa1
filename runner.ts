// This is a mashup of tutorials from:
//
// - https://github.com/AssemblyScript/wabt.js/
// - https://developer.mozilla.org/en-US/docs/WebAssembly/Using_the_JavaScript_API

import wabt from 'wabt';
import * as compiler from './compiler';

export async function run(source : string, config: any) : Promise<compiler.GlobalEnv> {
  const wabtInterface = await wabt();
  const compiled = compiler.compile(source, config.env);
  const importObject = config.importObject;
  if(!importObject.js) {
    const memory = new WebAssembly.Memory({initial:10, maximum:100});
    importObject.js = { memory: memory };
  }
  const wasmSource = `(module
    (func $print (import "imports" "imported_func") (param i32))
    (import "js" "memory" (memory 1))
    (func (export "exported_func")
      ${compiled.wasmSource}
    )
  )`;
  console.log(wasmSource);
  const myModule = wabtInterface.parseWat("test.wat", wasmSource);
  var asBinary = myModule.toBinary({});
  var wasmModule = await WebAssembly.instantiate(asBinary.buffer, importObject);
  (wasmModule.instance.exports.exported_func as any)();
  return compiled.newEnv;
}
