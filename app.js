/** Initializes the browser UI after its engine script has loaded. */
(function (root) {
  const EPSILON = "ε";

  /** Builds merged, transition-derived diagram nodes and edges. */
  function buildDiagramModel(machine) {
    const edgeMap = new Map();
    const addTransition = (from, to, transition) => {
      const key = `${from}\u0000${to}`;
      if (!edgeMap.has(key)) {
        edgeMap.set(key, { from, to, transitions: [] });
      }
      edgeMap.get(key).transitions.push(transition);
    };

    for (const [from, bySymbol] of Object.entries(machine.transitions || {})) {
      for (const [symbol, configured] of Object.entries(bySymbol)) {
        if (machine.kind === "TM") {
          addTransition(from, configured.next, {
            symbol,
            label: `${symbol}/${configured.write},${configured.move}`,
            write: configured.write,
            move: configured.move,
          });
          continue;
        }
        if (machine.kind === "PDA") {
          for (const [stackTop, configuredRules] of Object.entries(
            configured,
          )) {
            const rules = Array.isArray(configuredRules)
              ? configuredRules
              : [configuredRules];
            for (const rule of rules) {
              const action = rule.pop
                ? "pop"
                : rule.push !== undefined
                  ? `push ${Array.isArray(rule.push) ? rule.push.join(" ") : rule.push}`
                  : "keep";
              addTransition(from, rule.next, {
                symbol,
                stackTop,
                label: `${symbol},${stackTop}→${action}`,
              });
            }
          }
          continue;
        }
        const destinations = Array.isArray(configured)
          ? configured
          : [configured];
        for (const to of destinations) {
          addTransition(from, to, { symbol, label: symbol });
        }
      }
    }

    const edges = [...edgeMap.values()];
    for (const edge of edges) {
      edge.transitions.sort((left, right) =>
        left.label.localeCompare(right.label),
      );
      edge.label = [
        ...new Set(edge.transitions.map((item) => item.label)),
      ].join("\n");
    }
    return {
      nodes: machine.states.map((state) => ({
        state,
        start: state === machine.start,
        accept: (machine.accepts || []).includes(state),
        reject: (machine.rejects || []).includes(state),
      })),
      edges,
    };
  }

  /** Builds a transition table model for finite, Turing, or pushdown machines. */
  function buildTransitionTable(machine) {
    if (machine.kind === "PDA") {
      const rows = [];
      for (const [state, byInput] of Object.entries(
        machine.transitions || {},
      )) {
        for (const [input, byTop] of Object.entries(byInput)) {
          for (const [stackTop, configuredRules] of Object.entries(byTop)) {
            const rules = Array.isArray(configuredRules)
              ? configuredRules
              : [configuredRules];
            rules.forEach((rule, ruleIndex) => {
              const action = rule.pop
                ? "pop"
                : rule.push !== undefined
                  ? `push ${Array.isArray(rule.push) ? rule.push.join(" ") : rule.push}`
                  : "keep";
              rows.push({
                state,
                input,
                stackTop,
                ruleIndex,
                label: `${input},${stackTop}→${action}`,
                next: rule.next,
              });
            });
          }
        }
      }
      return {
        headers: ["State", "Input", "Stack top", "Rule", "Next"],
        rows,
        ruleCount: rows.length,
      };
    }

    if (machine.kind === "TM") {
      const symbols = [...new Set(machine.tapeAlphabet || [])];
      const rows = machine.states.map((state) => {
        const cells = {};
        for (const symbol of symbols) {
          const rule = machine.transitions[state]?.[symbol];
          cells[symbol] = rule
            ? {
                label: `${rule.write},${rule.move} → ${rule.next}`,
                rules: [rule],
              }
            : { label: "—", rules: [] };
        }
        return { state, cells };
      });
      const ruleCount = rows.reduce(
        (count, row) =>
          count +
          Object.values(row.cells).reduce(
            (sum, cell) => sum + cell.rules.length,
            0,
          ),
        0,
      );
      return { headers: ["State", ...symbols], symbols, rows, ruleCount };
    }

    const symbols = [...new Set(machine.alphabet || [])];
    if (
      Object.values(machine.transitions || {}).some((bySymbol) =>
        Object.hasOwn(bySymbol, EPSILON),
      )
    ) {
      symbols.push(EPSILON);
    }
    const rows = machine.states.map((state) => {
      const cells = {};
      for (const symbol of symbols) {
        const configured = machine.transitions[state]?.[symbol];
        const destinations =
          configured === undefined
            ? []
            : Array.isArray(configured)
              ? configured
              : [configured];
        cells[symbol] = {
          label: destinations.length ? destinations.join(", ") : "—",
          rules: destinations.map((to) => ({ symbol, to })),
        };
      }
      return { state, cells };
    });
    const ruleCount = rows.reduce(
      (count, row) =>
        count +
        Object.values(row.cells).reduce(
          (sum, cell) => sum + cell.rules.length,
          0,
        ),
      0,
    );
    return { headers: ["State", ...symbols], symbols, rows, ruleCount };
  }

  /** Reports whether all input symbols belong to a machine's input alphabet. */
  function validateInput(machine, input) {
    const alphabet = new Set(machine.alphabet || []);
    const invalidSymbols = [
      ...new Set([...input].filter((symbol) => !alphabet.has(symbol))),
    ];
    return { ok: invalidSymbols.length === 0, invalidSymbols };
  }

  /** Maps the five-point speed control to an execution delay in milliseconds. */
  function speedToDelay(value) {
    return 1100 - (Number(value) - 1) * 190;
  }

  const publicApi = {
    buildDiagramModel,
    buildTransitionTable,
    validateInput,
    speedToDelay,
  };
  root.AutomataUI = publicApi;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = publicApi;
  }
  if (!root.document || !root.AutomataEngines) return;

  const E = root.AutomataEngines,
    $ = (s) => root.document.querySelector(s),
    $$ = (s) => [...root.document.querySelectorAll(s)];
  const state = {
    mode: "dfa",
    machine: null,
    runner: null,
    timer: null,
    snapshot: null,
    running: false,
    exampleIndexes: {},
  };
  const speedNames = ["Slow", "Leisurely", "Normal", "Quick", "Fast"];
  /** Escapes machine-provided text before inserting it into markup. */
  const escapeHtml = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  /** Returns the definitions for the selected machine mode. */
  function list() {
    return E.definitions[state.mode];
  }
  /** Selects a machine and resets the simulator view. */
  function loadMachine(id) {
    stop();
    state.machine = list().find((m) => m.id === id) || list()[0];
    const select = $("#machine-select");
    select.innerHTML = list()
      .map((m) => `<option value="${m.id}">${m.name} · ${m.kind}</option>`)
      .join("");
    select.value = state.machine.id;
    $("#machine-description").textContent =
      state.mode === "pda"
        ? `${state.machine.description} Acceptance: ${state.machine.acceptBy || "either"}.`
        : state.machine.description;
    $("#input-alphabet").textContent = state.machine.alphabet.join("  ");
    const examples = examplesFor(state.machine);
    state.exampleIndexes[state.machine.id] = 0;
    $("#input-string").value = examples[0].input;
    $("#input-string").placeholder =
      state.mode === "tm"
        ? "e.g. 1011"
        : state.mode === "pda"
          ? "e.g. aaabbb"
          : "e.g. 1101";
    $("#visual-title").textContent =
      state.mode === "tm" ? "TAPE CONTENTS" : "INPUT TAPE";
    $("#stack-section").classList.toggle("hidden", state.mode !== "pda");
    $("#input-pointer").classList.toggle(
      "hidden",
      state.mode === "tm" || state.mode === "pda",
    );
    $("#pointer-label").classList.toggle(
      "hidden",
      state.mode === "tm" || state.mode === "pda",
    );
    $("#diagram-caption").textContent = state.machine.notes;
    state.runner = null;
    state.snapshot = null;
    renderDiagram();
    reset();
    renderTransitionTable();
    renderLibrary();
  }
  /** Validates the current input against the selected alphabet. */
  function validInput() {
    const input = $("#input-string").value;
    const validation = validateInput(state.machine, input);
    const feedback = $("#input-feedback");
    if (!validation.ok) {
      feedback.textContent = `Use symbols from this alphabet: ${state.machine.alphabet.join(", ")}. Invalid: ${validation.invalidSymbols.join(", ")}`;
      feedback.className = "input-feedback error";
      return false;
    }
    feedback.textContent = input.length
      ? "Input looks good. Ready to run."
      : "Empty input (ε)";
    feedback.className = "input-feedback good";
    return true;
  }
  /** Returns the one-click samples, falling back to the machine example. */
  function examplesFor(machine) {
    return machine.examples?.length
      ? machine.examples
      : [{ input: machine.example || "", expected: "accept" }];
  }
  /** Keeps execution controls aligned with input and runner state. */
  function updateControls() {
    const inputIsValid =
      state.machine &&
      validateInput(state.machine, $("#input-string").value).ok;
    const terminal =
      state.snapshot && !["ready", "running"].includes(state.snapshot.status);
    $("#run-button").disabled = !inputIsValid || state.running;
    $("#step-button").disabled = !inputIsValid || state.running || terminal;
    $("#pause-button").disabled = !state.running;
  }
  /** Creates the runner matching the selected machine type. */
  function createRunner() {
    const input = $("#input-string").value;
    state.runner =
      state.mode === "tm"
        ? E.createTuringRunner(state.machine, input)
        : state.mode === "pda"
          ? E.createPdaRunner(state.machine, input)
          : E.createFiniteRunner(state.machine, input);
  }
  /** Stops playback and renders a fresh initial snapshot. */
  function reset() {
    stop();
    if (!state.machine || !validInput()) return;
    createRunner();
    state.snapshot = state.runner.snapshot();
    render(state.snapshot);
    updateControls();
  }
  /** Starts timer-driven execution of the current runner. */
  function startRun() {
    if (!validInput()) return;
    if (
      !state.runner ||
      !["ready", "running"].includes(state.runner.snapshot().status)
    )
      createRunner();
    state.running = true;
    updateControls();
    tick();
    if (
      state.runner &&
      ["ready", "running"].includes(state.runner.snapshot().status)
    )
      state.timer = setInterval(tick, speedToDelay($("#speed-range").value));
    else stop();
  }
  /** Advances one step and renders the resulting snapshot. */
  function tick() {
    if (!state.runner) return;
    if (state.mode === "tm" && state.snapshot?.steps >= 10000) {
      state.snapshot = state.runner.run(0);
      render(state.snapshot);
      stop();
      return;
    }
    const s = state.runner.step();
    state.snapshot = s;
    render(s);
    if (!["ready", "running"].includes(s.status)) stop();
    updateControls();
  }
  /** Stops timer-driven execution and restores the controls. */
  function stop() {
    if (state.timer) {
      clearInterval(state.timer);
      state.timer = null;
    }
    state.running = false;
    if (state.machine) updateControls();
  }
  /** Advances exactly one step from the Step control. */
  function manualStep() {
    if (!validInput()) return;
    if (
      state.runner &&
      !["ready", "running"].includes(state.runner.snapshot().status)
    )
      return;
    if (!state.runner) createRunner();
    tick();
  }
  /** Renders the current snapshot across the simulator panels. */
  function render(s) {
    $("#current-state").textContent =
      state.mode === "dfa" ? s.active.join(" ∪ ") || "∅" : s.state;
    $("#step-count").textContent = s.history.length;
    const input = $("#input-string").value;
    $("#current-symbol").textContent =
      state.mode === "tm"
        ? s.reading
        : input.length === 0
          ? "ε"
          : s.position >= input.length
            ? "end"
            : input[s.position];
    const status = $("#status-pill");
    const names = {
      ready: "Ready",
      running: "Running",
      accepted: "Accepted",
      rejected: "Rejected",
      halted: "Halted",
    };
    status.className = `status-pill ${s.status}`;
    status.querySelector("span").textContent = names[s.status] || s.status;
    const tape = $("#tape-view");
    tape.className = `tape-view ${state.mode === "tm" ? "tm-tape" : ""}`;
    if (state.mode === "tm") {
      const vals = s.displayTape?.length ? s.displayTape : ["□"];
      tape.innerHTML = vals
        .map(
          (v, i) =>
            `<div class="tape-cell ${s.headIndex === i ? "head-cell" : ""} ${v === s.blank ? "blank-cell" : ""}">${escapeHtml(v)}</div>`,
        )
        .join("");
      $("#pointer-label b").textContent = s.headIndex;
    } else {
      tape.innerHTML = input.length
        ? [...input]
            .map(
              (v, i) =>
                `<div class="tape-cell ${i === s.position ? "current-cell" : ""} ${i < s.position ? "consumed-cell" : ""}">${escapeHtml(v)}</div>`,
            )
            .join("")
        : '<div class="epsilon-cell">ε <small>empty string</small></div>';
      const pct = input.length
        ? Math.min(96, Math.max(4, ((s.position + 0.5) / input.length) * 100))
        : 50;
      $("#input-pointer").style.left = `${pct}%`;
      $(`#pointer-label b`).textContent = input.length
        ? `${Math.min(s.position + 1, input.length)} / ${input.length}`
        : "ε";
      if (input.length && s.position >= input.length) {
        $(`#pointer-label b`).textContent = "end";
      }
    }
    if (state.mode === "pda") {
      const vals = [...s.stack].reverse();
      $("#stack-view").innerHTML = vals.length
        ? vals
            .map(
              (v, i) =>
                `<div class="stack-cell ${i === 0 ? "stack-top" : ""}">${escapeHtml(v)}</div>`,
            )
            .join("")
        : '<div class="stack-empty">empty stack</div>';
      $("#stack-label").textContent =
        `${s.stack.length} ${s.stack.length === 1 ? "item" : "items"}`;
      const branchCount = $("#branch-count");
      branchCount.textContent = `${s.branches} parallel branches`;
      branchCount.classList.toggle("hidden", s.branches <= 1);
    }
    $("#history-body").innerHTML = s.history.length
      ? s.history
          .map(
            (h, i) =>
              `<tr class="${i === s.history.length - 1 ? "new-row" : ""}"><td>${h.index}</td><td><span class="state-tag">${escapeHtml(h.state)}</span></td><td><span class="symbol-tag">${escapeHtml(h.symbol)}</span></td><td>${escapeHtml(h.transition)}</td><td>${escapeHtml(h.to)}</td></tr>`,
          )
          .join("")
      : '<tr class="empty-row"><td colspan="5"><span class="empty-icon">⌁</span><br/>Your transition history will appear here.</td></tr>';
    $("#log-count").textContent =
      `${s.history.length} ${s.history.length === 1 ? "transition" : "transitions"}`;
    const last = s.history.at(-1);
    $("#transition-text").textContent = last
      ? `${last.state} reads “${last.symbol}” → ${last.transition}; moves to ${last.to}.`
      : state.mode === "dfa"
        ? `Starting in ${s.active.join(", ") || "∅"}. ${s.reading === "ε" ? "The input is empty." : "Next symbol: " + s.reading + "."}`
        : `Starting in ${s.state}. ${s.reading === "ε" ? "The input is empty." : "Next symbol: " + s.reading + "."}`;
    $("#transition-banner").classList.toggle(
      "hidden",
      ["accepted", "rejected", "halted"].includes(s.status),
    );
    const result = $("#result-banner");
    const transducer =
      state.mode === "tm" &&
      examplesFor(state.machine).some(
        (example) => !["accept", "reject"].includes(example.expected),
      );
    const outcomes = {
      accepted: {
        className: "success",
        icon: "✓",
        title: "Accepted",
        description: transducer
          ? `Output tape: ${s.output || "ε"}`
          : "The machine reached an accepting configuration.",
      },
      rejected: {
        className: "failure",
        icon: "×",
        title: "Rejected",
        description: s.reason || "This input does not belong to the language.",
      },
      halted: {
        className: "warning",
        icon: "Ⅱ",
        title: "Halted",
        description: s.reason || "step limit exceeded",
      },
    };
    if (outcomes[s.status]) {
      const { className, icon, title, description } = outcomes[s.status];
      result.className = `result-banner ${className}`;
      result.innerHTML = `<span class="result-icon">${icon}</span><span><strong>${title}</strong><small>${escapeHtml(description)}</small></span>`;
    } else result.className = "result-banner hidden";
    renderDiagram(s);
    renderTransitionTable(s);
    updateControls();
  }
  /** Draws the currently selected machine's state diagram. */
  function renderDiagram(snapshot) {
    const svg = $("#diagram-svg");
    const machine = state.machine;
    if (!machine) return;
    const model = buildDiagramModel(machine);
    const count = model.nodes.length;
    const radius = count < 3 ? 112 : Math.max(112, count * 24);
    const width = Math.max(380, radius * 2 + 170);
    const height = Math.max(250, radius * 2 + 120);
    const center = { x: width / 2, y: height / 2 };
    const coordinates = new Map(
      model.nodes.map((node, index) => {
        const angle = -Math.PI / 2 + (index * Math.PI * 2) / count;
        return [
          node.state,
          count === 1
            ? center
            : {
                x: center.x + radius * Math.cos(angle),
                y: center.y + radius * Math.sin(angle),
              },
        ];
      }),
    );
    const activeStates = new Set(
      snapshot?.activeStates ||
        snapshot?.active ||
        (snapshot?.state ? [snapshot.state] : []),
    );
    const last = snapshot?.history?.at(-1);
    const bidirectional = new Set(
      model.edges
        .filter((edge) =>
          model.edges.some(
            (other) => other.from === edge.to && other.to === edge.from,
          ),
        )
        .map((edge) => `${edge.from}\u0000${edge.to}`),
    );
    let markup =
      '<defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" fill="#8b95a7"/></marker></defs>';
    for (const edge of model.edges) {
      const from = coordinates.get(edge.from);
      const to = coordinates.get(edge.to);
      const edgeActive = edge.transitions.some((transition) => {
        if (!last) return false;
        if (last.edges) {
          return last.edges.some(
            (used) =>
              used.from === edge.from &&
              used.to === edge.to &&
              used.symbol === transition.symbol,
          );
        }
        if (machine.kind !== "TM" && machine.kind !== "PDA") {
          const fromStates = new Set(last.state.split(", "));
          const toStates = new Set(last.to.split(", "));
          return (
            fromStates.has(edge.from) &&
            toStates.has(edge.to) &&
            last.symbol === transition.symbol
          );
        }
        return (
          last.state === edge.from &&
          last.to === edge.to &&
          last.symbol === transition.symbol &&
          (last.stackTop === undefined ||
            last.stackTop === transition.stackTop) &&
          (last.write === undefined || last.write === transition.write) &&
          (last.move === undefined || last.move === transition.move)
        );
      });
      const edgeClass = edgeActive ? "edge active-edge" : "edge";
      if (edge.from === edge.to) {
        markup += `<path class="loop-edge ${edgeActive ? "active-edge" : ""}" d="M${from.x - 18} ${from.y - 24} C${from.x - 66} ${from.y - 94} ${from.x + 66} ${from.y - 94} ${from.x + 18} ${from.y - 24}"/>`;
        markup += `<text class="edge-label ${edgeActive ? "active-edge-label" : ""}" x="${from.x}" y="${from.y - 73}">${escapeHtml(edge.label)}</text>`;
        continue;
      }
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const distance = Math.hypot(dx, dy);
      const unitX = dx / distance;
      const unitY = dy / distance;
      const start = { x: from.x + unitX * 29, y: from.y + unitY * 29 };
      const end = { x: to.x - unitX * 35, y: to.y - unitY * 35 };
      const isCurved = bidirectional.has(`${edge.from}\u0000${edge.to}`);
      const bend = isCurved ? 32 : 0;
      const control = {
        x: (start.x + end.x) / 2 - unitY * bend,
        y: (start.y + end.y) / 2 + unitX * bend,
      };
      const path = isCurved
        ? `M${start.x} ${start.y} Q${control.x} ${control.y} ${end.x} ${end.y}`
        : `M${start.x} ${start.y} L${end.x} ${end.y}`;
      const labelX = isCurved
        ? (start.x + 2 * control.x + end.x) / 4
        : (start.x + end.x) / 2;
      const labelY = isCurved
        ? (start.y + 2 * control.y + end.y) / 4 - 7
        : (start.y + end.y) / 2 - 9;
      markup += `<path class="${edgeClass}" d="${path}"/>`;
      markup += `<text class="edge-label ${edgeActive ? "active-edge-label" : ""}" x="${labelX}" y="${labelY}">${escapeHtml(edge.label)}</text>`;
    }
    for (const node of model.nodes) {
      const point = coordinates.get(node.state);
      const active = activeStates.has(node.state);
      const classes = [
        "state-node",
        node.accept ? "accept-node" : "",
        node.reject ? "reject-node" : "",
        active ? "active-node" : "",
      ]
        .filter(Boolean)
        .join(" ");
      markup += `<g class="${classes}"><circle cx="${point.x}" cy="${point.y}" r="27"/><text x="${point.x}" y="${point.y + 4}">${escapeHtml(node.state)}</text>${node.accept ? `<circle class="inner-circle" cx="${point.x}" cy="${point.y}" r="21"/>` : ""}</g>`;
      if (node.start) {
        markup += `<path class="start-arrow" d="M${point.x - 58} ${point.y} L${point.x - 31} ${point.y}"/>`;
      }
    }
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.innerHTML = markup;
  }
  /** Renders all transition rules and highlights the last-used row or cell. */
  function renderTransitionTable(snapshot) {
    const machine = state.machine;
    if (!machine) return;
    const model = buildTransitionTable(machine);
    const head = $("#transition-table-head");
    const body = $("#transition-table-body");
    const last = snapshot?.history?.at(-1);
    $("#transition-count").textContent = `${model.ruleCount} rules`;
    head.innerHTML = `<tr>${model.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr>`;

    if (machine.kind === "PDA") {
      body.innerHTML = model.rows
        .map((row) => {
          const active =
            last &&
            last.state === row.state &&
            last.symbol === row.input &&
            last.stackTop === row.stackTop &&
            last.to === row.next;
          return `<tr class="${active ? "transition-active" : ""}"><td>${escapeHtml(row.state)}</td><td>${escapeHtml(row.input)}</td><td>${escapeHtml(row.stackTop)}</td><td>${escapeHtml(row.label)}</td><td>${escapeHtml(row.next)}</td></tr>`;
        })
        .join("");
      return;
    }

    const fromStates = new Set(last?.state?.split(", ") || []);
    const toStates = new Set(last?.to?.split(", ") || []);
    body.innerHTML = model.rows
      .map((row) => {
        let rowActive = false;
        const cells = model.symbols.map((symbol) => {
          const cell = row.cells[symbol];
          const active = Boolean(
            last &&
            fromStates.has(row.state) &&
            cell.rules.some((rule) => {
              if (rule.symbol !== last.symbol) return false;
              if (machine.kind === "TM") {
                return (
                  rule.next === last.to &&
                  rule.write === last.write &&
                  rule.move === last.move
                );
              }
                if (last.edges) {
                  return last.edges.some(
                    (edge) =>
                      edge.from === row.state &&
                      edge.to === rule.to &&
                      edge.symbol === symbol,
                  );
                }
              return toStates.has(rule.to);
            }),
          );
          rowActive ||= active;
          return `<td class="${active ? "transition-active" : ""}">${escapeHtml(cell.label)}</td>`;
        });
        return `<tr class="${rowActive ? "transition-active" : ""}"><td>${escapeHtml(row.state)}</td>${cells.join("")}</tr>`;
      })
      .join("");
  }
  /** Renders machine cards for the active mode. */
  function renderLibrary() {
    const grid = $("#library-grid");
    grid.innerHTML = E.definitions[state.mode]
      .map((m) => {
        const example = examplesFor(m)[0];
        const expected =
          example.expected && !["accept", "reject"].includes(example.expected)
            ? ` → ${example.expected}`
            : ` → ${example.expected || "accept"}`;
        const acceptMode =
          m.kind === "PDA"
            ? `<span class="library-mode">${escapeHtml(m.acceptBy || "either")}</span>`
            : "";
        return `<button class="card library-card" data-machine="${m.id}"><span class="library-kind">${m.kind}</span>${acceptMode}<h2>${escapeHtml(m.name)}</h2><p>${escapeHtml(m.description)}</p><span class="library-example">EXAMPLE <b>${escapeHtml(example.input || "ε")}${escapeHtml(expected)}</b></span><span class="library-arrow">↗</span></button>`;
      })
      .join("");
    grid.querySelectorAll("[data-machine]").forEach((b) =>
      b.addEventListener("click", () => {
        $('.nav-item[data-view="simulator"]').click();
        loadMachine(b.dataset.machine);
      }),
    );
  }
  /** Switches machine mode and loads its first definition. */
  function setMode(mode) {
    state.mode = mode;
    $$(".mode-tab").forEach((b) =>
      b.classList.toggle("selected", b.dataset.mode === mode),
    );
    loadMachine(list()[0].id);
  }
  $$(".mode-tab").forEach((b) =>
    b.addEventListener("click", () => setMode(b.dataset.mode)),
  );
  $("#machine-select").addEventListener("change", (e) =>
    loadMachine(e.target.value),
  );
  $("#input-string").addEventListener("input", () => {
    const valid = validInput();
    if (valid) {
      reset();
    } else {
      stop();
      updateControls();
    }
  });
  $("#run-button").addEventListener("click", startRun);
  $("#step-button").addEventListener("click", manualStep);
  $("#pause-button").addEventListener("click", stop);
  $("#reset-button").addEventListener("click", reset);
  $("#example-button").addEventListener("click", () => {
    const examples = examplesFor(state.machine);
    const nextIndex =
      ((state.exampleIndexes[state.machine.id] || 0) + 1) % examples.length;
    state.exampleIndexes[state.machine.id] = nextIndex;
    $("#input-string").value = examples[nextIndex].input;
    reset();
  });
  $("#speed-range").addEventListener("input", (e) => {
    $("#speed-value").textContent = speedNames[Number(e.target.value) - 1];
    if (state.running && state.timer) {
      clearInterval(state.timer);
      state.timer = setInterval(tick, speedToDelay(e.target.value));
    }
  });
  $("#clear-log").addEventListener("click", () => reset());
  $("#fit-diagram").addEventListener("click", () =>
    $("#diagram-canvas").classList.toggle("expanded"),
  );
  $("#machine-info").addEventListener("click", () => {
    $('.nav-item[data-view="guide"]').click();
  });
  $$(".nav-item").forEach((b) =>
    b.addEventListener("click", () => {
      const view = b.dataset.view;
      $$(".nav-item").forEach((x) => x.classList.toggle("active", x === b));
      ["simulator", "machines", "guide"].forEach((v) =>
        $("#view-" + v).classList.toggle("hidden", v !== view),
      );
      $("#crumb-current").textContent =
        view === "simulator"
          ? "Simulator"
          : view === "machines"
            ? "Machine library"
            : "Quick guide";
      if (view === "machines") renderLibrary();
    }),
  );
  root.document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      startRun();
    }
    if (e.key === "Escape") stop();
  });
  loadMachine(list()[0].id);
})(typeof window !== "undefined" ? window : globalThis);
