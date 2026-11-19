/* ===================== AD FREE PICTURE GRID ===================== */
/* Number clues give the runs of filled squares in each row and column. Every puzzle is made in code from a
   seeded random pattern and kept only if row-by-row and column-by-column logic alone can finish it. */
const PG_UNKNOWN = 0, PG_FILL = 1, PG_MARK = 2;

const GAME = {
  id: "grid",
  name: "Ad Free Picture Grid",
  title: ["PICTURE","GRID"],
  icon: "🖼️",
  version: "1.0",
  changelog: [["1.0","First release: 5×5, 10×10, 15×15 and 20×20 puzzles, a Daily, gentle or pure mistakes, hints."]],
  blurb: "Number clues reveal a picture. Fill the squares that belong.",
  timer: true,
  daily: "medium",
  levels: [
    {id:"small",  name:"Small 5×5",   note:"a quick warm-up",            n:5,  base:100, par:60},
    {id:"medium", name:"Medium 10×10",note:"a proper puzzle",            n:10, base:200, par:240},
    {id:"large",  name:"Large 15×15", note:"room for a real picture", pro:1, n:15, base:350, par:600},
    {id:"huge",   name:"Huge 20×20",  note:"the long one",          pro:1, n:20, base:500, par:1200}
  ],
  proPerks: ["15×15 and 20×20 puzzles","Five hints a game","Three extra themes","Score chart and level breakdown"],
  tutorial: [
    {icon:"🔢", title:"What a clue means", body:"The numbers beside a row say how many filled squares it has, in order. A row marked 4 on a 5-wide board has four filled squares side by side: the middle three must be filled, whichever end it starts."},
    {icon:"➖", title:"Several numbers, several runs", body:"A clue of 2 1 means a run of two, then at least one gap, then a run of one. On a 4-wide row, 2 1 fits only one way: two filled, one gap, one filled."},
    {icon:"✕", title:"Mark what is empty", body:"Switch to Mark and tap squares you know are empty. A row marked 0 is all empty. Crosses help the other lines fall into place."},
    {icon:"🎯", title:"Start with the big clues", body:"Big numbers leave little room. Fill what overlaps, mark what cannot be filled, then follow the columns. Drag along a row or column to fill several at once."}
  ],
  FREE_HINTS: 1, PRO_HINTS: 5,
  st: null, lvl: null, cells: [], board: null, fillBtn: null, markBtn: null, undoBtn: null, hintBtn: null, stroke: null,

  /* ---------- pure logic (also used by the tests) ---------- */
  runs(line){ const out = []; let r = 0; for(const v of line){ if(v === 1){ r++; } else if(r){ out.push(r); r = 0; } } if(r) out.push(r); return out; },
  clues(sol, n){ const rows = [], cols = [];
    for(let r=0;r<n;r++) rows.push(this.runs(sol.slice(r*n, r*n+n)));
    for(let c=0;c<n;c++){ const col = []; for(let r=0;r<n;r++) col.push(sol[r*n+c]); cols.push(this.runs(col)); }
    return {rows, cols}; },
  /* one line: which squares are certainly filled or empty given the clue and what is known (0 unknown, 1 filled, 2 empty) */
  settle(clue, s){
    const L = s.length, k = clue.length, emptyPre = [0];
    for(let i=0;i<L;i++) emptyPre.push(emptyPre[i] + (s[i] === 2 ? 1 : 0));
    const noEmpty = (a, b) => emptyPre[b] - emptyPre[a] === 0;              // [a, b) has no known-empty square
    const fwd = Array.from({length:L+2}, ()=>new Uint8Array(k+1)), bwd = Array.from({length:L+2}, ()=>new Uint8Array(k+1));
    fwd[0][0] = 1;
    for(let i=0;i<=L;i++) for(let j=0;j<=k;j++){ if(!fwd[i][j]) continue;
      if(i < L && s[i] !== 1) fwd[i+1][j] = 1;
      if(j < k){ const b = clue[j]; if(i + b <= L && noEmpty(i, i+b)){ if(i + b === L) fwd[L][j+1] = 1; else if(s[i+b] !== 1) fwd[i+b+1][j+1] = 1; } } }
    bwd[L][k] = 1; bwd[L+1][k] = 1;
    for(let i=L;i>=0;i--) for(let j=k;j>=0;j--){
      let v = 0;
      if(i === L) v = j === k ? 1 : 0;
      else { if(s[i] !== 1 && bwd[i+1][j]) v = 1;
        if(!v && j < k){ const b = clue[j]; if(i + b <= L && noEmpty(i, i+b)){ if(i + b === L) v = j+1 === k ? 1 : 0; else if(s[i+b] !== 1 && bwd[i+b+1][j+1]) v = 1; } } }
      bwd[i][j] = v; }
    if(!bwd[0][0]) return null;                                              // contradiction
    const canFill = new Uint8Array(L), canEmpty = new Uint8Array(L);
    for(let i=0;i<L;i++) for(let j=0;j<=k;j++) if(fwd[i][j] && s[i] !== 1 && bwd[i+1][j]){ canEmpty[i] = 1; break; }
    for(let i=0;i<L;i++){ if(canEmpty[i] || s[i] === 1) continue;           // the gap right after block j-1 is empty too
      for(let j=1;j<=k;j++){ const b = clue[j-1], q = i - b; if(q >= 0 && fwd[q][j-1] && noEmpty(q, i) && bwd[i+1][j]){ canEmpty[i] = 1; break; } } }
    for(let j=0;j<k;j++){ const b = clue[j];
      for(let p=0;p+b<=L;p++){ if(!fwd[p][j] || !noEmpty(p, p+b)) continue;
        const ok = p + b === L ? (j+1 === k) : (s[p+b] !== 1 && bwd[p+b+1][j+1]);
        if(ok) for(let q=p;q<p+b;q++) canFill[q] = 1; } }
    const out = s.slice();
    for(let i=0;i<L;i++){ if(out[i]) continue; if(canFill[i] && !canEmpty[i]) out[i] = 1; else if(canEmpty[i] && !canFill[i]) out[i] = 2; }
    return out;
  },
  /* solve by line logic alone; returns the grid (1 filled / 2 empty) or null if logic gets stuck */
  solve(cl, n){
    const g = new Array(n*n).fill(0); let dirty = true, guard = 0;
    while(dirty && guard++ < 400){ dirty = false;
      for(let r=0;r<n;r++){ const line = g.slice(r*n, r*n+n), out = this.settle(cl.rows[r], line); if(!out) return null;
        for(let c=0;c<n;c++) if(out[c] !== line[c]){ g[r*n+c] = out[c]; dirty = true; } }
      for(let c=0;c<n;c++){ const line = []; for(let r=0;r<n;r++) line.push(g[r*n+c]); const out = this.settle(cl.cols[c], line); if(!out) return null;
        for(let r=0;r<n;r++) if(out[r] !== line[r]){ g[r*n+c] = out[r]; dirty = true; } } }
    return g.every(v=>v) ? g : null;
  },
  /* a random pattern that looks like shapes: smoothed once, sometimes mirrored left to right; make() keeps only 55-65% (about) filled */
  pattern(n){
    const dens = 0.50 + UL.random()*0.08, sym = UL.random() < 0.8, g = new Array(n*n).fill(0);
    for(let i=0;i<n*n;i++) g[i] = UL.random() < dens ? 1 : 0;
    const s = g.slice();
    for(let r=0;r<n;r++) for(let c=0;c<n;c++){ let on = 0, all = 0;
      for(let dr=-1;dr<=1;dr++) for(let dc=-1;dc<=1;dc++){ const R = r+dr, C = c+dc; if(R<0||C<0||R>=n||C>=n) continue; all++; on += g[R*n+C]; }
      s[r*n+c] = on*2 > all ? 1 : on*2 < all ? 0 : g[r*n+c]; }
    if(sym) for(let r=0;r<n;r++) for(let c=0;c<n/2;c++) s[r*n+(n-1-c)] = s[r*n+c];
    return s;
  },
  make(n){
    const lo = n <= 5 ? 0.48 : 0.52, hi = n <= 5 ? 0.72 : 0.68;
    for(let t=0;t<400;t++){ const sol = this.pattern(n), d = sol.filter(Boolean).length/(n*n); if(d < lo || d > hi) continue;
      const cl = this.clues(sol, n), g = this.solve(cl, n);
      if(g && g.every((v,i)=>(v===1) === (sol[i]===1))) return {sol, clues:cl, tries:t+1}; }
    throw new Error("Picture Grid could not build a puzzle");
  },

  /* ---------- game ---------- */
  start({level, restore}){
    this.lvl = level; this.stroke = null; this.ending = false;
    let st = restore ? JSON.parse(JSON.stringify(restore)) : null;
    if(!st){ const m = this.make(level.n); st = {n:level.n, sol:m.sol, g:new Array(level.n*level.n).fill(0), tool:"fill", mistakes:0, hints:0, undo:[], done:[]}; }
    this.st = st; this.cl = this.clues(st.sol, st.n);
    this.build(); this.paint(); this.hud();
  },
  serialize(){ const s = this.st; return {n:s.n, sol:s.sol, g:s.g, tool:s.tool, mistakes:s.mistakes, hints:s.hints, undo:s.undo.slice(-40), done:s.done}; },
  pure(){ return UL.kv("pure", false); },
  build(){
    const s = this.st, n = s.n, cl = this.cl, stage = document.getElementById("stage"), S = Math.min(stage.clientWidth, stage.clientHeight) || 340;
    const maxR = Math.max(1, ...cl.rows.map(r=>r.length)), maxC = Math.max(1, ...cl.cols.map(c=>c.length));
    const cs = Math.floor((S - 4) / (n + Math.max(maxR, maxC)*0.62 + 0.4)), cw = Math.ceil(maxR*cs*0.62 + cs*0.3), ch = Math.ceil(maxC*cs*0.62 + cs*0.3);
    const wrap = document.createElement("div"); wrap.className = "pg-wrap"; wrap.style.setProperty("--cs", cs+"px");
    const total = cw + cs*n, left = Math.max(0, Math.floor((S - total)/2)), top = Math.max(0, Math.floor((S - (ch + cs*n))/2));
    const colClues = document.createElement("div"); colClues.className = "pg-cc"; colClues.style.left = (left+cw)+"px"; colClues.style.top = top+"px"; colClues.style.width = (cs*n)+"px"; colClues.style.height = ch+"px";
    const rowClues = document.createElement("div"); rowClues.className = "pg-rc"; rowClues.style.left = left+"px"; rowClues.style.top = (top+ch)+"px"; rowClues.style.width = cw+"px"; rowClues.style.height = (cs*n)+"px";
    this.colEls = cl.cols.map(c=>{ const d = document.createElement("div"); d.className = "pg-clue"; d.innerHTML = (c.length ? c : [0]).map(x=>"<span>"+x+"</span>").join(""); colClues.appendChild(d); return d; });
    this.rowEls = cl.rows.map(r=>{ const d = document.createElement("div"); d.className = "pg-clue"; d.innerHTML = (r.length ? r : [0]).map(x=>"<span>"+x+"</span>").join(""); rowClues.appendChild(d); return d; });
    const b = this.board = document.createElement("div"); b.className = "pg-board"; b.style.setProperty("--n", n);
    b.style.left = (left+cw)+"px"; b.style.top = (top+ch)+"px"; b.style.width = (cs*n)+"px"; b.style.height = (cs*n)+"px";
    this.cells = [];
    for(let i=0;i<n*n;i++){ const c = document.createElement("div"); c.className = "pg-cell"; const r = Math.floor(i/n), k = i%n;
      if(k%5===4 && k<n-1) c.classList.add("br"); if(r%5===4 && r<n-1) c.classList.add("bb"); b.appendChild(c); this.cells.push(c); }
    wrap.append(colClues, rowClues, b); stage.appendChild(wrap); this.wrap = wrap;
    this.fillBtn = UL.ctrl({icon:"pencil", label:"Fill", onTap:()=>this.setTool("fill")});
    this.markBtn = UL.ctrl({icon:"erase", label:"Mark", onTap:()=>this.setTool("mark")});
    this.undoBtn = UL.ctrl({icon:"undo", label:"Undo", onTap:()=>this.undoMove()});
    this.hintBtn = UL.ctrl({icon:"hint", label:"Hint", onTap:()=>this.hint()});
    const below = document.getElementById("below"), opt = document.createElement("button"); opt.className = "pg-opt"; below.appendChild(opt); this.optBtn = opt;
    opt.addEventListener("click", ()=>{ UL.setKv("pure", !this.pure()); this.paintOpt(); UL.toast(this.pure() ? "Pure mode: no mistake help until the picture is complete." : "Gentle mode: a wrong square shakes and becomes a cross."); });
    this.paintOpt(); this.bind();
  },
  paintOpt(){ this.optBtn.textContent = this.pure() ? "Mistake help: off (pure)" : "Mistake help: on (gentle)"; },
  setTool(t){ this.st.tool = t; this.hud(); UL.save(); },
  hud(){ const s = this.st;
    this.fillBtn.classList.toggle("on", s.tool==="fill"); this.markBtn.classList.toggle("on", s.tool==="mark");
    this.undoBtn.classList.toggle("dim", !s.undo.length);
    const left = Math.max(0, (UL.isPro() ? this.PRO_HINTS : this.FREE_HINTS) - s.hints); this.hintBtn.setLabel("Hint "+left); this.hintBtn.classList.toggle("dim", left===0);
    UL.setStat(this.pure() ? "Pure mode" : "Mistakes <b>"+s.mistakes+"</b>"); },
  lineDone(kind, k){ const s = this.st, n = s.n, line = [];
    for(let j=0;j<n;j++) line.push(s.g[kind==="r" ? k*n+j : j*n+k] === 1 ? 1 : 0);
    const want = kind==="r" ? this.cl.rows[k] : this.cl.cols[k], got = this.runs(line);
    return got.length === want.length && got.every((v,i)=>v===want[i]); },
  paint(){ const s = this.st, n = s.n;
    this.cells.forEach((c, i)=>{ c.classList.toggle("on", s.g[i]===1); c.classList.toggle("x", s.g[i]===2); });
    for(let k=0;k<n;k++){ this.rowEls[k].classList.toggle("ok", this.lineDone("r", k)); this.colEls[k].classList.toggle("ok", this.lineDone("c", k)); } },
  focus(i){ const n = this.st.n, r = i < 0 ? -1 : Math.floor(i/n), c = i < 0 ? -1 : i%n;
    this.cells.forEach((el, j)=>el.classList.toggle("act", i >= 0 && (Math.floor(j/n)===r || j%n===c)));
    this.rowEls.forEach((el, k)=>el.classList.toggle("act", k===r)); this.colEls.forEach((el, k)=>el.classList.toggle("act", k===c)); },

  /* ---------- strokes: tap or drag along one row or column ---------- */
  cellAt(x, y){ const r = this.board.getBoundingClientRect(), n = this.st.n, c = Math.floor((x - r.left)/r.width*n), w = Math.floor((y - r.top)/r.height*n);
    return (c<0||w<0||c>=n||w>=n) ? -1 : w*n + c; },
  bind(){
    const b = this.board;
    b.addEventListener("pointerdown", e=>{ if(UL.paused() || this.ending) return; const i = this.cellAt(e.clientX, e.clientY); if(i < 0) return;
      e.preventDefault(); try{ b.setPointerCapture(e.pointerId); }catch(err){}
      const s = this.st, cur = s.g[i], want = s.tool==="fill" ? (cur===1 ? 0 : 1) : (cur===2 ? 0 : 2);
      this.stroke = {id:e.pointerId, start:i, from:cur, to:want, axis:null, touched:new Set(), snap:s.g.slice(), stopped:false};
      this.focus(i); this.apply(i); });
    b.addEventListener("pointermove", e=>{ const k = this.stroke; if(!k || k.id !== e.pointerId || k.stopped) return; const i = this.cellAt(e.clientX, e.clientY); if(i < 0) return;
      const n = this.st.n, r0 = Math.floor(k.start/n), c0 = k.start%n, r = Math.floor(i/n), c = i%n;
      if(!k.axis){ if(r === r0 && c === c0) return; k.axis = Math.abs(r - r0) >= Math.abs(c - c0) ? "c" : "r"; }  // the drag locks to the row or column it starts in
      const lo = k.axis==="r" ? Math.min(c, c0) : Math.min(r, r0), hi = k.axis==="r" ? Math.max(c, c0) : Math.max(r, r0);
      for(let t=lo;t<=hi;t++){ const j = k.axis==="r" ? r0*n + t : t*n + c0; this.apply(j); if(k.stopped) break; }
      this.focus(k.axis==="r" ? r0*n + Math.max(0, Math.min(n-1, c)) : Math.max(0, Math.min(n-1, r))*n + c0); });
    const end = e=>{ const k = this.stroke; if(!k || k.id !== e.pointerId) return; this.stroke = null; this.finishStroke(k); };
    b.addEventListener("pointerup", end); b.addEventListener("pointercancel", end);
  },
  apply(i){
    const s = this.st, k = this.stroke; if(!k || k.touched.has(i)) return; k.touched.add(i);
    if(s.g[i] !== k.from) return;                                      // a stroke only changes squares that looked like the first one
    if(k.to === 1 && s.sol[i] !== 1 && !this.pure()){                 // gentle mode: a wrong fill shakes, turns into a cross, and stops the stroke
      s.g[i] = 2; s.mistakes++; k.stopped = true; k.mistake = true; UL.shake(this.cells[i]); UL.buzz("err"); this.paint(); this.hud(); return; }
    s.g[i] = k.to; this.cells[i].classList.toggle("on", k.to===1); this.cells[i].classList.toggle("x", k.to===2);
    if(k.to === 1) UL.buzz("tap");
  },
  finishStroke(k){
    const s = this.st, n = s.n;
    this.focus(-1);
    if(k.snap.every((v,i)=>v===s.g[i])) return;
    s.undo.push(k.snap); if(s.undo.length > 60) s.undo.shift();
    this.paint();
    // rows and columns completed by this stroke
    const before = {r:[], c:[]}, nowDone = [];
    const doneIn = (g, kind, j) => { const line = []; for(let t=0;t<n;t++) line.push(g[kind==="r" ? j*n+t : t*n+j]===1 ? 1 : 0); const want = kind==="r" ? this.cl.rows[j] : this.cl.cols[j], got = this.runs(line); return got.length===want.length && got.every((v,x)=>v===want[x]); };
    const right = (kind, j) => { for(let t=0;t<n;t++){ const i = kind==="r" ? j*n+t : t*n+j; if((s.g[i]===1) !== (s.sol[i]===1)) return false; } return true; };
    const rows = new Set(), cols = new Set(); k.touched.forEach(i=>{ rows.add(Math.floor(i/n)); cols.add(i%n); });
    rows.forEach(r=>{ if(!doneIn(k.snap,"r",r) && doneIn(s.g,"r",r) && (this.pure() || right("r",r))) nowDone.push(["r",r]); });
    cols.forEach(c=>{ if(!doneIn(k.snap,"c",c) && doneIn(s.g,"c",c) && (this.pure() || right("c",c))) nowDone.push(["c",c]); });
    if(nowDone.length && !this.pure()){
      nowDone.forEach(([kind, j])=>{ const els = []; for(let t=0;t<n;t++) els.push(this.cells[kind==="r" ? j*n+t : t*n+j]); UL.sweep(els, 14); });
      UL.buzz("act");
      const both = nowDone.some(d=>d[0]==="r") && nowDone.some(d=>d[0]==="c"), at = this.cells[[...k.touched].pop()];
      if(!this.solvedNow()) UL.praise(at, both ? 2 : 1);
    }
    this.hud(); UL.save();
    if(this.solvedNow()) this.win();
  },
  solvedNow(){ const s = this.st; return s.sol.every((v,i)=>(v===1) === (s.g[i]===1)); },
  win(){
    if(this.ending) return; this.ending = true;
    const s = this.st, lvl = this.lvl, sec = UL.cur.sec;
    this.board.classList.add("pg-done"); this.wrap.classList.add("pg-done");
    UL.setScore(Math.max(10, lvl.base + Math.max(0, lvl.par - sec) - 20*s.mistakes - 50*s.hints));
    const clean = s.mistakes === 0 && !this.pure(), big = lvl.id==="large" || lvl.id==="huge", mid = this.cells[Math.floor(s.n/2)*s.n + Math.floor(s.n/2)];
    if(clean && big && s.hints === 0) UL.praise(mid, 4); else if(clean) UL.praise(mid, 3); else UL.milestone(mid, "Picture done!");
    UL.end({won:true, title:"Picture complete", line:lvl.name+" in "+UL.fmtTime(sec)+(this.pure() ? "" : ", "+s.mistakes+" mistake"+(s.mistakes===1?"":"s"))+(s.hints ? ", "+s.hints+" hint"+(s.hints===1?"":"s") : "")});
  },
  undoMove(){ if(UL.paused() || this.ending) return; const s = this.st; if(!s.undo.length) return; s.g = s.undo.pop(); this.paint(); this.hud(); UL.save(); },
  /* Hint: reveals one row or column that is not right yet: filled where it belongs, crossed elsewhere */
  hint(){
    if(UL.paused() || this.ending) return;
    const s = this.st, n = s.n, cap = UL.isPro() ? this.PRO_HINTS : this.FREE_HINTS;
    if(s.hints >= cap){ if(!UL.isPro()) UL.requirePro("Free games include one hint. Pro gives five."); else UL.toast("No hints left in this game."); return; }
    const wrongIn = (kind, j) => { let w = 0; for(let t=0;t<n;t++){ const i = kind==="r" ? j*n+t : t*n+j, want = s.sol[i]===1 ? 1 : 2; if(s.g[i] !== want) w++; } return w; };
    let best = null; for(const kind of ["r","c"]) for(let j=0;j<n;j++){ const w = wrongIn(kind, j); if(w && (!best || w > best.w)) best = {kind, j, w}; }
    if(!best) return;
    s.undo.push(s.g.slice()); s.hints++;
    const els = []; for(let t=0;t<n;t++){ const i = best.kind==="r" ? best.j*n+t : t*n+best.j; s.g[i] = s.sol[i]===1 ? 1 : 2; els.push(this.cells[i]); }
    this.paint(); UL.sweep(els, 16); UL.buzz("act"); this.hud(); UL.save();
    if(this.solvedNow()) this.win();
  },
  onPause(){ if(this.stroke){ const k = this.stroke; this.stroke = null; this.finishStroke(k); } },
  onPro(){ if(this.hintBtn) this.hud(); }
};
