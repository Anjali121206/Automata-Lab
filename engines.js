/* Lightweight, framework-free automata engines. Machine records are data; the
   runners below own the execution rules and return one observable step. */
(function (root) {
  const EPSILON = 'ε';
  const definitions = {
    dfa: [
      { id:'ends-01', name:'Ends with 01', kind:'DFA', description:'Accepts binary strings whose final two symbols are 01.', alphabet:['0','1'], states:['q₀','q₁','q₂'], start:'q₀', accepts:['q₂'], example:'1101', transitions:{'q₀':{'0':'q₁','1':'q₀'},'q₁':{'0':'q₁','1':'q₂'},'q₂':{'0':'q₁','1':'q₀'}}, notes:'A compact DFA remembers the most recent suffix that could begin the pattern 01.' },
      { id:'even-ones', name:'Even number of 1s', kind:'DFA', description:'Accepts binary strings containing an even number of 1s.', alphabet:['0','1'], states:['Even','Odd'], start:'Even', accepts:['Even'], example:'1010', transitions:{Even:{'0':'Even','1':'Odd'},Odd:{'0':'Odd','1':'Even'}}, notes:'Reading a 1 flips parity; reading a 0 leaves it unchanged.' },
      { id:'contains-aba', name:'Contains 010', kind:'NFA', description:'An NFA that accepts any binary string containing the substring 010.', alphabet:['0','1'], states:['q₀','q₁','q₂','q₃'], start:'q₀', accepts:['q₃'], example:'11010', transitions:{'q₀':{'0':['q₀','q₁'],'1':['q₀']},'q₁':{'1':['q₂']},'q₂':{'0':['q₃']},'q₃':{'0':['q₃'],'1':['q₃']}}, notes:'At every prefix, the NFA can guess that a 0 starts the pattern. A set of active states represents all parallel paths.' },
      { id:'epsilon-choice', name:'NFA with ε-moves', kind:'NFA', description:'Accepts strings ending in 0 or ending in 1, using an ε-branch from the start.', alphabet:['0','1'], states:['s','a','b','F₀','F₁'], start:'s', accepts:['F₀','F₁'], example:'101', transitions:{s:{'ε':['a','b']},a:{'0':['a','F₀'],'1':['a']},b:{'0':['b'],'1':['b','F₁']}}, notes:'An ε-transition changes state without consuming an input symbol. The engine computes ε-closure before and after each symbol.' }
    ],
    tm: [
      { id:'tm-binary-inc',name:'Binary increment',kind:'TM',description:'Adds one to a binary number by scanning to the end, then propagating carry left.',alphabet:['0','1'],tapeAlphabet:['0','1','□'],states:['q₀','carry','accept'],start:'q₀',accepts:['accept'],example:'1011',transitions:{'q₀':{'0':{write:'0',move:'R',next:'q₀'},'1':{write:'1',move:'R',next:'q₀'},'□':{write:'□',move:'L',next:'carry'}},carry:{'1':{write:'0',move:'L',next:'carry'},'0':{write:'1',move:'S',next:'accept'},'□':{write:'1',move:'S',next:'accept'}}},notes:'The machine first finds the blank after the input. It flips trailing 1s to 0s and increments the first 0; an all-1 input grows by one cell.'},
      { id:'tm-unary-inc',name:'Unary increment',kind:'TM',description:'Appends one 1 to a unary number (a string of 1s).',alphabet:['1'],tapeAlphabet:['1','□'],states:['scan','accept'],start:'scan',accepts:['accept'],example:'111',transitions:{scan:{'1':{write:'1',move:'R',next:'scan'},'□':{write:'1',move:'S',next:'accept'}}},notes:'The head scans right over every 1, then writes a final 1 in the first blank cell.'}
    ],
    pda: [
      { id:'pda-parens',name:'Balanced parentheses',kind:'PDA',description:'Accepts properly balanced strings of parentheses using a stack.',alphabet:['(',')'],states:['q','accept'],start:'q',accepts:['accept'],example:'(()())',transitions:{'q':{'(': {any:{push:'(',next:'q'}},')': {'(':{pop:true,next:'q'}}}},notes:'Each opening parenthesis is pushed. A closing parenthesis must pop one. The input is accepted only when it ends with an empty stack.'},
      { id:'pda-anbn',name:'Language aⁿbⁿ',kind:'PDA',description:'Accepts aⁿbⁿ (including ε): push one marker per a, then pop one per b.',alphabet:['a','b'],states:['push','pop','accept'],start:'push',accepts:['accept'],example:'aaabbb',transitions:{push:{a:{any:{push:'A',next:'push'}},b:{A:{pop:true,next:'pop'}}},pop:{b:{A:{pop:true,next:'pop'}}}},notes:'The stack counts the a symbols. The first b switches to matching mode; each b removes one marker.'}
    ]
  };
  function closure(machine, states) {
    const found = new Set(states), todo = [...found];
    while (todo.length) { const s=todo.pop(), destinations=machine.transitions[s]?.[EPSILON] || []; for (const d of (Array.isArray(destinations)?destinations:[destinations])) if (!found.has(d)) {found.add(d);todo.push(d);} }
    return found;
  }
  function createFiniteRunner(machine, input) {
    let position=0, active=closure(machine,[machine.start]), history=[], status='ready';
    const snapshot=()=>({position,active:[...active],history:[...history],status,reading:input[position]??'∅'});
    function step(){ if(status!=='ready'&&status!=='running')return snapshot(); if(position>=input.length){status=[...active].some(s=>machine.accepts.includes(s))?'accepted':'rejected';return snapshot();}
      const symbol=input[position], before=[...active], next=new Set(); for(const state of active){const dest=machine.transitions[state]?.[symbol];if(dest)for(const d of(Array.isArray(dest)?dest:[dest]))next.add(d);}
      active=closure(machine,next); history.push({index:history.length+1,state:before.join(', ')||'∅',symbol,transition:`${before.join(', ')||'∅'} —${symbol}→ ${[...active].join(', ')||'∅'}`,to:[...active].join(', ')||'∅'});position++;status='running';if(!active.size)status='rejected';if(position===input.length&&status!=='rejected')status=[...active].some(s=>machine.accepts.includes(s))?'accepted':'rejected';return snapshot();}
    return {step,snapshot,run(){while(status==='ready'||status==='running')step();return snapshot();},reset(){position=0;active=closure(machine,[machine.start]);history=[];status='ready';return snapshot();}};
  }
  function createTuringRunner(machine,input){let tape=[...input],head=0,state=machine.start,history=[],status='ready',steps=0;const blank='□';const read=()=>tape[head]??blank;
    const snap=()=>({tape:[...tape],displayTape:tape.length?[...tape]:[blank],head,state,history:[...history],status,steps,reading:read()});
    function step(){if(!['ready','running'].includes(status))return snap();if(machine.accepts.includes(state)){status='accepted';return snap();}const symbol=read(), rule=machine.transitions[state]?.[symbol];if(!rule){status='halted';return snap();}const before=state;tape[head]=rule.write;head+=rule.move==='L'?-1:rule.move==='R'?1:0;if(head<0){tape.unshift(blank);head=0;}while(head>=tape.length)tape.push(blank);state=rule.next;steps++;status=machine.accepts.includes(state)?'accepted':'running';history.push({index:steps,state:before,symbol,transition:`${symbol} → ${rule.write}, ${rule.move}`,to:state});return snap();}
    return{step,snapshot:snap,run(){while(status==='ready'||status==='running')step();return snap();},reset(){tape=[...input];if(!tape.length)tape=[blank];head=0;state=machine.start;history=[];status='ready';steps=0;return snap();}};
  }
  function createPdaRunner(machine,input){let pos=0,state=machine.start,stack=['Z₀'],history=[],status='ready';const snap=()=>({position:pos,state,stack:[...stack],history:[...history],status,reading:input[pos]??'ε'});
    function step(){if(!['ready','running'].includes(status))return snap();if(pos>=input.length){status=machine.accepts.includes(state)||stack.length===1&&stack[0]==='Z₀'?'accepted':'rejected';if(machine.accepts.includes(state))status='accepted';return snap();}const symbol=input[pos],top=stack[stack.length-1],before=state;let rule=machine.transitions[state]?.[symbol]?.[top]||machine.transitions[state]?.[symbol]?.any;
      if(!rule){status='rejected';return snap();}if(rule.pop)stack.pop();if(rule.push)stack.push(rule.push);state=rule.next;pos++;history.push({index:history.length+1,state:before,symbol,transition:`${symbol}, ${top} → ${rule.pop?'pop':rule.push?'push '+rule.push:'no stack change'}`,to:state});status=pos===input.length?(machine.accepts.includes(state)||stack.length===1&&stack[0]==='Z₀'?'accepted':'rejected'):'running';return snap();}
    return{step,snapshot:snap,run(){while(status==='ready'||status==='running')step();return snap();},reset(){pos=0;state=machine.start;stack=['Z₀'];history=[];status='ready';return snap();}};
  }
  root.AutomataEngines={EPSILON,definitions,createFiniteRunner,createTuringRunner,createPdaRunner,closure};
})(window);
