1. Give three examples of Python programs that use binary operators and/or builtins from this PA, but have different behavior than your compiler.

- max(1, 2, 3) / min(4, 5, 6)
    - In Python, max/min function can take arbitray number of parameters 
    - In PA1, we specify the number of parameters to be 2
- abs(-3.14)
    - In Python, abs function can take any number, including floats and integers
    - In PA1, we only support 32-bit integers so far
- max("45", "46") 
    - In Python, max function can be used to compare strings (or other comparable objects)
    - In PA1, we can only compare 32-bit integers
- pow(2, 32)
    - In Python, the result is 2147483648
    - In PA1, the result is -2147483648 because of overflow

2. What resources did you find most helpful in completing the assignment?

WebAssembly document (https://webassembly.github.io/spec/core/syntax/instructions.html)
TAs' tutorial

3. Who (if anyone) in the class did you work with on the assignment?

I did not collaborate with anyone. However I did learn much from TAs' tutorial.