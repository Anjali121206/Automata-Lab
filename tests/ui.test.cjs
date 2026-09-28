const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
let checks = 0;
function check(name, action) {
  action();
  checks++;
  console.log(`✓ ${name}`);
}

check('page loads engine definitions before the UI script', () => {
  assert.ok(html.includes('href="styles.css"'));
  assert.ok(html.indexOf('src="engines.js"') < html.indexOf('src="app.js"'));
});
check('simulator markup exposes its machine selector and execution controls', () => {
  for (const id of ['machine-select', 'input-string', 'run-button', 'step-button', 'diagram-svg']) {
    assert.ok(html.includes(`id="${id}"`), id);
  }
});

module.exports = checks;
