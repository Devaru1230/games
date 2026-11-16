/* ===================== AD FREE MINES ===================== */
const MN_FLAG = '<svg class="mn-flag" viewBox="0 0 24 24"><path class="s" d="M7 21V3"/><path class="p" d="M7 4h11l-3 4 3 4H7z"/></svg>';
const MN_MINE = '<svg class="mn-mine" viewBox="0 0 24 24"><path d="M12 2v20M2 12h20M5 5l14 14M19 5L5 19"/><circle cx="12" cy="12" r="6.5"/><circle class="g" cx="10" cy="10" r="1.8"/></svg>';
const MN_WRONG = '<svg class="mn-flag mn-wrong" viewBox="0 0 24 24"><path class="s" d="M7 21V3"/><path class="p" d="M7 4h11l-3 4 3 4H7z"/><path class="x" d="M3 3l18 18M21 3L3 21"/></svg>';

const GAME = {
  id: "mines",
  name: "Ad Free Mines",
  title: ["MI","NES"],
  icon: "💣",
  version: "1.0",
  changelog: [["1.0","First release: Small, Medium, Large and Expert boards, a Daily, flag mode, chording and no-guess boards."]],
  blurb: "Open every safe square. Numbers count the mines next door.",
  timer: true,
  daily: "medium",
  levels: [
    {id:"small",  name:"Small 8×8",    note:"10 mines",          c:8,  r:8,  m:10, mult:1, par:45},
    {id:"medium", name:"Medium 10×12", note:"20 mines",          c:10, r:12, m:20, mult:2, par:100},
    {id:"large",  name:"Large 10×13",  note:"24 mines", pro:1,   c:10, r:13, m:24, mult:3, par:120},
    {id:"expert", name:"Expert 12×15", note:"43 mines", pro:1,   c:12, r:15, m:43, mult:4, par:240}
  ],
  proPerks: ["Large and Expert boards","No-guess boards","Three extra themes","Score chart and level breakdown"],
  tutorial: [
    {icon:"🔢", title:"Numbers count mines", body:"Tap a square to open it. A number tells you how many of the 8 squares around it hide a mine."},
    {icon:"🚩", title:"Flag what you are sure of", body:"Turn on Flag and tap a square to mark a mine, or press and hold. Tap a number whose mines are all flagged to open the rest around it."},
    {icon:"🛟", title:"The first tap is safe", body:"Your first tap never hits a mine and always opens an area. Open every safe square to win."}
  ],
  unsound: 0,        // counts any wrong deduction by the solver; the tests require it to stay 0
  st: null, els: [], board: null, flagBtn: null, ngBtn: null, lvl: null,

  /* ---------- pure helpers (also used by the tests) ---------- */
  nbrs(i, c, r){ const x = i%c, y = (i-x)/c, out = [];
    for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){ if(!dx && !dy) continue; const nx=x+dx, ny=y+dy;
      if(nx>=0 && ny>=0 && nx<c && ny<r) out.push(ny*c+nx); }
    return out; },
  /* place m mines with the seeded random functions, keeping the first tap and its neighbours clear */
  layout(c, r, m, first){
    const keep = new Set([first, ...this.nbrs(first, c, r)]), cand = [];
    for(let i=0;i<c*r;i++) if(!keep.has(i)) cand.push(i);
    return UL.shuffle(cand).slice(0, m).sort((a,b)=>a-b);
  },
  counts(c, r, mines){ const isM = new Uint8Array(c*r); mines.forEach(i=>isM[i]=1);
    const n = new Int8Array(c*r); for(let i=0;i<c*r;i++) n[i] = isM[i] ? -1 : this.nbrs(i,c,r).reduce((a,j)=>a+isM[j],0); return n; },
  /* logic-only solver: single-cell rule, subset rule, and the remaining-mine count. true = solvable without guessing */
  solve(c, r, mines, first){
    const N = c*r, num = this.counts(c, r, mines), open = new Uint8Array(N), mk = new Uint8Array(N); let opened = 0;
    const reveal = s => { const q = [s]; while(q.length){ const i = q.pop(); if(open[i] || mk[i]) continue; if(num[i] < 0){ this.unsound++; return false; }
      open[i] = 1; opened++; if(num[i] === 0) for(const j of this.nbrs(i,c,r)) if(!open[j]) q.push(j); } return true; };
    reveal(first);
    const mark = j => { if(num[j] >= 0) this.unsound++; mk[j] = 1; };
    const safeTotal = N - mines.length;
    for(let guard=0; guard<N*4 && opened < safeTotal; guard++){
      let prog = false; const cons = [];
      for(let i=0;i<N;i++){ if(!open[i] || num[i] <= 0) continue;
        const unk = [], nb = this.nbrs(i,c,r); let need = num[i];
        for(const j of nb){ if(mk[j]) need--; else if(!open[j]) unk.push(j); }
        if(!unk.length) continue;
        if(need === 0){ unk.forEach(j=>reveal(j)); prog = true; }
        else if(need === unk.length){ unk.forEach(mark); prog = true; }
        else cons.push({set:new Set(unk), cells:unk, need});
      }
      if(!prog){            // pair rule (covers the subset rule): two numbers whose squares overlap
        const by = new Map(); cons.forEach((C,k)=>C.cells.forEach(j=>{ if(!by.has(j)) by.set(j, []); by.get(j).push(k); }));
        for(let a=0;a<cons.length && !prog;a++){ const A = cons[a], seen = new Set();
          for(const j of A.cells) for(const bI of by.get(j)){ if(bI===a || seen.has(bI) || prog) continue; seen.add(bI); const B = cons[bI];
            const onlyA = A.cells.filter(x=>!B.set.has(x)), onlyB = B.cells.filter(x=>!A.set.has(x));
            if(A.need - onlyA.length === B.need && (onlyA.length || onlyB.length)){   // A's extra squares must all be mines, B's extras all safe
              onlyA.forEach(mark); onlyB.forEach(x=>reveal(x)); prog = true; } } }
      }
      if(!prog){            // count rule: every unknown is a mine, or no mines are left
        let unk = 0, marked = 0; for(let i=0;i<N;i++){ if(mk[i]) marked++; else if(!open[i]) unk++; }
        const left = mines.length - marked;
        if(left === 0 && unk){ for(let i=0;i<N;i++) if(!open[i] && !mk[i]) reveal(i); prog = true; }
        else if(left === unk && unk){ for(let i=0;i<N;i++) if(!open[i] && !mk[i]) mark(i); prog = true; }
      }
      if(!prog) break;
    }
    return opened === safeTotal;
  },

  /* ---------- game ---------- */
  start({level, daily, restore}){
    this.lvl = level;
    const st = this.st = restore ? this.thaw(restore) : {c:level.c, r:level.r, m:level.m, mines:null, open:new Array(level.c*level.r).fill(0),
      flag:new Array(level.c*level.r).fill(0), flagMode:false, opened:0, wrongEver:false, flagsPlaced:0, ng:false, first:-1, boom:-1};
    this.num = st.mines ? this.counts(st.c, st.r, st.mines) : null;
    const stage = document.getElementById("stage"), wrap = document.createElement("div"); wrap.className = "mn-wrap";
    const b = this.board = document.createElement("div"); b.className = "mn-board";
    b.style.gridTemplateColumns = "repeat("+st.c+", 1fr)";
    this.els = [];
    for(let i=0;i<st.c*st.r;i++){ const e = document.createElement("div"); e.className = "mn-cell"; e.dataset.i = i;
      e.addEventListener("animationend", ()=>e.classList.remove("mn-rip")); b.appendChild(e); this.els.push(e); }
    wrap.appendChild(b); stage.appendChild(wrap);
    this.size();
    this.flagBtn = UL.ctrl({icon:"flag", label:"Flag", onTap:()=>this.setFlagMode(!this.st.flagMode)});
    this.ngBtn = UL.ctrl({icon:"bolt", label:"No-guess", onTap:()=>this.toggleNoGuess()});
    this.bind();
    for(let i=0;i<st.c*st.r;i++) this.paint(i);
    this.hud();
  },
  thaw(o){ return {c:o.c, r:o.r, m:o.m, mines:o.mines, open:o.open.split("").map(Number), flag:o.flag.split("").map(Number),
    flagMode:!!o.flagMode, opened:o.opened, wrongEver:!!o.wrongEver, flagsPlaced:o.flagsPlaced||0, ng:!!o.ng, first:o.first, boom:-1}; },
  serialize(){ const s = this.st; return {c:s.c, r:s.r, m:s.m, mines:s.mines, open:s.open.join(""), flag:s.flag.join(""),
    flagMode:s.flagMode, opened:s.opened, wrongEver:s.wrongEver, flagsPlaced:s.flagsPlaced, ng:s.ng, first:s.first}; },
  size(){
    const stage = document.getElementById("stage"), S = Math.min(stage.clientWidth, stage.clientHeight) || 340, s = this.st;
    const cs = Math.floor((S - 6) / Math.max(s.c, s.r)), b = this.board;
    b.style.width = (cs*s.c)+"px"; b.style.height = (cs*s.r)+"px";
    b.style.gridTemplateRows = "repeat("+s.r+", "+cs+"px)";
    b.style.left = Math.round((S - cs*s.c - 6)/2)+"px"; b.style.top = Math.round((S - cs*s.r - 6)/2)+"px";
    b.style.fontSize = Math.round(cs*0.56)+"px";
  },
  paint(i){
    const s = this.st, e = this.els[i];
    if(s.open[i]){ const n = this.num[i]; e.className = "mn-cell mn-o"; e.dataset.n = n; e.textContent = n > 0 ? n : ""; }
    else { e.className = "mn-cell mn-c"; delete e.dataset.n; e.innerHTML = s.flag[i] ? MN_FLAG : ""; }
  },
  hud(){
    const s = this.st, flags = s.flag.reduce((a,b)=>a+b,0);
    UL.setStat("Mines left <b>"+(s.m - flags)+"</b>");
    this.flagBtn.setLabel(s.flagMode ? "Flag: on" : "Flag: off"); this.flagBtn.classList.toggle("on", s.flagMode);
    const daily = !!(UL.cur && UL.cur.daily), on = UL.kv("noguess", false) && UL.isPro();
    this.ngBtn.setLabel(daily ? "No-guess: not on Daily" : on ? "No-guess: on" : "No-guess: off");
    this.ngBtn.classList.toggle("on", on && !daily); this.ngBtn.classList.toggle("dim", daily);
  },
  setFlagMode(v){ if(UL.paused()) return; this.st.flagMode = v; this.hud(); UL.save(); },
  toggleNoGuess(){
    if(UL.cur && UL.cur.daily){ UL.toast("The Daily is the same board for everyone, so it never uses no-guess."); return; }
    if(!UL.requirePro("No-guess boards are part of Pro.")) return;
    const v = !UL.kv("noguess", false); UL.setKv("noguess", v); this.hud();
    UL.toast(v ? (this.st.mines ? "No-guess boards are on from your next game." : "No-guess is on.") : "No-guess boards are off.");
  },
  /* first tap: place the mines (no-guess retries from the same seeded stream, up to 200 boards) */
  place(first){
    const s = this.st, daily = !!(UL.cur && UL.cur.daily), ng = !daily && UL.isPro() && UL.kv("noguess", false);
    let mines = null, ok = false;
    for(let a=0; a<(ng ? 200 : 1); a++){ mines = this.layout(s.c, s.r, s.m, first); if(!ng || this.solve(s.c, s.r, mines, first)){ ok = true; break; } }
    if(ng && !ok) UL.toast("No no-guess board found this time. This board may need a guess.");
    s.mines = mines; s.first = first; s.ng = ng && ok; this.num = this.counts(s.c, s.r, mines);
    const isM = new Set(mines); s.flag.forEach((f,i)=>{ if(f && !isM.has(i)) s.wrongEver = true; });
  },
  /* open from cell i with the zero cascade; returns [{i,d}] in ripple order, or null if i is a mine */
  openFrom(i){
    const s = this.st, out = [], q = [[i,0]];
    if(this.num[i] < 0) return null;
    while(q.length){ const [j,d] = q.shift(); if(s.open[j] || s.flag[j]) continue; s.open[j] = 1; s.opened++; out.push({i:j, d});
      if(this.num[j] === 0) for(const k of this.nbrs(j, s.c, s.r)) if(!s.open[k] && !s.flag[k]) q.push([k, d+1]); }
    return out;
  },
  show(list, src){
    list.forEach(o=>this.paint(o.i));
    if(list.length === 1){ UL.pop(this.els[list[0].i]); return; }
    for(const o of list){ const e = this.els[o.i]; e.style.animationDelay = Math.min(o.d*30, 270)+"ms"; e.classList.remove("mn-rip"); void e.offsetWidth; e.classList.add("mn-rip"); }
  },
  tap(i){
    if(UL.paused()) return;
    const s = this.st, firstTap = !s.mines;
    if(firstTap){ if(s.flagMode || s.flag[i]){ this.toggleFlag(i); return; } this.place(i); }
    if(s.open[i]){ this.chord(i); return; }
    if(s.flagMode){ this.toggleFlag(i); return; }
    if(s.flag[i]){ UL.shake(this.els[i]); return; }
    const got = this.openFrom(i);
    if(!got){ this.lose(i); return; }
    this.after(got, i);
    if(!firstTap){ if(got.length >= 20) UL.praise(this.els[i], 2); else if(got.length >= 8) UL.praise(this.els[i], 1); }   // the safe first opening is the game's doing, not praised
    this.check();
  },
  after(got, i){
    const s = this.st; this.show(got, i); UL.buzz("tap"); UL.addScore(got.length * this.lvl.mult); this.hud(); UL.save();
  },
  chord(i){
    const s = this.st, n = this.num[i]; if(n <= 0) return;
    const nb = this.nbrs(i, s.c, s.r), flags = nb.filter(j=>s.flag[j]).length, todo = nb.filter(j=>!s.flag[j] && !s.open[j]);
    if(flags !== n || !todo.length){ if(todo.length) UL.shake(this.els[i]); return; }
    const boom = todo.find(j=>this.num[j] < 0);
    if(boom != null){ this.lose(boom); return; }
    let got = []; todo.forEach(j=>{ const g = this.openFrom(j); if(g) got = got.concat(g); });
    if(!got.length) return;
    this.after(got, i);
    if(got.length >= 3) UL.praise(this.els[i], 2);
    this.check();
  },
  toggleFlag(i){
    const s = this.st; if(s.open[i]) return;
    s.flag[i] ^= 1;
    if(s.flag[i]){ s.flagsPlaced++; if(s.mines && this.num[i] >= 0) s.wrongEver = true; }
    this.paint(i); UL.pop(this.els[i]); UL.buzz("tap"); this.hud(); UL.save();
  },
  check(){
    const s = this.st; if(s.opened < s.c*s.r - s.m) return;
    const sec = UL.cur.sec, lvl = this.lvl;
    s.mines.forEach(i=>{ s.flag[i] = 1; this.paint(i); });
    this.hud();
    UL.addScore(Math.max(0, 2*lvl.par - sec) * lvl.mult);
    const clean = !s.wrongEver && s.flagsPlaced >= Math.ceil(s.m/3);
    const fast = (lvl.id === "large" || lvl.id === "expert") && sec <= lvl.par;
    const mid = this.els[Math.floor(s.r/2)*s.c + Math.floor(s.c/2)];
    if(fast) UL.praise(mid, 4); else if(clean) UL.praise(mid, 3); else UL.milestone(mid, "Cleared!");
    UL.end({won:true, title:"Board cleared", line:"All "+s.m+" mines found"+(clean ? ", no wrong flags" : "")});
  },
  lose(i){
    const s = this.st; s.boom = i;
    s.mines.forEach(j=>{ if(!s.flag[j]){ const e = this.els[j]; e.className = "mn-cell mn-o"; e.innerHTML = MN_MINE; } });
    this.els[i].classList.add("mn-boom");
    s.flag.forEach((f,j)=>{ if(f && this.num[j] >= 0) this.els[j].innerHTML = MN_WRONG; });
    UL.buzz("err"); UL.shake(this.board);
    const pct = Math.round(100 * s.opened / (s.c*s.r - s.m));
    UL.end({won:false, title:"Mine hit", line:"Opened "+pct+"% of the safe squares"});
  },
  bind(){
    const b = this.board; let down = null, timer = null;
    const cellAt = e => { const t = e.target.closest(".mn-cell"); return t ? +t.dataset.i : -1; };
    b.addEventListener("contextmenu", e=>e.preventDefault());
    b.addEventListener("pointerdown", e=>{
      const i = cellAt(e); if(i < 0 || UL.paused()) return;
      down = {i, x:e.clientX, y:e.clientY, long:false};
      clearTimeout(timer);
      timer = setTimeout(()=>{ if(!down || this.st.open[down.i]) return; down.long = true; UL.buzz("act"); this.toggleFlag(down.i); }, 420);
    });
    b.addEventListener("pointermove", e=>{ if(down && Math.hypot(e.clientX-down.x, e.clientY-down.y) > 12){ clearTimeout(timer); down = null; } });
    b.addEventListener("pointerup", e=>{ clearTimeout(timer); const d = down; down = null; if(!d || d.long) return;
      if(cellAt(e) === d.i) this.tap(d.i); });
    b.addEventListener("pointercancel", ()=>{ clearTimeout(timer); down = null; });
    if(!this.bound){ this.bound = true;
      document.addEventListener("keydown", e=>{ if((e.key==="f"||e.key==="F") && this.st && document.activeElement.tagName !== "INPUT") this.setFlagMode(!this.st.flagMode); });
      window.addEventListener("resize", ()=>{ if(this.board && this.st) this.size(); }); }
  },
  onPro(){ if(this.ngBtn) this.hud(); }
};
