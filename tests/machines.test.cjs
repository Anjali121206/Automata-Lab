const assert = require('node:assert/strict');

global.window = global;
require('../engines.js');
const E = global.AutomataEngines;
let checks = 0;
function check(name, action) {
  action();
  checks++;
  console.log(`✓ ${name}`);
}

check('every bundled machine has its basic definition fields', () => {
  for (const machines of Object.values(E.definitions)) {
    for (const machine of machines) {
      assert.ok(machine.id);
      assert.ok(machine.name);
      assert.ok(machine.states.includes(machine.start));
      assert.ok(machine.accepts.every(state => machine.states.includes(state)));
      assert.ok(Array.isArray(machine.alphabet));
      assert.ok(machine.transitions);
    }
  }
});
check('every bundled example reaches its advertised accepting result', () => {
  for (const machines of Object.values(E.definitions)) {
    for (const machine of machines) {
      const runner = machine.kind === 'TM'
        ? E.createTuringRunner(machine, machine.example)
        : machine.kind === 'PDA'
          ? E.createPdaRunner(machine, machine.example)
          : E.createFiniteRunner(machine, machine.example);
      assert.equal(runner.run().status, 'accepted', machine.id);
    }
  }
});

module.exports = checks;
