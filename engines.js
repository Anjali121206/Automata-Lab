/* Lightweight, framework-free automata engines. Machine records are data; the
  runners below own the execution rules and return one observable step. */
/** @param {Window} root Browser global receiving the public engine API. */
(function (root) {
  const EPSILON = "ε";
  const definitions = {
    dfa: [
      {
        id: "ends-01",
        name: "Ends with 01",
        kind: "DFA",
        description: "Accepts binary strings whose final two symbols are 01.",
        alphabet: ["0", "1"],
        states: ["q₀", "q₁", "q₂"],
        start: "q₀",
        accepts: ["q₂"],
        example: "1101",
        transitions: {
          "q₀": { 0: "q₁", 1: "q₀" },
          "q₁": { 0: "q₁", 1: "q₂" },
          "q₂": { 0: "q₁", 1: "q₀" },
        },
        notes:
          "A compact DFA remembers the most recent suffix that could begin the pattern 01.",
      },
      {
        id: "even-ones",
        name: "Even number of 1s",
        kind: "DFA",
        description: "Accepts binary strings containing an even number of 1s.",
        alphabet: ["0", "1"],
        states: ["Even", "Odd"],
        start: "Even",
        accepts: ["Even"],
        example: "1010",
        transitions: {
          Even: { 0: "Even", 1: "Odd" },
          Odd: { 0: "Odd", 1: "Even" },
        },
        notes: "Reading a 1 flips parity; reading a 0 leaves it unchanged.",
      },
      {
        id: "contains-aba",
        name: "Contains 010",
        kind: "NFA",
        description:
          "An NFA that accepts any binary string containing the substring 010.",
        alphabet: ["0", "1"],
        states: ["q₀", "q₁", "q₂", "q₃"],
        start: "q₀",
        accepts: ["q₃"],
        example: "11010",
        transitions: {
          "q₀": { 0: ["q₀", "q₁"], 1: ["q₀"] },
          "q₁": { 1: ["q₂"] },
          "q₂": { 0: ["q₃"] },
          "q₃": { 0: ["q₃"], 1: ["q₃"] },
        },
        notes:
          "At every prefix, the NFA can guess that a 0 starts the pattern. A set of active states represents all parallel paths.",
      },
      {
        id: "epsilon-choice",
        name: "NFA with ε-moves",
        kind: "NFA",
        description:
          "Accepts strings ending in 0 or ending in 1, using an ε-branch from the start.",
        alphabet: ["0", "1"],
        states: ["s", "a", "b", "F₀", "F₁"],
        start: "s",
        accepts: ["F₀", "F₁"],
        example: "101",
        transitions: {
          s: { ε: ["a", "b"] },
          a: { 0: ["a", "F₀"], 1: ["a"] },
          b: { 0: ["b"], 1: ["b", "F₁"] },
        },
        notes:
          "An ε-transition changes state without consuming an input symbol. The engine computes ε-closure before and after each symbol.",
      },
    ],
    tm: [
      {
        id: "tm-binary-inc",
        name: "Binary increment",
        kind: "TM",
        description:
          "Adds one to a binary number by scanning to the end, then propagating carry left.",
        alphabet: ["0", "1"],
        tapeAlphabet: ["0", "1", "□"],
        states: ["q₀", "carry", "accept"],
        start: "q₀",
        accepts: ["accept"],
        example: "1011",
        transitions: {
          "q₀": {
            0: { write: "0", move: "R", next: "q₀" },
            1: { write: "1", move: "R", next: "q₀" },
            "□": { write: "□", move: "L", next: "carry" },
          },
          carry: {
            1: { write: "0", move: "L", next: "carry" },
            0: { write: "1", move: "S", next: "accept" },
            "□": { write: "1", move: "S", next: "accept" },
          },
        },
        notes:
          "The machine first finds the blank after the input. It flips trailing 1s to 0s and increments the first 0; an all-1 input grows by one cell.",
      },
      {
        id: "tm-unary-inc",
        name: "Unary increment",
        kind: "TM",
        description: "Appends one 1 to a unary number (a string of 1s).",
        alphabet: ["1"],
        tapeAlphabet: ["1", "□"],
        states: ["scan", "accept"],
        start: "scan",
        accepts: ["accept"],
        example: "111",
        transitions: {
          scan: {
            1: { write: "1", move: "R", next: "scan" },
            "□": { write: "1", move: "S", next: "accept" },
          },
        },
        notes:
          "The head scans right over every 1, then writes a final 1 in the first blank cell.",
      },
    ],
    pda: [
      {
        id: "pda-parens",
        name: "Balanced parentheses",
        kind: "PDA",
        description:
          "Accepts properly balanced strings of parentheses using a stack.",
        alphabet: ["(", ")"],
        states: ["q", "accept"],
        start: "q",
        accepts: ["accept"],
        example: "(()())",
        transitions: {
          q: {
            "(": { any: { push: "(", next: "q" } },
            ")": { "(": { pop: true, next: "q" } },
          },
        },
        notes:
          "Each opening parenthesis is pushed. A closing parenthesis must pop one. The input is accepted only when it ends with an empty stack.",
      },
      {
        id: "pda-anbn",
        name: "Language aⁿbⁿ",
        kind: "PDA",
        description:
          "Accepts aⁿbⁿ (including ε): push one marker per a, then pop one per b.",
        alphabet: ["a", "b"],
        states: ["push", "pop", "accept"],
        start: "push",
        accepts: ["accept"],
        example: "aaabbb",
        transitions: {
          push: {
            a: { any: { push: "A", next: "push" } },
            b: { A: { pop: true, next: "pop" } },
          },
          pop: { b: { A: { pop: true, next: "pop" } } },
        },
        notes:
          "The stack counts the a symbols. The first b switches to matching mode; each b removes one marker.",
      },
    ],
  };
  /** Computes the epsilon closure of a finite set of states. */
  function closure(machine, states) {
    const found = new Set(states),
      todo = [...found];
    while (todo.length) {
      const s = todo.pop(),
        destinations = machine.transitions[s]?.[EPSILON] || [];
      for (const d of Array.isArray(destinations)
        ? destinations
        : [destinations])
        if (!found.has(d)) {
          found.add(d);
          todo.push(d);
        }
    }
    return found;
  }
  /** Creates a stepwise DFA/NFA runner for one input string. */
  function createFiniteRunner(machine, input) {
    let position = 0,
      active = closure(machine, [machine.start]),
      history = [],
      status = "ready";
    /** Returns a detached view of the current finite-machine configuration. */
    const snapshot = () => ({
      position,
      active: [...active],
      history: [...history],
      status,
      reading: input[position] ?? "∅",
    });
    /** Advances all active paths by one input symbol. */
    function step() {
      if (status !== "ready" && status !== "running") return snapshot();
      if (position >= input.length) {
        status = [...active].some((s) => machine.accepts.includes(s))
          ? "accepted"
          : "rejected";
        return snapshot();
      }
      const symbol = input[position],
        before = [...active],
        next = new Set();
      for (const state of active) {
        const dest = machine.transitions[state]?.[symbol];
        if (dest)
          for (const d of Array.isArray(dest) ? dest : [dest]) next.add(d);
      }
      active = closure(machine, next);
      history.push({
        index: history.length + 1,
        state: before.join(", ") || "∅",
        symbol,
        transition: `${before.join(", ") || "∅"} —${symbol}→ ${[...active].join(", ") || "∅"}`,
        to: [...active].join(", ") || "∅",
      });
      position++;
      status = "running";
      if (!active.size) status = "rejected";
      if (position === input.length && status !== "rejected")
        status = [...active].some((s) => machine.accepts.includes(s))
          ? "accepted"
          : "rejected";
      return snapshot();
    }
    return {
      step,
      snapshot,
      /** Runs until the finite machine accepts or rejects. */
      run() {
        while (status === "ready" || status === "running") step();
        return snapshot();
      },
      /** Restores the initial state and clears the execution history. */
      reset() {
        position = 0;
        active = closure(machine, [machine.start]);
        history = [];
        status = "ready";
        return snapshot();
      },
    };
  }
  /** Creates a stepwise Turing-machine runner for one input string. */
  function createTuringRunner(machine, input) {
    if (!machine || !Array.isArray(machine.states)) {
      throw new Error("Turing machine states must be an array.");
    }
    if (typeof input !== "string") {
      throw new Error("Turing machine input must be a string.");
    }

    const states = new Set(machine.states);
    const accepts = machine.accepts || [];
    const rejects = machine.rejects || [];
    const alphabet = new Set(machine.alphabet || []);
    const tapeAlphabet = new Set(machine.tapeAlphabet || []);
    const transitions = machine.transitions || {};
    const blank = machine.blank ?? "□";

    if (!states.has(machine.start)) {
      throw new Error(`Turing machine start state "${machine.start}" does not exist.`);
    }
    for (const state of accepts) {
      if (!states.has(state)) {
        throw new Error(`Turing machine accept state "${state}" does not exist.`);
      }
    }
    for (const state of rejects) {
      if (!states.has(state)) {
        throw new Error(`Turing machine reject state "${state}" does not exist.`);
      }
    }
    if (!tapeAlphabet.has(blank)) {
      throw new Error(`Turing machine blank symbol "${blank}" is not in tapeAlphabet.`);
    }
    for (const symbol of alphabet) {
      if (!tapeAlphabet.has(symbol)) {
        throw new Error(`Input symbol "${symbol}" is not in tapeAlphabet.`);
      }
    }
    for (const [from, bySymbol] of Object.entries(transitions)) {
      if (!states.has(from)) {
        throw new Error(`Turing transition state "${from}" does not exist.`);
      }
      for (const [symbol, rule] of Object.entries(bySymbol)) {
        if (!tapeAlphabet.has(symbol)) {
          throw new Error(`Read symbol "${symbol}" is not in tapeAlphabet.`);
        }
        if (!rule || typeof rule !== "object") {
          throw new Error(`Transition for (${from}, ${symbol}) must be a rule object.`);
        }
        if (!tapeAlphabet.has(rule.write)) {
          throw new Error(`Written symbol "${rule.write}" is not in tapeAlphabet.`);
        }
        if (!["L", "R", "S"].includes(rule.move)) {
          throw new Error(`Invalid move "${rule.move}" for (${from}, ${symbol}); expected L, R, or S.`);
        }
        if (!states.has(rule.next)) {
          throw new Error(`Next state "${rule.next}" for (${from}, ${symbol}) does not exist.`);
        }
      }
    }
    for (const symbol of input) {
      if (!alphabet.has(symbol)) {
        throw new Error(`Input symbol "${symbol}" is not in the machine alphabet.`);
      }
    }

    let tape = input.length ? [...input] : [blank];
    let head = 0;
    let state = machine.start;
    let history = [];
    let status = "ready";
    let steps = 0;
    let reason = null;

    /** Reads the current tape cell, using blank beyond the allocated tape. */
    const read = () => tape[head] ?? blank;
    /** Returns the nonblank output symbols remaining on the tape. */
    const output = () => {
      let first = 0;
      let last = tape.length;
      while (first < last && tape[first] === blank) first++;
      while (last > first && tape[last - 1] === blank) last--;
      return tape.slice(first, last).join("");
    };
    /** Returns a detached view of the current tape configuration. */
    const snap = () => ({
      tape: [...tape],
      displayTape: [...tape],
      head,
      headIndex: head,
      state,
      history: [...history],
      status,
      steps,
      reading: read(),
      blank,
      reason,
      output: output(),
    });
    /** Applies one transition or records the applicable terminal outcome. */
    function step() {
      if (!["ready", "running"].includes(status)) return snap();
      if (accepts.includes(state)) {
        status = "accepted";
        return snap();
      }
      if (rejects.includes(state)) {
        status = "rejected";
        return snap();
      }

      const symbol = read();
      const rule = transitions[state]?.[symbol];
      if (!rule) {
        status = "rejected";
        reason = `no transition for (${state}, ${symbol})`;
        return snap();
      }

      const before = state;
      const headBefore = head;
      tape[head] = rule.write;
      const nextHead = head + (rule.move === "L" ? -1 : rule.move === "R" ? 1 : 0);
      if (nextHead < 0) {
        tape.unshift(blank);
        head = 0;
      } else {
        head = nextHead;
        if (head >= tape.length) tape.push(blank);
      }
      state = rule.next;
      steps++;
      status = accepts.includes(state)
        ? "accepted"
        : rejects.includes(state)
          ? "rejected"
          : "running";
      history.push({
        index: steps,
        state: before,
        symbol,
        transition: `${symbol} → ${rule.write}, ${rule.move}`,
        to: state,
        write: rule.write,
        move: rule.move,
        headBefore,
        headAfter: head,
      });
      return snap();
    }
    return {
      step,
      snapshot: snap,
      /** Runs until termination or the requested transition limit. */
      run(maxSteps = 10000) {
        if (!Number.isInteger(maxSteps) || maxSteps < 0) {
          throw new Error("Turing run maxSteps must be a non-negative integer.");
        }
        let runSteps = 0;
        while (["ready", "running"].includes(status) && runSteps < maxSteps) {
          const previousSteps = steps;
          step();
          if (steps > previousSteps) runSteps++;
        }
        if (["ready", "running"].includes(status)) {
          status = "halted";
          reason = "step limit exceeded";
        }
        return snap();
      },
      /** Restores the initial tape and machine state. */
      reset() {
        tape = input.length ? [...input] : [blank];
        head = 0;
        state = machine.start;
        history = [];
        status = "ready";
        steps = 0;
        reason = null;
        return snap();
      },
    };
  }
  /** Creates a stepwise pushdown-automaton runner for one input string. */
  function createPdaRunner(machine, input) {
    let pos = 0,
      state = machine.start,
      stack = ["Z₀"],
      history = [],
      status = "ready";
    /** Returns a detached view of the current stack configuration. */
    const snap = () => ({
      position: pos,
      state,
      stack: [...stack],
      history: [...history],
      status,
      reading: input[pos] ?? "ε",
    });
    /** Applies one matching stack transition. */
    function step() {
      if (!["ready", "running"].includes(status)) return snap();
      if (pos >= input.length) {
        status =
          machine.accepts.includes(state) ||
          (stack.length === 1 && stack[0] === "Z₀")
            ? "accepted"
            : "rejected";
        if (machine.accepts.includes(state)) status = "accepted";
        return snap();
      }
      const symbol = input[pos],
        top = stack[stack.length - 1],
        before = state;
      let rule =
        machine.transitions[state]?.[symbol]?.[top] ||
        machine.transitions[state]?.[symbol]?.any;
      if (!rule) {
        status = "rejected";
        return snap();
      }
      if (rule.pop) stack.pop();
      if (rule.push) stack.push(rule.push);
      state = rule.next;
      pos++;
      history.push({
        index: history.length + 1,
        state: before,
        symbol,
        transition: `${symbol}, ${top} → ${rule.pop ? "pop" : rule.push ? "push " + rule.push : "no stack change"}`,
        to: state,
      });
      status =
        pos === input.length
          ? machine.accepts.includes(state) ||
            (stack.length === 1 && stack[0] === "Z₀")
            ? "accepted"
            : "rejected"
          : "running";
      return snap();
    }
    return {
      step,
      snapshot: snap,
      /** Runs until the PDA accepts or rejects. */
      run() {
        while (status === "ready" || status === "running") step();
        return snap();
      },
      /** Restores the initial stack and clears the execution history. */
      reset() {
        pos = 0;
        state = machine.start;
        stack = ["Z₀"];
        history = [];
        status = "ready";
        return snap();
      },
    };
  }
  root.AutomataEngines = {
    EPSILON,
    definitions,
    createFiniteRunner,
    createTuringRunner,
    createPdaRunner,
    closure,
  };
})(window);
