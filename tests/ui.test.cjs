const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
global.window = global;
require("../engines.js");
const E = global.AutomataEngines;
const UI = require("../app.js");
let checks = 0;
function check(name, action) {
  action();
  checks++;
  console.log(`✓ ${name}`);
}

check("page loads engine definitions before the UI script", () => {
  assert.ok(html.includes('href="styles.css"'));
  assert.ok(html.indexOf('src="engines.js"') < html.indexOf('src="app.js"'));
});
check(
  "simulator markup exposes its machine selector and execution controls",
  () => {
    for (const id of [
      "machine-select",
      "input-string",
      "run-button",
      "step-button",
      "diagram-svg",
    ]) {
      assert.ok(html.includes(`id="${id}"`), id);
    }
  },
);
/** Adds a source transition triple to an expected edge set. */
function addExpected(expected, from, to, symbol) {
  expected.add(JSON.stringify([from, to, symbol]));
}
/** Derives transition triples from a bundled machine definition. */
function expectedEdges(machine) {
  const expected = new Set();
  for (const [from, bySymbol] of Object.entries(machine.transitions || {})) {
    for (const [symbol, configured] of Object.entries(bySymbol)) {
      if (machine.kind === "TM") {
        addExpected(expected, from, configured.next, symbol);
      } else if (machine.kind === "PDA") {
        for (const configuredRules of Object.values(configured)) {
          const rules = Array.isArray(configuredRules)
            ? configuredRules
            : [configuredRules];
          for (const rule of rules)
            addExpected(expected, from, rule.next, symbol);
        }
      } else {
        const destinations = Array.isArray(configured)
          ? configured
          : [configured];
        for (const to of destinations) addExpected(expected, from, to, symbol);
      }
    }
  }
  return expected;
}
/** Counts individual rules represented by one machine's transition table. */
function expectedRuleCount(machine) {
  let count = 0;
  for (const bySymbol of Object.values(machine.transitions || {})) {
    for (const configured of Object.values(bySymbol)) {
      if (machine.kind === "TM") count++;
      else if (machine.kind === "PDA") {
        for (const rules of Object.values(configured))
          count += Array.isArray(rules) ? rules.length : 1;
      } else count += Array.isArray(configured) ? configured.length : 1;
    }
  }
  return count;
}
check(
  "every bundled machine diagram exactly matches its transition triples",
  () => {
    for (const machines of Object.values(E.definitions)) {
      for (const machine of machines) {
        const model = UI.buildDiagramModel(machine);
        const actual = new Set(
          model.edges.flatMap((edge) =>
            edge.transitions.map((transition) =>
              JSON.stringify([edge.from, edge.to, transition.symbol]),
            ),
          ),
        );
        assert.deepEqual(actual, expectedEdges(machine), machine.id);
        assert.equal(model.nodes.length, machine.states.length, machine.id);
      }
    }
  },
);
check(
  "diagram layout is left-to-right with upper loops and opposite reciprocal curves",
  () => {
    for (const machines of Object.values(E.definitions)) {
      for (const machine of machines) {
        const model = UI.buildDiagramModel(machine);
        const layout = UI.buildDiagramLayout(machine, model);
        const xPositions = layout.coordinates.map((point) => point.x);
        const rowY = layout.coordinates[0]?.y;
        assert.equal(layout.nodes[0]?.state, machine.start, machine.id);
        assert.ok(
          layout.coordinates.every((point) => point.y === rowY),
          machine.id,
        );
        assert.ok(
          xPositions.every(
            (x, index) => index === 0 || x > xPositions[index - 1],
          ),
          machine.id,
        );
        for (const route of layout.edgeRoutes.filter((edge) => edge.selfLoop)) {
          assert.equal(route.loopSide, -1, `${machine.id}:${route.from}`);
        }
        for (const route of layout.edgeRoutes) {
          if (route.selfLoop) continue;
          const reverse = layout.edgeRoutes.find(
            (edge) =>
              !edge.selfLoop &&
              edge.from === route.to &&
              edge.to === route.from,
          );
          if (!reverse) continue;
          assert.ok(route.curved, `${machine.id}:${route.from}->${route.to}`);
          assert.notEqual(
            route.curveSide,
            reverse.curveSide,
            `${machine.id}:${route.from}<->${route.to}`,
          );
        }
      }
    }
  },
);
check("every bundled transition table contains one entry per rule", () => {
  for (const machines of Object.values(E.definitions)) {
    for (const machine of machines) {
      const table = UI.buildTransitionTable(machine);
      assert.equal(table.ruleCount, expectedRuleCount(machine), machine.id);
    }
  }
});
check(
  "input validation rejects unknown symbols and permits the empty string",
  () => {
    const machine = E.definitions.dfa[0];
    assert.deepEqual(UI.validateInput(machine, "10x"), {
      ok: false,
      invalidSymbols: ["x"],
    });
    assert.deepEqual(UI.validateInput(machine, ""), {
      ok: true,
      invalidSymbols: [],
    });
  },
);
check(
  "speed delay decreases monotonically as the speed control increases",
  () => {
    const delays = [1, 2, 3, 4, 5].map(UI.speedToDelay);
    for (let index = 1; index < delays.length; index++) {
      assert.ok(delays[index] < delays[index - 1]);
    }
  },
);

module.exports = checks;
