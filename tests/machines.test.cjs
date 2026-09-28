const assert = require("node:assert/strict");

global.window = global;
require("../engines.js");
const E = global.AutomataEngines;
let checks = 0;
function check(name, action) {
  action();
  checks++;
  console.log(`✓ ${name}`);
}
/** Enumerates every word through the requested maximum length. */
function stringsUpTo(alphabet, maxLength) {
  const strings = [""];
  let frontier = [""];
  for (let length = 1; length <= maxLength; length++) {
    frontier = frontier.flatMap((prefix) =>
      alphabet.map((symbol) => prefix + symbol),
    );
    strings.push(...frontier);
  }
  return strings;
}
/** Runs a machine with its matching engine and returns its result. */
function run(machine, input) {
  if (machine.kind === "TM") return E.createTuringRunner(machine, input).run();
  if (machine.kind === "PDA") return E.createPdaRunner(machine, input).run();
  return E.createFiniteRunner(machine, input).run();
}
/** Checks one example using acceptance status or exact transducer output. */
function assertExpected(machine, input, expected) {
  const result = run(machine, input);
  if (machine.kind === "TM" && !["accept", "reject"].includes(expected)) {
    assert.equal(
      result.status,
      "accepted",
      machine.id + ":" + JSON.stringify(input),
    );
    assert.equal(
      result.output,
      expected,
      machine.id + ":" + JSON.stringify(input),
    );
    return;
  }
  assert.equal(
    result.status,
    expected === "accept" ? "accepted" : "rejected",
    machine.id + ":" + JSON.stringify(input),
  );
}
/** Reference predicate for the language 0^n1^n. */
function isZeroNOneN(input) {
  const match = input.match(/^(0*)(1*)$/);
  return Boolean(match) && match[1].length === match[2].length;
}
/** Reference predicate for binary palindromes. */
function isBinaryPalindrome(input) {
  return input === [...input].reverse().join("");
}
/** Reference predicate for equal counts of 0 and 1. */
function hasEqualBinaryCounts(input) {
  return (
    [...input].filter((symbol) => symbol === "0").length ===
    [...input].filter((symbol) => symbol === "1").length
  );
}
/** Reference output for unary increment. */
function unaryIncrement(input) {
  return "1".repeat(input.length + 1);
}
/** Reference output for binary increment, with empty input treated as zero. */
function binaryIncrement(input) {
  return ((input === "" ? 0 : Number.parseInt(input, 2)) + 1).toString(2);
}
/** Checks the independent predicate for strings ending in 01. */
function endsIn01(input) {
  return input.endsWith("01");
}
/** Checks the independent predicate for even one-count parity. */
function hasEvenOnes(input) {
  return [...input].filter((symbol) => symbol === "1").length % 2 === 0;
}
/** Checks the independent predicate for containing 010. */
function contains010(input) {
  return input.includes("010");
}

