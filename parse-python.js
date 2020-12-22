const python = require('lezer-python');

const input = "x = 5\ny = 10";

const tree = python.parser.parse(input);

const cursor = tree.cursor();

while(cursor.next()) {
//  console.log(cursor.node);
  console.log(cursor.node.type.name);
  console.log(input.substring(cursor.node.from, cursor.node.to));
}

