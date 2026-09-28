const assert = require('node:assert/strict');

global.window = global;
require('../engines.js');
const E = global.AutomataEngines;
const machine = id => Object.values(E.definitions).flat().find(item => item.id === id);
let checks = 0;
function check(name, action) {
  action();
  checks++;
  console.log(`✓ ${name}`);
}

check('DFA accepts strings ending in 01 and rejects other endings', () => {
  assert.equal(E.createFiniteRunner(machine('ends-01'), '1101').run().status, 'accepted');
  assert.equal(E.createFiniteRunner(machine('ends-01'), '1110').run().status, 'rejected');
});
check('DFA tracks even parity of 1s', () => {
  assert.equal(E.createFiniteRunner(machine('even-ones'), '1010').run().status, 'accepted');
  assert.equal(E.createFiniteRunner(machine('even-ones'), '111').run().status, 'rejected');
});
check('NFA follows parallel paths', () => {
  assert.equal(E.createFiniteRunner(machine('contains-aba'), '11010').run().status, 'accepted');
  assert.equal(E.createFiniteRunner(machine('contains-aba'), '1111').run().status, 'rejected');
});
check('NFA computes epsilon closure without consuming input', () => {
  const runner = E.createFiniteRunner(machine('epsilon-choice'), '101');
  assert.deepEqual(runner.snapshot().active, ['s', 'a', 'b']);
  assert.equal(runner.run().status, 'accepted');
  assert.equal(E.createFiniteRunner(machine('epsilon-choice'), '').run().status, 'rejected');
});
check('Turing machine performs binary increment with carry', () => {
  const result = E.createTuringRunner(machine('tm-binary-inc'), '1011').run();
  assert.equal(result.status, 'accepted');
  assert.equal(result.tape.join('').replaceAll('□', ''), '1100');
});
check('Turing machine handles unary increment and empty input', () => {
  assert.equal(E.createTuringRunner(machine('tm-unary-inc'), '111').run().tape.join('').replaceAll('□', ''), '1111');
  assert.equal(E.createTuringRunner(machine('tm-unary-inc'), '').run().tape.join('').replaceAll('□', ''), '1');
});
check('Turing machine reports a missing transition as a halt', () => {
  assert.equal(E.createTuringRunner(machine('tm-unary-inc'), '0').run().status, 'halted');
});
check('PDA accepts balanced parentheses and rejects imbalance', () => {
  assert.equal(E.createPdaRunner(machine('pda-parens'), '(()())').run().status, 'accepted');
  assert.equal(E.createPdaRunner(machine('pda-parens'), '(()').run().status, 'rejected');
});
check('PDA matches aⁿbⁿ, including the empty string', () => {
  assert.equal(E.createPdaRunner(machine('pda-anbn'), 'aaabbb').run().status, 'accepted');
  assert.equal(E.createPdaRunner(machine('pda-anbn'), 'aabbb').run().status, 'rejected');
  assert.equal(E.createPdaRunner(machine('pda-anbn'), '').run().status, 'accepted');
});
console.log(`\n${checks} verification groups passed.`);
