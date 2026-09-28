# Automata Lab

An interactive Theory of Computation simulator built with plain HTML, CSS, and JavaScript. It runs directly in a browser and needs no package installation or build step.

## Run it

Open `index.html` in a modern browser. Choose an automaton type, select a sample machine, enter a string from its alphabet, then use **Run**, **Step**, **Pause**, and **Reset**. `Ctrl+Enter` (or `⌘+Enter`) starts a run; `Esc` pauses it.

Run the dependency-free verification suite with Node.js: `node tests/verify.cjs` or `npm test`.

## What's included

- DFA runner with deterministic transition lookup and acceptance by final state.
- NFA runner with sets of active states and ε-closure before and after each input symbol.
- Turing machine runner with a read/write tape, expandable blank cells, left/right/stay movement, transition history, and accept/reject/halt outcomes.
- PDA runner with push/pop operations, stack-top transition matching, and acceptance by final state or empty stack.
- Shared responsive interface: machine selector, input validation, state diagram, tape/stack visualizations, controls, speed setting, live status, and execution trace.
- Sample machines: strings ending in `01`, even number of `1`s, substring `010`, ε-branching NFA, binary increment, unary increment, balanced parentheses, and `aⁿbⁿ`.

## Structure

- `index.html` — page layout and accessible controls.
- `styles.css` — responsive visual design.
- `engines.js` — machine definitions and small, UI-independent execution engines.
- `app.js` — rendering and interaction wiring.
- `tests/verify.cjs` — runs all dependency-free test modules.
- `tests/engines.test.cjs` — representative DFA, NFA, TM, and PDA runner checks.
- `tests/machines.test.cjs` — bundled machine definition and example checks.
- `tests/ui.test.cjs` — simulator markup wiring checks.

The engines are exposed as `window.AutomataEngines`. Each runner provides `step()`, `run()`, `reset()`, and `snapshot()`. To integrate another team's engines, adapt their transition results to the same snapshot fields (`state` or `active`, `reading`, `history`, and `status`) and wire them through the corresponding mode in `app.js`.

## Extending the machine library

Add a machine record to `definitions.dfa`, `definitions.tm`, or `definitions.pda` in `engines.js`. Finite-machine transitions map a state and symbol to one destination or an array of destinations; use `ε` for a non-consuming NFA transition. TM transitions are `{ write, move, next }`, where `move` is `L`, `R`, or `S`. PDA transitions are keyed by input symbol and stack top and contain `{ push, next }` or `{ pop: true, next }`; use `any` as the stack-top key when the transition is independent of the stack.

## Current integration boundary

The bundled Turing machine and PDA runners provide functional demonstrations and a shared UI baseline. They can be replaced with the team's authoritative engines without changing the overall screen structure.
