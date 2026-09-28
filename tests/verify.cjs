const suites = [
  require('./engines.test.cjs'),
  require('./machines.test.cjs'),
  require('./ui.test.cjs'),
];
const checks = suites.reduce((total, count) => total + count, 0);
console.log(`\n${checks} verification groups passed.`);
