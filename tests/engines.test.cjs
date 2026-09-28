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
check('Turing machine reports a missing transition as rejection', () => {
  const definition = {
    states: ['q'], start: 'q', accepts: [], alphabet: ['0'],
    tapeAlphabet: ['0', '□'], transitions: {},
  };
  const result = E.createTuringRunner(definition, '0').run();
  assert.equal(result.status, 'rejected');
  assert.equal(result.reason, 'no transition for (q, 0)');
});
check('Turing machine records reads, writes, moves, and expanded head positions', () => {
  const machine = {
    states: ['scan', 'return', 'accept'],
    start: 'scan',
    accepts: ['accept'],
    rejects: [],
    alphabet: ['0'],
    tapeAlphabet: ['0', 'X', '□'],
    transitions: {
      scan: { '0': { write: 'X', move: 'R', next: 'return' } },
      return: { '□': { write: '0', move: 'L', next: 'accept' } },
    },
  };
  const result = E.createTuringRunner(machine, '0').run();
  assert.equal(result.status, 'accepted');
  assert.equal(result.output, 'X0');
  assert.equal(result.headIndex, 0);
  assert.deepEqual(result.history[0], {
    index: 1,
    state: 'scan',
    symbol: '0',
    transition: '0 → X, R',
    to: 'return',
    write: 'X',
    move: 'R',
    headBefore: 0,
    headAfter: 1,
  });
});
check('Turing machine expands left and supports stay moves', () => {
  const machine = {
    states: ['left', 'stay', 'accept'],
    start: 'left',
    accepts: ['accept'],
    alphabet: ['0'],
    tapeAlphabet: ['0', 'L', '□'],
    transitions: {
      left: { '0': { write: '0', move: 'L', next: 'stay' } },
      stay: { '□': { write: 'L', move: 'S', next: 'accept' } },
    },
  };
  const result = E.createTuringRunner(machine, '0').run();
  assert.equal(result.output, 'L0');
  assert.equal(result.headIndex, 0);
  assert.equal(result.history[0].headAfter, 0);
  assert.equal(result.history[1].move, 'S');
});
check('Turing machine rejects a missing transition with a reason', () => {
  const runner = E.createTuringRunner({
    states: ['q'], start: 'q', accepts: [], alphabet: ['0'],
    tapeAlphabet: ['0', '□'], transitions: {},
  }, '0');
  const result = runner.run();
  assert.equal(result.status, 'rejected');
  assert.equal(result.reason, 'no transition for (q, 0)');
  assert.equal(runner.step().status, 'rejected');
});
check('Turing machine stops a looping run at its step limit', () => {
  const runner = E.createTuringRunner({
    states: ['loop'], start: 'loop', accepts: [], alphabet: ['0'],
    tapeAlphabet: ['0', '□'],
    transitions: { loop: { '0': { write: '0', move: 'S', next: 'loop' } } },
  }, '0');
  const result = runner.run(3);
  assert.equal(result.status, 'halted');
  assert.equal(result.reason, 'step limit exceeded');
  assert.equal(result.steps, 3);
});
check('Turing machine initializes and resets empty input to one blank cell', () => {
  const runner = E.createTuringRunner({
    states: ['q', 'accept'], start: 'q', accepts: ['accept'],
    alphabet: [], tapeAlphabet: ['□'],
    transitions: { q: { '□': { write: '□', move: 'S', next: 'accept' } } },
  }, '');
  assert.deepEqual(runner.snapshot().tape, ['□']);
  assert.deepEqual(runner.snapshot().displayTape, ['□']);
  assert.equal(runner.run().output, '');
  const reset = runner.reset();
  assert.deepEqual(reset.tape, ['□']);
  assert.deepEqual(reset.history, []);
  assert.equal(reset.status, 'ready');
});
check('Turing machine supports a configured blank symbol', () => {
  const runner = E.createTuringRunner({
    states: ['q', 'accept'], start: 'q', accepts: ['accept'],
    alphabet: [], tapeAlphabet: ['_'], blank: '_',
    transitions: { q: { _: { write: '_', move: 'S', next: 'accept' } } },
  }, '');
  const result = runner.run();
  assert.equal(result.blank, '_');
  assert.deepEqual(result.tape, ['_']);
  assert.equal(result.output, '');
});
check('Turing machine validates state, alphabet, blank, move, and destination references', () => {
  const valid = {
    states: ['q', 'accept'], start: 'q', accepts: ['accept'], rejects: [],
    alphabet: ['0'], tapeAlphabet: ['0', '□'],
    transitions: { q: { '0': { write: '0', move: 'S', next: 'accept' } } },
  };
  const invalidDefinitions = [
    [{ ...valid, start: 'missing' }, /start state/],
    [{ ...valid, accepts: ['missing'] }, /accept state/],
    [{ ...valid, rejects: ['missing'] }, /reject state/],
    [{ ...valid, tapeAlphabet: ['0'] }, /blank symbol/],
    [{ ...valid, transitions: { q: { x: { write: '0', move: 'S', next: 'accept' } } } }, /Read symbol/],
    [{ ...valid, transitions: { q: { '0': { write: 'x', move: 'S', next: 'accept' } } } }, /Written symbol/],
    [{ ...valid, transitions: { q: { '0': { write: '0', move: 'X', next: 'accept' } } } }, /Invalid move/],
    [{ ...valid, transitions: { q: { '0': { write: '0', move: 'S', next: 'missing' } } } }, /Next state/],
  ];
  for (const [definition, expectedError] of invalidDefinitions) {
    assert.throws(() => E.createTuringRunner(definition, '0'), expectedError);
  }
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

module.exports = checks;
