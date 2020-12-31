import {run} from "./runner";
import {emptyEnv, GlobalEnv} from "./compiler";

interface REPL {
  run(source : string) : Promise<void>;
}

export class BasicREPL {
  currentEnv: GlobalEnv
  importObject: any
  memory: any
  constructor(importObject : any) {
    this.importObject = importObject;
    if(!importObject.js) {
      const memory = new WebAssembly.Memory({initial:10, maximum:20});
      this.importObject.js = { memory: memory };
    }
    this.currentEnv = {
      globals: new Map(),
      offset: 0
    };
  }
  async run(source : string) {
    const newEnv = run(source, {importObject: this.importObject, env: this.currentEnv});
    this.currentEnv = await newEnv;
  }
}