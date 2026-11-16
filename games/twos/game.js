/* ===================== AD FREE TWOS ===================== */
const GAME = {
  id: "twos",
  name: "Ad Free Twos",
  title: ["TW","OS"],
  icon: "🔢",
  version: "1.1",
  changelog: [["1.1","Brighter tiles with little faces and crowns, calmer sliding, a swipe hint on your first game, and tap near an edge to move."],["1.0","First release: Tiny, Classic, Wide and Grand boards, a Daily, undo."]],
  blurb: "Swipe to slide. Matching tiles merge and double.",
  timer: false,
  daily: "classic",
  levels: [
    {id:"tiny",    name:"Tiny 3×3",    note:"reach 128 · two minutes", n:3, target:128},
    {id:"classic", name:"Classic 4×4", note:"reach 2048",              n:4, target:2048},
    {id:"wide",    name:"Wide 5×5",    note:"reach 4096",  pro:1,      n:5, target:4096},
    {id:"grand",   name:"Grand 6×6",   note:"reach 8192",  pro:1,      n:6, target:8192}
  ],
  proPerks: ["Wide 5×5 and Grand 6×6 boards","Unlimited undo","Three extra themes","Score chart and level breakdown"],
  tutorial: [
    {icon:"👆", title:"Swipe to slide", body:"Swipe up, down, left or right, or tap near that edge of the board. Every tile slides as far as it can, then a new tile appears."},
    {icon:"🔢", title:"Match to merge", body:"Two tiles with the same number merge into one worth double. Merges are your score."},
    {icon:"🎯", title:"Reach the target", body:"Each board has a target tile — 2048 on Classic. Reach it to win, then keep going for a higher score."},
    {icon:"↩️", title:"Undo", body:"A bad swipe can be taken back. You get two undos a game; Pro makes them unlimited."}
  ],
  FREE_UNDOS: 2,
  st: null, els: new Map(), board: null, undoBtn: null,

  start({level, restore}){
    this.els = new Map();
    const st = this.st = restore ? this.thaw(restore) : {n:level.n, target:level.target, cells:new Array(level.n*level.n).fill(null), nextId:1,
      moves:0, best:0, reached:false, undosUsed:0, undo:[]};
    const stage = document.getElementById("stage");
    const b = this.board = document.createElement("div"); b.className = "tw-board"; b.style.setProperty("--n", st.n);
    for(let i=0;i<st.n*st.n;i++){ const s = document.createElement("div"); s.className = "tw-slot"; s.style.transform = this.xy(i); b.appendChild(s); }
    stage.appendChild(b);
    if(!restore){ this.spawn(); this.spawn(); }
    this.undoBtn = UL.ctrl({icon:"undo", label:"Undo", onTap:()=>this.undoMove()});
    this.bind(stage); this.render(); this.hud();
    if(!UL.kv("moved", false) && !st.moves){          // first ever game: show how to play until the first move
      const h = this.hint = document.createElement("div"); h.className = "tw-hint";
      h.innerHTML = '<b>Swipe!</b><svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 6v52M6 32h52M32 6l-8 8M32 6l8 8M32 58l-8-8M32 58l8-8M6 32l8-8M6 32l8 8M58 32l-8-8M58 32l-8 8"/></svg>Slide all the tiles,<br>or tap near an edge.';
      b.appendChild(h);
    }
  },
  xy(i){ const n = this.st.n, c = i%n, r = Math.floor(i/n); return "translate(calc("+c+" * (100% + var(--g))), calc("+r+" * (100% + var(--g))))"; },
  freeze(){ const s = this.st; return {n:s.n, target:s.target, cells:s.cells.map(t=>t?[t.id,t.v]:0), nextId:s.nextId, moves:s.moves, best:s.best,
    reached:s.reached, undosUsed:s.undosUsed, undo:s.undo.slice(-6)}; },
  thaw(o){ return {n:o.n, target:o.target, cells:o.cells.map(c=>c?{id:c[0],v:c[1]}:null), nextId:o.nextId, moves:o.moves, best:o.best,
    reached:o.reached, undosUsed:o.undosUsed, undo:o.undo||[]}; },
  serialize(){ return this.freeze(); },

  spawn(){
    const s = this.st, empty = []; s.cells.forEach((t,i)=>{ if(!t) empty.push(i); });
    if(!empty.length) return null;
    const i = UL.pick(empty), t = {id:s.nextId++, v: UL.random() < 0.9 ? 2 : 4, fresh:true};
    s.cells[i] = t; return t;
  },
  face(t){            // a bright little creature: its own colour per value, two eyes, the number, a crown from 2048 up
    const k = Math.min(12, Math.log2(t.v)), w = (this.board.clientWidth||340)/this.st.n, d = String(t.v).length;
    const f = document.createElement("div"); f.className = "tw-face k"+k; f.style.setProperty("--w", w.toFixed(1)+"px");
    const eyes = document.createElement("i"); eyes.className = "tw-eyes"; const num = document.createElement("span"); num.textContent = t.v;
    f.append(eyes, num);
    f.style.fontSize = Math.round(w*(d<=2?0.36:d===3?0.30:d===4?0.23:0.19))+"px";
    return f;
  },
  render(ghosts){
    const s = this.st, live = new Set();
    s.cells.forEach((t,i)=>{
      if(!t) return; live.add(t.id);
      let el = this.els.get(t.id);
      if(!el){ el = document.createElement("div"); el.className = "tw-tile"; el.style.transform = this.xy(i); el.appendChild(this.face(t)); el.dataset.v = t.v;
        this.board.appendChild(el); this.els.set(t.id, el); if(t.fresh){ el.firstChild.classList.add("tw-new"); t.fresh = false; } }
      else { el.style.transform = this.xy(i);
        if(+el.dataset.v !== t.v){ el.dataset.v = t.v; const f = this.face(t); f.classList.add("happy"); el.replaceChild(f, el.firstChild); setTimeout(()=>UL.pop(f), 150); setTimeout(()=>f.classList.remove("happy"), 500); } }
    });
    (ghosts||[]).forEach(g=>{ const el = this.els.get(g.id); if(!el) return; el.classList.add("ghost"); el.style.transform = this.xy(g.to); this.els.delete(g.id); setTimeout(()=>el.remove(), 190); });
    for(const [id, el] of this.els){ if(!live.has(id)){ el.remove(); this.els.delete(id); } }
  },
  hud(){
    const s = this.st; UL.setStat("Best tile <b>"+(s.best||"—")+"</b>");
    const left = UL.isPro() ? "∞" : Math.max(0, this.FREE_UNDOS - s.undosUsed);
    this.undoBtn.setLabel("Undo "+left); this.undoBtn.classList.toggle("dim", !s.undo.length || left===0);
  },
  lines(dir){            // each line listed from the edge tiles slide toward
    const n = this.st.n, out = [];
    for(let a=0;a<n;a++){ const line = [];
      for(let b=0;b<n;b++){ const k = (dir==="left"||dir==="up") ? b : n-1-b; line.push((dir==="left"||dir==="right") ? a*n+k : k*n+a); }
      out.push(line); }
    return out;
  },
  canMove(){
    const s = this.st, n = s.n;
    for(let i=0;i<n*n;i++){ const t = s.cells[i]; if(!t) return true;
      if(i%n < n-1 && s.cells[i+1] && s.cells[i+1].v===t.v) return true;
      if(i+n < n*n && s.cells[i+n] && s.cells[i+n].v===t.v) return true; }
    return false;
  },
  move(dir){
    if(UL.paused()) return;
    const s = this.st, before = {cells:s.cells.map(t=>t?[t.id,t.v]:0), nextId:s.nextId, score:UL.cur.score, rng:UL.rng.s, moves:s.moves, best:s.best, reached:s.reached};
    const next = new Array(s.n*s.n).fill(null), ghosts = [], merged = []; let moved = false, gained = 0;
    for(const line of this.lines(dir)){
      let w = 0, last = null;
      for(const idx of line){ const t = s.cells[idx]; if(!t) continue;
        if(last && last.v===t.v && !last.justMerged){ last.v *= 2; last.justMerged = true; gained += last.v; merged.push(last); ghosts.push({id:t.id, to:line[w-1]}); moved = true; }
        else { next[line[w]] = t; if(line[w] !== idx) moved = true; last = t; w++; } }
    }
    if(!moved){ UL.shake(this.board); return; }
    if(this.hint){ this.hint.remove(); this.hint = null; UL.setKv("moved", true); }
    merged.forEach(t=>{ delete t.justMerged; });
    s.cells = next; s.moves++;
    s.undo.push(before); if(s.undo.length > 30) s.undo.shift();
    this.spawn(); UL.addScore(gained); this.render(ghosts);
    UL.buzz(merged.length ? "act" : "tap");
    const top = merged.reduce((m,t)=>Math.max(m,t.v), 0);
    if(top > s.best){
      s.best = top; const el = this.els.get(merged.find(t=>t.v===top).id);
      if(top >= s.target && !s.reached){ s.reached = true; UL.milestone(el, top+"!"); UL.confetti(); UL.toast("Target reached. Keep going for a higher score."); }
      else if(top >= 64) UL.praise(el, top >= 1024 ? 4 : top >= 256 ? 3 : 2);
    } else if(merged.length >= 2) UL.praise(this.els.get(merged[0].id), merged.length >= 4 ? 3 : merged.length === 3 ? 2 : 1);
    this.hud(); UL.save();
    if(!this.canMove()) setTimeout(()=>UL.end({won:s.reached, title:s.reached ? "You made "+s.target : "No moves left", line:"Best tile "+s.best+" in "+s.moves+" moves"}), 350);
  },
  undoMove(){
    const s = this.st; if(!s.undo.length) return;
    if(!UL.isPro() && s.undosUsed >= this.FREE_UNDOS){ UL.requirePro("Free games include "+this.FREE_UNDOS+" undos. Pro is unlimited."); return; }
    const u = s.undo.pop(); s.undosUsed++;
    s.cells = u.cells.map(c=>c?{id:c[0],v:c[1]}:null); s.nextId = u.nextId; s.moves = u.moves; s.best = u.best; s.reached = u.reached;
    UL.rng.s = u.rng; UL.setScore(u.score);
    for(const [,el] of this.els) el.remove(); this.els = new Map();
    this.render(); this.hud(); UL.save();
  },
  bind(stage){
    if(this.bound) return; this.bound = true;
    let sx = 0, sy = 0, down = false;
    stage.addEventListener("pointerdown", e=>{ down = true; sx = e.clientX; sy = e.clientY; });
    window.addEventListener("pointerup", e=>{ if(!down) return; down = false;
      const dx = e.clientX-sx, dy = e.clientY-sy;
      if(Math.max(Math.abs(dx),Math.abs(dy)) < 22){          // a tap: move toward the nearest edge
        const r = this.board.getBoundingClientRect(), ox = (e.clientX - r.left)/r.width - .5, oy = (e.clientY - r.top)/r.height - .5;
        if(Math.max(Math.abs(ox),Math.abs(oy)) < .18 || Math.max(Math.abs(ox),Math.abs(oy)) > .5) return;   // centre or outside: ignore
        return this.move(Math.abs(ox) > Math.abs(oy) ? (ox > 0 ? "right" : "left") : (oy > 0 ? "down" : "up"));
      }
      this.move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up")); });
    document.addEventListener("keydown", e=>{
      const m = {ArrowLeft:"left",ArrowRight:"right",ArrowUp:"up",ArrowDown:"down",a:"left",d:"right",w:"up",s:"down"}[e.key];
      if(m && document.activeElement.tagName !== "INPUT"){ e.preventDefault(); this.move(m); } });
    window.addEventListener("resize", ()=>{ if(!this.st) return; for(const [,el] of this.els) el.remove(); this.els = new Map(); this.render(); });
  },
  onPro(){ if(this.undoBtn) this.hud(); }
};
