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
        id: "tm-0n1n",
        name: "0ⁿ1ⁿ",
        kind: "TM",
        description:
          "Decides whether a binary string contains n zeroes followed by n ones. It marks one zero and one matching one on each pass, then checks that only matched symbols remain.",
        alphabet: ["0", "1"],
        tapeAlphabet: ["0", "1", "X", "Y", "□"],
        states: [
          "findZero",
          "seekOne",
          "returnLeft",
          "checkEnd",
          "accept",
          "reject",
        ],
        start: "findZero",
        accepts: ["accept"],
        rejects: ["reject"],
        example: "0011",
        examples: [
          { input: "", expected: "accept" },
          { input: "01", expected: "accept" },
          { input: "0011", expected: "accept" },
          { input: "000111", expected: "accept" },
          { input: "011", expected: "reject" },
          { input: "001", expected: "reject" },
          { input: "0101", expected: "reject" },
        ],
        transitions: {
          findZero: {
            X: { write: "X", move: "R", next: "findZero" },
            0: { write: "X", move: "R", next: "seekOne" },
            Y: { write: "Y", move: "R", next: "checkEnd" },
            1: { write: "1", move: "S", next: "reject" },
            "□": { write: "□", move: "S", next: "accept" },
          },
          seekOne: {
            0: { write: "0", move: "R", next: "seekOne" },
            Y: { write: "Y", move: "R", next: "seekOne" },
            1: { write: "Y", move: "L", next: "returnLeft" },
            "□": { write: "□", move: "S", next: "reject" },
          },
          returnLeft: {
            X: { write: "X", move: "L", next: "returnLeft" },
            Y: { write: "Y", move: "L", next: "returnLeft" },
            0: { write: "0", move: "L", next: "returnLeft" },
            1: { write: "1", move: "L", next: "returnLeft" },
            "□": { write: "□", move: "R", next: "findZero" },
          },
          checkEnd: {
            Y: { write: "Y", move: "R", next: "checkEnd" },
            0: { write: "0", move: "S", next: "reject" },
            1: { write: "1", move: "S", next: "reject" },
            X: { write: "X", move: "S", next: "reject" },
            "□": { write: "□", move: "S", next: "accept" },
          },
        },
        notes:
          "The left scan marks the first unmarked 0 as X, then the right scan marks the first available 1 as Y. After returning to the left edge, it repeats; once it reaches Y, the final scan accepts only if no unmarked input remains.",
      },
      {
        id: "tm-palindrome",
        name: "Palindromes over {0,1}",
        kind: "TM",
        description:
          "Decides whether a binary string reads the same from left to right and right to left. It marks the leftmost unmarked symbol, travels to the last unmarked symbol, compares them, and repeats.",
        alphabet: ["0", "1"],
        tapeAlphabet: ["0", "1", "X", "Y", "□"],
        states: [
          "findLeft",
          "seekEnd0",
          "seekEnd1",
          "match0",
          "match1",
          "returnLeft",
          "accept",
          "reject",
        ],
        start: "findLeft",
        accepts: ["accept"],
        rejects: ["reject"],
        example: "0110",
        examples: [
          { input: "", expected: "accept" },
          { input: "0", expected: "accept" },
          { input: "1", expected: "accept" },
          { input: "00", expected: "accept" },
          { input: "0110", expected: "accept" },
          { input: "010", expected: "accept" },
          { input: "01100", expected: "reject" },
        ],
        transitions: {
          findLeft: {
            X: { write: "X", move: "R", next: "findLeft" },
            Y: { write: "Y", move: "R", next: "findLeft" },
            0: { write: "X", move: "R", next: "seekEnd0" },
            1: { write: "Y", move: "R", next: "seekEnd1" },
            "□": { write: "□", move: "S", next: "accept" },
          },
          seekEnd0: {
            0: { write: "0", move: "R", next: "seekEnd0" },
            1: { write: "1", move: "R", next: "seekEnd0" },
            X: { write: "X", move: "R", next: "seekEnd0" },
            Y: { write: "Y", move: "R", next: "seekEnd0" },
            "□": { write: "□", move: "L", next: "match0" },
          },
          seekEnd1: {
            0: { write: "0", move: "R", next: "seekEnd1" },
            1: { write: "1", move: "R", next: "seekEnd1" },
            X: { write: "X", move: "R", next: "seekEnd1" },
            Y: { write: "Y", move: "R", next: "seekEnd1" },
            "□": { write: "□", move: "L", next: "match1" },
          },
          match0: {
            X: { write: "X", move: "L", next: "match0" },
            Y: { write: "Y", move: "L", next: "match0" },
            0: { write: "X", move: "L", next: "returnLeft" },
            1: { write: "1", move: "S", next: "reject" },
            "□": { write: "□", move: "S", next: "accept" },
          },
          match1: {
            X: { write: "X", move: "L", next: "match1" },
            Y: { write: "Y", move: "L", next: "match1" },
            1: { write: "Y", move: "L", next: "returnLeft" },
            0: { write: "0", move: "S", next: "reject" },
            "□": { write: "□", move: "S", next: "accept" },
          },
          returnLeft: {
            X: { write: "X", move: "L", next: "returnLeft" },
            Y: { write: "Y", move: "L", next: "returnLeft" },
            0: { write: "0", move: "L", next: "returnLeft" },
            1: { write: "1", move: "L", next: "returnLeft" },
            "□": { write: "□", move: "R", next: "findLeft" },
          },
        },
        notes:
          "The machine marks the leftmost unmarked 0 as X or 1 as Y. It scans to the right boundary, skips already marked cells while moving left, and either marks a matching symbol or rejects; reaching blank with no partner handles a single center symbol.",
      },
      {
        id: "tm-equal-01",
        name: "Equal number of 0s and 1s",
        kind: "TM",
        description:
          "Decides whether a binary string has the same number of zeroes and ones in any order. It marks the leftmost unmarked symbol and searches right for one of the opposite kind to cancel it.",
        alphabet: ["0", "1"],
        tapeAlphabet: ["0", "1", "X", "Y", "□"],
        states: [
          "find",
          "seekOne",
          "seekZero",
          "returnLeft",
          "accept",
          "reject",
        ],
        start: "find",
        accepts: ["accept"],
        rejects: ["reject"],
        example: "0101",
        examples: [
          { input: "", expected: "accept" },
          { input: "01", expected: "accept" },
          { input: "10", expected: "accept" },
          { input: "0011", expected: "accept" },
          { input: "0101", expected: "accept" },
          { input: "0001", expected: "reject" },
        ],
        transitions: {
          find: {
            X: { write: "X", move: "R", next: "find" },
            Y: { write: "Y", move: "R", next: "find" },
            0: { write: "X", move: "R", next: "seekOne" },
            1: { write: "Y", move: "R", next: "seekZero" },
            "□": { write: "□", move: "S", next: "accept" },
          },
          seekOne: {
            0: { write: "0", move: "R", next: "seekOne" },
            X: { write: "X", move: "R", next: "seekOne" },
            Y: { write: "Y", move: "R", next: "seekOne" },
            1: { write: "Y", move: "L", next: "returnLeft" },
            "□": { write: "□", move: "S", next: "reject" },
          },
          seekZero: {
            1: { write: "1", move: "R", next: "seekZero" },
            X: { write: "X", move: "R", next: "seekZero" },
            Y: { write: "Y", move: "R", next: "seekZero" },
            0: { write: "X", move: "L", next: "returnLeft" },
            "□": { write: "□", move: "S", next: "reject" },
          },
          returnLeft: {
            X: { write: "X", move: "L", next: "returnLeft" },
            Y: { write: "Y", move: "L", next: "returnLeft" },
            0: { write: "0", move: "L", next: "returnLeft" },
            1: { write: "1", move: "L", next: "returnLeft" },
            "□": { write: "□", move: "R", next: "find" },
          },
        },
        notes:
          "The left-to-right scan picks the first uncanceled symbol. The matching state searches only to its right for the opposite symbol, marks the pair, and returns to the left edge; an unmatched symbol rejects and an exhausted tape accepts.",
      },
      {
        id: "tm-binary-inc",
        name: "Binary increment",
        kind: "TM",
        description:
          "Adds one to a binary number by scanning to the end and propagating carry left. The output is the trimmed tape contents after the accepting state is reached.",
        alphabet: ["0", "1"],
        tapeAlphabet: ["0", "1", "□"],
        states: ["trim", "q₀", "carry", "accept"],
        start: "trim",
        accepts: ["accept"],
        rejects: [],
        example: "1011",
        examples: [
          { input: "0", expected: "1" },
          { input: "1", expected: "10" },
          { input: "10", expected: "11" },
          { input: "1011", expected: "1100" },
          { input: "1111", expected: "10000" },
        ],
        transitions: {
          trim: {
            0: { write: "□", move: "R", next: "trim" },
            1: { write: "1", move: "R", next: "q₀" },
            "□": { write: "1", move: "S", next: "accept" },
          },
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
          "The machine first finds the blank after the input. It flips trailing 1s to 0s and increments the first 0; an all-1 input grows by one cell, while empty input is treated as zero and becomes 1.",
      },
      {
        id: "tm-unary-inc",
        name: "Unary increment",
        kind: "TM",
        description:
          "Adds one to a unary number represented by a string of 1s. It scans to the first blank and writes a final 1 there, treating empty input as zero.",
        alphabet: ["1"],
        tapeAlphabet: ["1", "□"],
        states: ["scan", "accept"],
        start: "scan",
        accepts: ["accept"],
        rejects: [],
        example: "111",
        examples: [
          { input: "1", expected: "11" },
          { input: "111", expected: "1111" },
          { input: "11111", expected: "111111" },
        ],
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
          "Accepts properly balanced strings of parentheses using a stack. The final state is reached by an epsilon transition when the input ends with only the bottom marker remaining.",
        alphabet: ["(", ")"],
        states: ["q", "accept"],
        start: "q",
        accepts: ["accept"],
        acceptBy: "finalState",
        example: "(()())",
        transitions: {
          q: {
            "(": { any: { push: "(", next: "q" } },
            ")": { "(": { pop: true, next: "q" } },
            ε: { "Z₀": { next: "accept" } },
          },
        },
        notes:
          "Each opening parenthesis is pushed, and each closing parenthesis must pop one. An epsilon move enters the accept state only when the stack has returned to its bottom marker after all input is consumed.",
      },
      {
        id: "pda-anbn",
        name: "Language aⁿbⁿ",
        kind: "PDA",
        description:
          "Accepts aⁿbⁿ, including ε, by pushing one marker per a and popping one per b. An epsilon transition reaches the final state with only the bottom marker remaining.",
        alphabet: ["a", "b"],
        states: ["push", "pop", "accept"],
        start: "push",
        accepts: ["accept"],
        acceptBy: "finalState",
        example: "aaabbb",
        transitions: {
          push: {
            a: { any: { push: "A", next: "push" } },
            b: { A: { pop: true, next: "pop" } },
            ε: { "Z₀": { next: "accept" } },
          },
          pop: {
            b: { A: { pop: true, next: "pop" } },
            ε: { "Z₀": { next: "accept" } },
          },
        },
        notes:
          "The stack counts the a symbols. The first b switches to matching mode; each b removes one marker. Only after the input is consumed can the bottom-marker epsilon transition accept.",
      },
      {
        id: "pda-even-palindrome",
        name: "Even palindromes",
        kind: "PDA",
        description:
          "Accepts even-length palindromes wwᴿ over {a,b}. The nondeterministic PDA guesses the midpoint with an epsilon transition, then matches and pops the first half in reverse.",
        alphabet: ["a", "b"],
        states: ["push", "match", "accept"],
        start: "push",
        accepts: ["accept"],
        acceptBy: "finalState",
        example: "abba",
        transitions: {
          push: {
            a: { any: { push: "a", next: "push" } },
            b: { any: { push: "b", next: "push" } },
            ε: { any: { next: "match" } },
          },
          match: {
            a: { a: { pop: true, next: "match" } },
            b: { b: { pop: true, next: "match" } },
            ε: { "Z₀": { next: "accept" } },
          },
        },
        notes:
          "The push state stores a guessed first half. An epsilon branch guesses the midpoint at every position; the match state consumes the reverse half while popping equal symbols. Acceptance requires the entire input and bottom marker.",
      },
      {
        id: "pda-equal-ab",
        name: "Equal number of a and b",
        kind: "PDA",
        description:
          "Accepts strings over {a,b} with equal counts in any order. The stack cancels each symbol against an unmatched symbol of the opposite kind.",
        alphabet: ["a", "b"],
        states: ["q"],
        start: "q",
        accepts: [],
        acceptBy: "emptyStack",
        example: "abba",
        transitions: {
          q: {
            a: {
              "Z₀": { push: "A", next: "q" },
              A: { push: "A", next: "q" },
              B: { pop: true, next: "q" },
            },
            b: {
              "Z₀": { push: "B", next: "q" },
              B: { push: "B", next: "q" },
              A: { pop: true, next: "q" },
            },
          },
        },
        notes:
          "An a cancels an unmatched B or pushes A; a b cancels an unmatched A or pushes B. Equal counts leave only Z₀, the required empty-stack acceptance condition.",
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
      throw new Error(
        `Turing machine start state "${machine.start}" does not exist.`,
      );
    }
    for (const state of accepts) {
      if (!states.has(state)) {
        throw new Error(
          `Turing machine accept state "${state}" does not exist.`,
        );
      }
    }
    for (const state of rejects) {
      if (!states.has(state)) {
        throw new Error(
          `Turing machine reject state "${state}" does not exist.`,
        );
      }
    }
    if (!tapeAlphabet.has(blank)) {
      throw new Error(
        `Turing machine blank symbol "${blank}" is not in tapeAlphabet.`,
      );
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
          throw new Error(
            `Transition for (${from}, ${symbol}) must be a rule object.`,
          );
        }
        if (!tapeAlphabet.has(rule.write)) {
          throw new Error(
            `Written symbol "${rule.write}" is not in tapeAlphabet.`,
          );
        }
        if (!["L", "R", "S"].includes(rule.move)) {
          throw new Error(
            `Invalid move "${rule.move}" for (${from}, ${symbol}); expected L, R, or S.`,
          );
        }
        if (!states.has(rule.next)) {
          throw new Error(
            `Next state "${rule.next}" for (${from}, ${symbol}) does not exist.`,
          );
        }
      }
    }
    for (const symbol of input) {
      if (!alphabet.has(symbol)) {
        throw new Error(
          `Input symbol "${symbol}" is not in the machine alphabet.`,
        );
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
      const nextHead =
        head + (rule.move === "L" ? -1 : rule.move === "R" ? 1 : 0);
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
          throw new Error(
            "Turing run maxSteps must be a non-negative integer.",
          );
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
    const configurationLimit = 5000;
    if (!machine || !Array.isArray(machine.states)) {
      throw new Error("PDA states must be an array.");
    }
    if (typeof input !== "string") {
      throw new Error("PDA input must be a string.");
    }

    const states = new Set(machine.states);
    const alphabet = new Set(machine.alphabet || []);
    const accepts = machine.accepts || [];
    const acceptBy = machine.acceptBy || "either";
    const transitions = machine.transitions || {};
    if (!states.has(machine.start)) {
      throw new Error(`PDA start state "${machine.start}" does not exist.`);
    }
    if (!["finalState", "emptyStack", "either"].includes(acceptBy)) {
      throw new Error(`Invalid PDA acceptBy mode "${acceptBy}".`);
    }
    for (const state of accepts) {
      if (!states.has(state)) {
        throw new Error(`PDA accept state "${state}" does not exist.`);
      }
    }
    for (const symbol of input) {
      if (!alphabet.has(symbol)) {
        throw new Error(`Input symbol "${symbol}" is not in the PDA alphabet.`);
      }
    }
    for (const [from, byInput] of Object.entries(transitions)) {
      if (!states.has(from)) {
        throw new Error(`PDA transition state "${from}" does not exist.`);
      }
      for (const [symbol, byTop] of Object.entries(byInput)) {
        if (symbol !== EPSILON && !alphabet.has(symbol)) {
          throw new Error(
            `PDA transition input "${symbol}" is not in the alphabet.`,
          );
        }
        for (const [top, configuredRules] of Object.entries(byTop)) {
          const rules = Array.isArray(configuredRules)
            ? configuredRules
            : [configuredRules];
          for (const rule of rules) {
            if (!rule || typeof rule !== "object") {
              throw new Error(
                `PDA transition for (${from}, ${symbol}, ${top}) must be a rule object.`,
              );
            }
            if (!states.has(rule.next)) {
              throw new Error(
                `PDA next state "${rule.next}" for (${from}, ${symbol}, ${top}) does not exist.`,
              );
            }
            if (
              rule.push !== undefined &&
              typeof rule.push !== "string" &&
              !Array.isArray(rule.push)
            ) {
              throw new Error(
                `PDA push for (${from}, ${symbol}, ${top}) must be a string or array.`,
              );
            }
            if (
              Array.isArray(rule.push) &&
              rule.push.some((value) => typeof value !== "string")
            ) {
              throw new Error(
                `PDA push array for (${from}, ${symbol}, ${top}) must contain strings.`,
              );
            }
          }
        }
      }
    }

    const initial = { state: machine.start, position: 0, stack: ["Z₀"] };
    let configurations = [initial];
    let lastConfiguration = initial;
    let acceptingConfiguration = null;
    let history = [];
    let status = "ready";
    let reason = null;
    let visited = new Set([configurationKey(initial)]);

    /** Creates a stable key for visited-configuration detection. */
    function configurationKey(configuration) {
      return JSON.stringify([
        configuration.state,
        configuration.position,
        configuration.stack,
      ]);
    }
    /** Returns whether a fully consumed configuration satisfies acceptBy. */
    function isAccepting(configuration) {
      if (configuration.position !== input.length) return false;
      const finalState = accepts.includes(configuration.state);
      const emptyStack =
        configuration.stack.length === 1 && configuration.stack[0] === "Z₀";
      return acceptBy === "finalState"
        ? finalState
        : acceptBy === "emptyStack"
          ? emptyStack
          : finalState || emptyStack;
    }
    /** Returns the accepting branch or the first available branch. */
    const selectedConfiguration = () =>
      acceptingConfiguration || configurations[0] || lastConfiguration;
    /** Returns a detached view of the current nondeterministic frontier. */
    const snap = () => {
      const selected = selectedConfiguration();
      return {
        position: selected.position,
        state: selected.state,
        stack: [...selected.stack],
        history: history.map((entry) => ({ ...entry })),
        status,
        reading: input[selected.position] ?? (input.length === 0 ? "ε" : "end"),
        branches: configurations.length,
        acceptBy,
        reason,
      };
    };
    /** Applies one breadth-first transition layer to every live branch. */
    function step() {
      if (!["ready", "running"].includes(status)) return snap();
      const alreadyAccepting = configurations.find(isAccepting);
      if (alreadyAccepting) {
        acceptingConfiguration = alreadyAccepting;
        status = "accepted";
        return snap();
      }

      const nextConfigurations = [];
      let limitReached = false;
      for (const configuration of configurations) {
        const byInput = transitions[configuration.state] || {};
        const inputSymbols = [];
        if (configuration.position < input.length) {
          inputSymbols.push(input[configuration.position]);
        }
        inputSymbols.push(EPSILON);

        for (const symbol of inputSymbols) {
          const byTop = byInput[symbol];
          if (!byTop) continue;
          const top = configuration.stack.at(-1);
          const matchingRules = [];
          if (Object.hasOwn(byTop, top)) {
            matchingRules.push(byTop[top]);
          }
          if (Object.hasOwn(byTop, "any")) {
            matchingRules.push(byTop.any);
          }

          for (const configuredRules of matchingRules) {
            const rules = Array.isArray(configuredRules)
              ? configuredRules
              : [configuredRules];
            for (const rule of rules) {
              const nextStack = [...configuration.stack];
              if (rule.pop) nextStack.pop();
              if (Array.isArray(rule.push)) nextStack.push(...rule.push);
              else if (typeof rule.push === "string") nextStack.push(rule.push);
              const nextConfiguration = {
                state: rule.next,
                position: configuration.position + (symbol === EPSILON ? 0 : 1),
                stack: nextStack,
              };
              const key = configurationKey(nextConfiguration);
              if (visited.has(key)) continue;
              if (visited.size >= configurationLimit) {
                limitReached = true;
                break;
              }
              visited.add(key);
              nextConfigurations.push(nextConfiguration);
              const action = rule.pop
                ? `pop ${top ?? "∅"}`
                : rule.push !== undefined
                  ? `push ${Array.isArray(rule.push) ? rule.push.join(" ") : rule.push}`
                  : "no stack change";
              history.push({
                index: history.length + 1,
                state: configuration.state,
                symbol,
                transition: `${symbol}, ${top ?? "∅"} → ${action}`,
                to: rule.next,
                stackTop: top,
                positionBefore: configuration.position,
                positionAfter: nextConfiguration.position,
              });
              if (isAccepting(nextConfiguration)) {
                acceptingConfiguration = nextConfiguration;
              }
            }
            if (limitReached) break;
          }
          if (limitReached) break;
        }
        if (limitReached) break;
      }

      if (nextConfigurations.length) {
        configurations = nextConfigurations;
        lastConfiguration = nextConfigurations[0];
      } else if (configurations.length) {
        lastConfiguration = configurations[0];
        configurations = [];
      }
      if (acceptingConfiguration) {
        status = "accepted";
      } else if (limitReached) {
        status = "halted";
        reason = "configuration limit exceeded";
      } else if (!configurations.length) {
        status = "rejected";
      } else {
        status = "running";
      }
      return snap();
    }
    return {
      step,
      snapshot: snap,
      /** Runs until a branch accepts, all branches reject, or the cap is reached. */
      run() {
        while (["ready", "running"].includes(status)) step();
        return snap();
      },
      /** Restores the initial configuration and clears all explored branches. */
      reset() {
        configurations = [initial];
        lastConfiguration = initial;
        acceptingConfiguration = null;
        history = [];
        status = "ready";
        reason = null;
        visited = new Set([configurationKey(initial)]);
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
