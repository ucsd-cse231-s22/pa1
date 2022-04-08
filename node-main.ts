import {compile, run} from './compiler';

// command to run:
// node node-main.js 987
const input = process.argv[2];
const result = compile(input);
console.log(result);
run(result, {}).then((value) => {
  console.log(value);
});

