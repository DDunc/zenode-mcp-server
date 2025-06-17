Certainly! Below is an example of a simple JavaScript calculator function that supports addition, subtraction, multiplication, and division. I'll also include some basic unit tests using the Jest testing framework to ensure everything works as expected.

### Calculator Function

```javascript
// calculator.js

/**
 * Adds two numbers.
 * @param {number} a - The first number.
 * @param {number} b - The second number.
 * @returns {number} The sum of the two numbers.
 */
function add(a, b) {
  return a + b;
}

/**
 * Subtracts the second number from the first.
 * @param {number} a - The first number.
 * @param {number} b - The second number.
 * @returns {number} The difference between the two numbers.
 */
function subtract(a, b) {
  return a - b;
}

/**
 * Multiplies two numbers.
 * @param {number} a - The first number.
 * @param {number} b - The second number.
 * @returns {number} The product of the two numbers.
 */
function multiply(a, b) {
  return a * b;
}

/**
 * Divides the first number by the second.
 * @param {number} a - The first number.
 * @param {number} b - The second number.
 * @returns {number} The quotient of the two numbers.
 * @throws Will throw an error if the divisor is zero.
 */
function divide(a, b) {
  if (b === 0) {
    throw new Error("Cannot divide by zero");
  }
  return a / b;
}

module.exports = {
  add,
  subtract,
  multiply,
  divide
};
```

### Unit Tests with Jest

First, make sure you have Jest installed in your project. You can install it using npm:

```bash
npm install --save-dev jest
```

Then, create a test file for the calculator functions.

```javascript
// calculator.test.js

const { add, subtract, multiply, divide } = require('./calculator');

test('add function', () => {
  expect(add(1, 2)).toBe(3);
  expect(add(-1, -1)).toBe(-2);
  expect(add(0, 0)).toBe(0);
});

test('subtract function', () => {
  expect(subtract(5, 3)).toBe(2);
  expect(subtract(-1, -1)).toBe(0);
  expect(subtract(0, 0)).toBe(0);
});

test('multiply function', () => {
  expect(multiply(4, 2)).toBe(8);
  expect(multiply(-1, -1)).toBe(1);
  expect(multiply(0, 5)).toBe(0);
});

test('divide function', () => {
  expect(divide(6, 3)).toBe(2);
  expect(divide(-4, 2)).toBe(-2);
  expect(() => divide(5, 0)).toThrow("Cannot divide by zero");
});
```

### Running the Tests

To run the tests, add a script to your `package.json`:

```json
{
  "scripts": {
    "test": "jest"
  }
}
```

Then, execute the tests using npm:

```bash
npm test
```

This setup provides a simple calculator with basic arithmetic operations and includes unit tests to verify its functionality. You can expand this example by adding more operations or improving error handling as needed.