/* ===================== AD FREE COLOUR SORT ===================== */
/* A tube is a string of colour letters, bottom first: "aab" has two of colour a at the bottom and b on top. */
const CS_CAP = 4, CS_LET = "abcdefghij";

const GAME = {
  id: "sort",
  name: "Ad Free Colour Sort",
  title: ["COLOUR","SORT"],
  icon: "🧪",
  version: "1.0",
  changelog: [["1.0","First release: Easy, Medium, Hard and Expert puzzles, a Daily, undo and an extra tube."]],
  blurb: "Pour until every tube holds one colour.",
  timer: false,
  daily: "medium",
  levels: [
    {id:"easy",   name:"Easy",   note:"5 colours · 7 tubes",           k:5,  n:7,  base:100},
    {id:"medium", name:"Medium", note:"7 colours · 9 tubes",           k:7,  n:9,  base:150},
    {id:"hard",   name:"Hard",   note:"9 colours · 11 tubes",  pro:1,  k:9,  n:11, base:200},
    {id:"expert", name:"Expert", note:"10 colours · 11 tubes", pro:1,  k:10, n:11, base:250}
  ],
  proPerks: ["Hard and Expert puzzles","Unlimited undo","One extra tube when you are stuck","Three extra themes"],
  tutorial: [
    {icon:"👆", title:"Tap to lift, tap to pour", body:"Tap a tube to lift its top colour. Tap another tube to pour it in. Tap the same tube again to put it back."},
    {icon:"🧪", title:"Same colour or empty", body:"You can pour only onto the same colour, or into an empty tube, and only as much as fits."},
    {icon:"✅", title:"One colour per tube", body:"Sort every tube so each one holds a single colour. Fewer moves score more."}
  ],
  FREE_UNDOS: 3, SOLVER_CAP: 60000,
  st: null, sel: -1, els: [], box: null, undoBtn: null, extraBtn: null, lvl: null,

  /* ---------- pure puzzle logic (also used by the tests) ---------- */
  top(t){ return t[t.length-1]; },
  run(t){ if(!t) return 0; const c = t[t.length-1]; let r = 0; for(let i=t.length-1;i>=0 && t[i]===c;i--) r++; return r; },
  full(t){ return t.length===CS_CAP && this.run(t)===CS_CAP; },
  solved(tubes){ return tubes.every(t=>t.length===0 || this.full(t)); },
  /* how many layers a pour from a to b would move (0 = not allowed) */
  canPour(tubes, a, b){
    if(a===b) return 0; const A = tubes[a], B = tubes[b];
    if(!A.length || B.length>=CS_CAP) return 0;
    if(B.length && this.top(B)!==this.top(A)) return 0;
    return Math.min(this.run(A), CS_CAP - B.length);
  },
  pour(tubes, a, b){ const k = this.canPour(tubes, a, b); if(!k) return null; const t = tubes.slice();
    t[b] = t[b] + t[a].slice(t[a].length-k); t[a] = t[a].slice(0, t[a].length-k); return t; },
  anyMove(tubes){ for(let a=0;a<tubes.length;a++) for(let b=0;b<tubes.length;b++) if(this.canPour(tubes,a,b)) return true; return false; },
  /* start from the solved state and make random REVERSE pours, so the puzzle can always be solved */
  runs(t){ let r = 0; for(const z of t) for(let i=0;i<z.length;i++) if(i===0 || z[i]!==z[i-1]) r++; return r; },
  scramble(k, n){
    let t = []; for(let i=0;i<n;i++) t.push(i<k ? CS_LET[i].repeat(CS_CAP) : "");
    const want = Math.round(k*2.6), minSteps = 40 + k*10; let last = null;
    for(let s=0; s<2500; s++){
      const opts = []; let bestGain = -9;
      for(let y=0;y<n;y++){ const Y = t[y]; if(!Y.length) continue; const c = this.top(Y), r = this.run(Y);
        for(let q=1;q<=r;q++){ if(q===r && q!==Y.length) continue;            // what stays in Y must still show colour c, or Y must end empty
          for(let x=0;x<n;x++){ if(x===y) continue; const X = t[x];
            if(X.length + q > CS_CAP) continue;
            if(X.length && this.top(X)===c && Y.length < CS_CAP) continue;   // same colour below is fine only if Y was filled to the brim (the pour stopped when Y was full)
            if(last && last[0]===x && last[1]===y) continue;                     // do not undo the step just made
            const gain = (q<r ? 1 : 0) + (X.length ? 1 : 0) - (q===Y.length ? 1 : 0);   // change in the number of colour runs
            opts.push([y,x,q,gain]); bestGain = Math.max(bestGain, gain); } } }
      if(!opts.length) break;
      const pool = UL.random() < 0.35 ? opts.filter(o=>o[3]===bestGain) : opts;  // sometimes mix on purpose, mostly wander
      const [y,x,q] = UL.pick(pool); t = t.slice(); t[x] = t[x] + t[y].slice(t[y].length-q); t[y] = t[y].slice(0, t[y].length-q); last = [y,x];
      if(s >= minSteps && this.runs(t) - k >= want && !t.some(z=>this.full(z))) break;
    }
    return t;
  },
  key(tubes){ return tubes.slice().sort().join("|"); },
  /* A* search. h = colour runs beyond one per colour; one pour removes at most one run, so the answer is the shortest. */
  solve(tubes, cap){
    cap = cap || this.SOLVER_CAP;
    const h = t => { let r = 0; const seen = new Set(); for(const z of t){ for(let i=0;i<z.length;i++){ if(i===0 || z[i]!==z[i-1]) r++; seen.add(z[i]); } } return r - seen.size; };
    const heap = [], push = n => { heap.push(n); let i = heap.length-1; while(i){ const p = (i-1)>>1; if(heap[p].f <= n.f) break; heap[i] = heap[p]; i = p; } heap[i] = n; },
      pop = () => { const r = heap[0], x = heap.pop(); if(heap.length){ let i = 0; for(;;){ let c = 2*i+1; if(c >= heap.length) break; if(c+1 < heap.length && heap[c+1].f < heap[c].f) c++; if(heap[c].f >= x.f) break; heap[i] = heap[c]; i = c; } heap[i] = x; } return r; };
    const best = new Map(); push({t:tubes, g:0, f:h(tubes), path:null}); best.set(this.key(tubes), 0);
    let n = 0;
    while(heap.length && n++ < cap){
      const cur = pop(); if(this.solved(cur.t)){ const out = []; for(let p = cur.path; p; p = p.prev) out.push([p.a, p.b]); return out.reverse(); }
      if(best.get(this.key(cur.t)) < cur.g) continue;
      const t = cur.t;
      for(let a=0;a<t.length;a++){ if(!t[a].length || this.full(t[a])) continue; const uni = this.run(t[a])===t[a].length; let usedEmpty = false;   // pouring into one empty tube is as good as any other
        for(let b=0;b<t.length;b++){ if(!t[b].length){ if(uni || usedEmpty) continue; usedEmpty = true; }
          const nt = this.pour(t, a, b); if(!nt) continue;
          const kk = this.key(nt), g = cur.g+1; if(best.has(kk) && best.get(kk) <= g) continue; best.set(kk, g);
          push({t:nt, g, f:g+h(nt), path:{a, b, prev:cur.path}}); }
      }
    }
    return null;
  },
  /* a random deal: k full tubes and the rest empty, in a shuffled order */
  deal(k, n){
    let layers = []; for(let c=0;c<k;c++) layers.push(...CS_LET[c].repeat(CS_CAP).split(""));
    layers = UL.shuffle(layers); const t = [];
    for(let i=0;i<n;i++) t.push(i<k ? layers.slice(i*CS_CAP, i*CS_CAP+CS_CAP).join("") : "");
    return UL.shuffle(t);
  },
  /* a puzzle for this level from the seeded random functions, always checked by the solver.
     Two or more spare tubes: a random deal (well mixed). One spare tube (Expert): random deals are never solvable,
     so it is scrambled backwards from the solved state. par = the solver's move count, which is the shortest possible. */
  make(level){
    const spare = level.n - level.k;
    for(let tries=0; tries<80; tries++){
      const t = spare >= 2 ? this.deal(level.k, level.n) : this.scramble(level.k, level.n);
      if(this.solved(t) || t.some(z=>this.full(z))) continue;
      const sol = this.solve(t); if(sol) return {tubes:t, par:sol.length};
    }
    throw new Error("Colour Sort could not build a puzzle");
  },

  /* ---------- game ---------- */
  start({level, restore}){
    this.lvl = level; this.sel = -1;
    const st = this.st = restore ? JSON.parse(JSON.stringify(restore))
      : Object.assign(this.make(level), {moves:0, undosUsed:0, undo:[], extra:false, done:0, recent:[]});
    const stage = document.getElementById("stage");
    const box = this.box = document.createElement("div"); box.className = "cs-box"; stage.appendChild(box);
    this.undoBtn = UL.ctrl({icon:"undo", label:"Undo", onTap:()=>this.undoMove()});
    this.extraBtn = UL.ctrl({icon:"fresh", label:"Extra tube", onTap:()=>this.addTube()});
    this.render(); this.hud(); this.bind();
  },
  serialize(){ return JSON.parse(JSON.stringify(this.st)); },
  layout(){
    const stage = document.getElementById("stage"), S = Math.min(stage.clientWidth, stage.clientHeight) || 340, n = this.st.tubes.length;
    const rows = n > 6 ? 2 : 1, per = Math.ceil(n/rows), slotW = S/per, rowH = S/rows;
    const w = Math.min(slotW*0.7, 64), lh = Math.min(w*0.95, (rowH*0.8 - 14)/CS_CAP);
    return {S, rows, per, slotW, rowH, w, lh, h: lh*CS_CAP + 10};
  },
  render(){
    const L = this.L = this.layout(), t = this.st.tubes, box = this.box; box.innerHTML = ""; this.els = [];
    box.style.setProperty("--w", L.w+"px"); box.style.setProperty("--lh", L.lh+"px");
    t.forEach((z, i)=>{
      const row = L.rows===2 && i >= L.per ? 1 : 0, inRow = row ? t.length - L.per : Math.min(L.per, t.length), col = row ? i - L.per : i;
      const slot = document.createElement("button"); slot.className = "cs-slot"; slot.dataset.i = i; slot.setAttribute("aria-label", "Tube "+(i+1));
      const offX = (L.S - inRow*L.slotW)/2;
      slot.style.left = (offX + col*L.slotW)+"px"; slot.style.top = (row*L.rowH)+"px"; slot.style.width = L.slotW+"px"; slot.style.height = L.rowH+"px";
      const tube = document.createElement("div"); tube.className = "cs-tube"; tube.style.height = L.h+"px";
      if(i === this.sel) tube.classList.add("up");
      if(this.full(z)) tube.classList.add("done");
      const cap = document.createElement("i"); cap.className = "cs-cap"; tube.appendChild(cap);
      for(const ch of z){ const l = document.createElement("div"); l.className = "cs-l cs-"+(CS_LET.indexOf(ch)+1); tube.appendChild(l); }
      slot.appendChild(tube); box.appendChild(slot); this.els.push(tube);
    });
  },
  layers(i){ return [...this.els[i].querySelectorAll(".cs-l")]; },
  hud(){
    const s = this.st; UL.setStat("Moves <b>"+s.moves+"</b> · par "+s.par);
    const left = UL.isPro() ? "∞" : Math.max(0, this.FREE_UNDOS - s.undosUsed);
    this.undoBtn.setLabel("Undo "+left); this.undoBtn.classList.toggle("dim", !s.undo.length || left===0);
    this.extraBtn.setLabel(s.extra ? "Extra tube used" : "Extra tube"); this.extraBtn.classList.toggle("dim", s.extra);
  },
  tapTube(i){
    if(UL.paused()) return;
    const s = this.st;
    if(this.sel < 0){
      if(!s.tubes[i].length || this.full(s.tubes[i])){ UL.shake(this.els[i]); UL.buzz("err"); return; }
      this.sel = i; this.els[i].classList.add("up"); UL.buzz("tap"); return;
    }
    const a = this.sel; this.sel = -1;
    if(a === i){ this.els[i].classList.remove("up"); UL.buzz("tap"); return; }
    const k = this.canPour(s.tubes, a, i);
    if(!k){ this.els[a].classList.remove("up"); UL.shake(this.els[i]); UL.buzz("err"); return; }
    this.move(a, i, k);
  },
  move(a, b, k){
    const s = this.st, from = this.layers(a).slice(-k).map(e=>e.getBoundingClientRect());
    s.undo.push(s.tubes.slice()); if(s.undo.length > 60) s.undo.shift();
    s.tubes = this.pour(s.tubes, a, b); s.moves++;
    this.render();
    const moved = this.layers(b).slice(-k);
    moved.forEach((e, j)=>{ const r = e.getBoundingClientRect(), f = from[j];
      e.style.transition = "none"; e.style.transform = "translate("+(f.left-r.left)+"px,"+(f.top-r.top)+"px)";
      void e.offsetWidth; e.style.transition = ""; e.style.transform = ""; });
    UL.buzz("tap");
    if(this.full(s.tubes[b])){
      s.done++; s.recent.push(s.moves); s.recent = s.recent.filter(m=>s.moves - m < 3);
      const el = this.els[b];
      setTimeout(()=>{ UL.pop(el); UL.sweep(this.layers(b).reverse(), 40); UL.buzz("act");
        if(!this.solved(s.tubes)) UL.praise(el, s.recent.length >= 2 ? 2 : 1); }, 190);
    }
    this.hud(); UL.save();
    if(this.solved(s.tubes)) return this.win(b);
    if(!this.anyMove(s.tubes)) UL.toast("No moves left. Undo or restart.");
  },
  win(b){
    const s = this.st, lvl = this.lvl, over = Math.max(0, s.moves - s.par);
    UL.setScore(Math.max(10, lvl.base - 5*over));
    const el = this.els[b], expertish = lvl.id==="hard" || lvl.id==="expert";
    setTimeout(()=>{
      if(expertish && s.moves <= s.par && s.undosUsed===0) UL.praise(el, 4);   // par is the shortest possible solution
      else if(s.moves <= s.par) UL.praise(el, 3);
      else UL.milestone(el, "Sorted!");
    }, 260);
    UL.end({won:true, title:"Sorted", line:"Sorted in "+s.moves+" moves (par "+s.par+")"});
  },
  undoMove(){
    if(UL.paused()) return;
    const s = this.st; if(!s.undo.length) return;
    if(!UL.isPro() && s.undosUsed >= this.FREE_UNDOS){ UL.requirePro("Free games include "+this.FREE_UNDOS+" undos. Pro is unlimited."); return; }
    const prev = s.undo.pop(); while(prev.length < s.tubes.length) prev.push("");   // an extra tube stays
    s.tubes = prev; s.undosUsed++; s.done = s.tubes.filter(z=>this.full(z)).length; s.recent = [];
    this.sel = -1; this.render(); this.hud(); UL.save();
  },
  addTube(){
    if(UL.paused()) return;
    if(!UL.requirePro("An extra tube is part of Pro.")) return;
    const s = this.st; if(s.extra){ UL.toast("One extra tube per game."); return; }
    s.extra = true; s.tubes = s.tubes.concat([""]); this.sel = -1; this.render(); this.hud(); UL.save();
    UL.pop(this.els[this.els.length-1]);
  },
  bind(){
    this.box.addEventListener("pointerup", e=>{ const slot = e.target.closest(".cs-slot"); if(slot) this.tapTube(+slot.dataset.i); });
    if(this.bound) return; this.bound = true;
    document.addEventListener("keydown", e=>{ if(!this.st || document.activeElement.tagName === "INPUT") return;
      const d = "1234567890-=".indexOf(e.key); if(d >= 0 && d < this.st.tubes.length) this.tapTube(d); });
    window.addEventListener("resize", ()=>{ if(this.st && this.box) this.render(); });
  },
  onPro(){ if(this.undoBtn) this.hud(); }
};