check("every bundled machine has its basic definition fields", () => {
  for (const machines of Object.values(E.definitions)) {
    for (const machine of machines) {
      assert.ok(machine.id);
      assert.ok(machine.name);
      assert.ok(machine.states.includes(machine.start));
      assert.ok(
        machine.accepts.every((state) => machine.states.includes(state)),
      );
      assert.ok(Array.isArray(machine.alphabet));
      assert.ok(machine.transitions);
    }
  }
});
check("all machine references are valid and each DFA is total", () => {
  for (const machines of Object.values(E.definitions)) {
    for (const machine of machines) {
      const states = new Set(machine.states);
      const alphabet = new Set(machine.alphabet);
      assert.ok(states.has(machine.start), machine.id);
      assert.ok(
        machine.accepts.every((state) => states.has(state)),
        machine.id,
      );
      assert.ok(
        (machine.rejects || []).every((state) => states.has(state)),
        machine.id,
      );
      for (const [from, bySymbol] of Object.entries(machine.transitions)) {
        assert.ok(states.has(from), `${machine.id}: source ${from}`);
        for (const [symbol, configured] of Object.entries(bySymbol)) {
          if (machine.kind === "TM") {
            assert.ok(
              machine.tapeAlphabet.includes(symbol),
              `${machine.id}: read ${symbol}`,
            );
            assert.ok(
              machine.tapeAlphabet.includes(configured.write),
              `${machine.id}: write ${configured.write}`,
            );
            assert.ok(
              states.has(configured.next),
              `${machine.id}: next ${configured.next}`,
            );
          } else if (machine.kind === "PDA") {
            assert.ok(
              symbol === "ε" || alphabet.has(symbol),
              `${machine.id}: input ${symbol}`,
            );
            for (const configuredRules of Object.values(configured)) {
              for (const rule of Array.isArray(configuredRules)
                ? configuredRules
                : [configuredRules]) {
                assert.ok(
                  states.has(rule.next),
                  `${machine.id}: next ${rule.next}`,
                );
              }
            }
          } else {
            assert.ok(
              symbol === "ε" || alphabet.has(symbol),
              `${machine.id}: input ${symbol}`,
            );
            for (const next of Array.isArray(configured)
              ? configured
              : [configured]) {
              assert.ok(states.has(next), `${machine.id}: next ${next}`);
            }
          }
        }
      }
      if (machine.kind === "DFA") {
        for (const state of machine.states) {
          for (const symbol of machine.alphabet) {
            assert.ok(
              Object.hasOwn(machine.transitions[state] || {}, symbol),
              `${machine.id}: missing ${state}/${symbol}`,
            );
            assert.equal(
              typeof machine.transitions[state][symbol],
              "string",
              `${machine.id}: nondeterministic DFA transition`,
            );
          }
        }
      }
      if (machine.kind === "TM") {
        E.createTuringRunner(machine, machine.example);
      } else if (machine.kind === "PDA") {
        E.createPdaRunner(machine, machine.example);
      }
    }
  }
});
check("all bundled machine examples match their advertised outcomes", () => {
  for (const machines of Object.values(E.definitions)) {
    for (const machine of machines) {
      assert.equal(
        run(machine, machine.example).status,
        "accepted",
        machine.id,
      );
      for (const example of machine.examples || []) {
        assertExpected(machine, example.input, example.expected);
      }
    }
  }
});
check("0^n1^n TM matches a counter reference through length 10", () => {
  const machine = E.definitions.tm.find((item) => item.id === "tm-0n1n");
  for (const input of stringsUpTo(machine.alphabet, 10)) {
    const expected = isZeroNOneN(input) ? "accepted" : "rejected";
    assert.equal(run(machine, input).status, expected, JSON.stringify(input));
  }
});
check(
  "binary palindrome TM matches a string reference through length 10",
  () => {
    const machine = E.definitions.tm.find(
      (item) => item.id === "tm-palindrome",
    );
    for (const input of stringsUpTo(machine.alphabet, 10)) {
      const expected = isBinaryPalindrome(input) ? "accepted" : "rejected";
      assert.equal(run(machine, input).status, expected, JSON.stringify(input));
    }
  },
);
check("equal-count TM matches a counter reference through length 10", () => {
  const machine = E.definitions.tm.find((item) => item.id === "tm-equal-01");
  for (const input of stringsUpTo(machine.alphabet, 10)) {
    const expected = hasEqualBinaryCounts(input) ? "accepted" : "rejected";
    assert.equal(run(machine, input).status, expected, JSON.stringify(input));
  }
});
check("unary increment TM matches n+1 through length 10", () => {
  const machine = E.definitions.tm.find((item) => item.id === "tm-unary-inc");
  for (const input of stringsUpTo(machine.alphabet, 10)) {
    const result = run(machine, input);
    assert.equal(result.status, "accepted", JSON.stringify(input));
    assert.equal(result.output, unaryIncrement(input), JSON.stringify(input));
  }
});
check("binary increment TM matches arithmetic through length 10", () => {
  const machine = E.definitions.tm.find((item) => item.id === "tm-binary-inc");
  for (const input of stringsUpTo(machine.alphabet, 10)) {
    const result = run(machine, input);
    assert.equal(result.status, "accepted", JSON.stringify(input));
    assert.equal(result.output, binaryIncrement(input), JSON.stringify(input));
  }
});
check("ends-01 DFA matches its reference through length 8", () => {
  const machine = E.definitions.dfa.find((item) => item.id === "ends-01");
  for (const input of stringsUpTo(machine.alphabet, 8)) {
    assert.equal(
      run(machine, input).status === "accepted",
      endsIn01(input),
      JSON.stringify(input),
    );
  }
});
check("even-ones DFA matches parity through length 8", () => {
  const machine = E.definitions.dfa.find((item) => item.id === "even-ones");
  for (const input of stringsUpTo(machine.alphabet, 8)) {
    assert.equal(
      run(machine, input).status === "accepted",
      hasEvenOnes(input),
      JSON.stringify(input),
    );
  }
});
check("contains-010 NFA matches its reference through length 8", () => {
  const machine = E.definitions.dfa.find((item) => item.id === "contains-aba");
  for (const input of stringsUpTo(machine.alphabet, 8)) {
    assert.equal(
      run(machine, input).status === "accepted",
      contains010(input),
      JSON.stringify(input),
    );
  }
});
check(
  "epsilon NFA accepts the nonempty binary strings through length 8",
  () => {
    const machine = E.definitions.dfa.find(
      (item) => item.id === "epsilon-choice",
    );
    for (const input of stringsUpTo(machine.alphabet, 8)) {
      assert.equal(
        run(machine, input).status === "accepted",
        input.length > 0,
        JSON.stringify(input),
      );
    }
  },
);

module.exports = checks;
