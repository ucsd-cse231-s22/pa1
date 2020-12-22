// This is a mashup of tutorials from:
//
// - https://github.com/AssemblyScript/wabt.js/
// - https://developer.mozilla.org/en-US/docs/WebAssembly/Using_the_JavaScript_API

import wabt from 'wabt';
import * as compiler from './compiler';

export async function run(source : string, importObject: any) : Promise<any> {
  const wabtInterface = await wabt();
  const compiled = compiler.compile(source);
  const myModule = wabtInterface.parseWat("test.wat", `(module
    (func $print (import "imports" "imported_func") (param i32))
    (func (export "exported_func")
      ${compiled}
    )
  )`);
  var asBinary = myModule.toBinary({});
  var wasmModule = await WebAssembly.instantiate(asBinary.buffer, importObject);
  var result = (wasmModule.instance.exports.exported_func as any)();
  return result;
}
