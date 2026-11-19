/* ===================== AD FREE TWOS ===================== */
/* The box is always full. Drag a tile onto a matching neighbour: they merge into one worth double.
   The tiles above fall into the gap and a new tile drops in at the top. No pairs left ends the game. */
const GAME = {
  id: "twos",
  name: "Ad Free Twos",
  title: ["TW","OS"],
  icon: "🔢",
  version: "2.0",
  changelog: [["2.0","A new way to play: the box is always full, and you drag a number onto its twin to merge them. Tiles fall and new ones drop in, so every move is your choice."],
    ["1.1","Brighter tiles with little faces and crowns, calmer sliding, a swipe hint on your first game, and tap near an edge to move."],["1.0","First release: Tiny, Classic, Wide and Grand boards, a Daily, undo."]],
  blurb: "Drag a number onto its twin. They merge and double.",
  timer: false,
  daily: "classic",
  levels: [
    {id:"tiny",    name:"Tiny 3×3",    note:"reach 64",                n:3, target:64},
    {id:"classic", name:"Classic 4×4", note:"reach 256",               n:4, target:256},
    {id:"wide",    name:"Wide 5×5",    note:"reach 512",   pro:1,      n:5, target:512},
    {id:"grand",   name:"Grand 6×6",   note:"reach 1024",  pro:1,      n:6, target:1024}
  ],
  proPerks: ["Wide 5×5 and Grand 6×6 boards","Unlimited undo","Three extra themes","Score chart and level breakdown"],
  tutorial: [
    {icon:"👆", title:"Drag onto a twin", body:"Drag a number onto the same number right next to it (up, down, left or right). They merge into one worth double. You can also tap one, then tap its twin."},
    {icon:"⬇️", title:"Tiles drop in", body:"The tiles above fall into the gap and a new tile drops in at the top. Where you merge decides what falls next to what."},
    {icon:"🎯", title:"Keep a pair alive", body:"The game ends when no two neighbours match. Reach the target tile (256 on Classic), then keep going for a higher score."},
    {icon:"↩️", title:"Undo", body:"A merge can be taken back. You get two undos a game; Pro makes them unlimited."}
  ],
  FREE_UNDOS: 2,
  st: null, els: new Map(), board: null, undoBtn: null, sel: -1, drag: null,

  /* ---------- pure logic (also used by the tests) ---------- */
  newTile(){ const r = UL.random(); return r < 0.55 ? 2 : r < 0.85 ? 4 : 8; },
  pairs(cells, n){ const out = []; for(let i=0;i<n*n;i++){ const v = cells[i].v;
    if(i%n < n-1 && cells[i+1].v===v) out.push([i,i+1]); if(i+n < n*n && cells[i+n].v===v) out.push([i,i+n]); } return out; },
  adjacent(a, b, n){ return (Math.abs(a-b)===1 && Math.floor(a/n)===Math.floor(b/n)) || Math.abs(a-b)===n; },
  /* merge tile a into its matching neighbour b; the gap at a fills from above and a new tile drops in */
  merge(s, a, b){
    const n = s.n, c = s.cells;
    if(a===b || !this.adjacent(a, b, n) || c[a].v !== c[b].v) return null;
    const made = c[b].v*2; c[b] = {id:c[b].id, v:made};
    const col = a % n; let r = Math.floor(a/n);
    for(; r>0; r--) c[r*n+col] = c[(r-1)*n+col];
    c[col] = {id:s.nextId++, v:this.newTile(), fresh:true};
    s.moves++;
    return {made};
  },
  deal(s){                    // a full starting box with a few pairs in it
    for(let t=0;t<40;t++){ s.cells = []; for(let i=0;i<s.n*s.n;i++) s.cells.push({id:s.nextId++, v:this.newTile()});
      if(this.pairs(s.cells, s.n).length >= Math.max(2, s.n)) return; }
  },

  /* ---------- game ---------- */
  start({level, restore}){
    this.els = new Map(); this.sel = -1; this.drag = null;
    const st = this.st = restore ? JSON.parse(JSON.stringify(restore)) : {v:2, n:level.n, target:level.target, cells:[], nextId:1, moves:0, best:0, reached:false, undosUsed:0, undo:[]};
    if(!restore || st.v !== 2){ Object.assign(st, {v:2, n:level.n, target:level.target, cells:[], nextId:1, moves:0, best:0, reached:false, undosUsed:0, undo:[]}); this.deal(st);
      st.best = Math.max(...st.cells.map(t=>t.v)); }
    const stage = document.getElementById("stage");
    const b = this.board = document.createElement("div"); b.className = "tw-board"; b.style.setProperty("--n", st.n);
    for(let i=0;i<st.n*st.n;i++){ const s = document.createElement("div"); s.className = "tw-slot"; s.style.transform = this.xy(i); b.appendChild(s); }
    stage.appendChild(b);
    this.undoBtn = UL.ctrl({icon:"undo", label:"Undo", onTap:()=>this.undoMove()});
    this.bind(); this.render(); this.hud();
    if(!UL.kv("merged", false) && !st.moves){
      const h = this.hint = document.createElement("div"); h.className = "tw-hint";
      h.innerHTML = '<b>Drag a twin</b><svg viewBox="0 0 64 64" aria-hidden="true"><path d="M10 32h40M50 32l-10-10M50 32l-10 10"/></svg>Drag a number onto the<br>same number next to it.';
      b.appendChild(h);
    }
  },
  serialize(){ const s = this.st; return {v:2, n:s.n, target:s.target, cells:s.cells.map(t=>({id:t.id, v:t.v})), nextId:s.nextId, moves:s.moves, best:s.best, reached:s.reached, undosUsed:s.undosUsed, undo:s.undo.slice(-20)}; },
  xy(i){ const n = this.st.n, c = i%n, r = Math.floor(i/n); return "translate(calc("+c+" * (100% + var(--g))), calc("+r+" * (100% + var(--g))))"; },
  face(t){            // a bright little creature: its own colour per value, two eyes, the number, a crown from 2048 up
    const k = Math.min(12, Math.log2(t.v)), w = (this.board.clientWidth||340)/this.st.n, d = String(t.v).length;
    const f = document.createElement("div"); f.className = "tw-face k"+k; f.style.setProperty("--w", w.toFixed(1)+"px");
    const eyes = document.createElement("i"); eyes.className = "tw-eyes"; const num = document.createElement("span"); num.textContent = t.v;
    f.append(eyes, num);
    f.style.fontSize = Math.round(w*(d<=2?0.36:d===3?0.30:d===4?0.23:0.19))+"px";
    return f;
  },
  render(){
    const s = this.st, live = new Set();
    s.cells.forEach((t, i)=>{
      live.add(t.id); let el = this.els.get(t.id);
      if(!el){ el = document.createElement("div"); el.className = "tw-tile"; el.dataset.v = t.v; el.appendChild(this.face(t)); this.board.appendChild(el); this.els.set(t.id, el);
        if(t.fresh){ el.style.transition = "none"; el.style.transform = this.xy(i)+" translateY(-110%)"; el.style.opacity = "0"; void el.offsetWidth; el.style.transition = ""; el.style.opacity = ""; delete t.fresh; } }
      el.style.transform = this.xy(i); el.dataset.i = i;
      if(+el.dataset.v !== t.v){ el.dataset.v = t.v; const f = this.face(t); f.classList.add("happy"); el.replaceChild(f, el.firstChild); setTimeout(()=>UL.pop(f), 120); setTimeout(()=>f.classList.remove("happy"), 500); }
      el.classList.toggle("sel", i===this.sel);
      el.classList.toggle("twin", this.sel>=0 && i!==this.sel && this.adjacent(i, this.sel, s.n) && s.cells[i].v===s.cells[this.sel].v);
    });
    for(const [id, el] of this.els){ if(!live.has(id)){ el.classList.add("gone"); this.els.delete(id); setTimeout(()=>el.remove(), 200); } }
  },
  hud(){
    const s = this.st; UL.setStat("Best tile <b>"+(s.best||"—")+"</b> · "+this.pairs(s.cells, s.n).length+" pairs");
    const left = UL.isPro() ? "∞" : Math.max(0, this.FREE_UNDOS - s.undosUsed);
    this.undoBtn.setLabel("Undo "+left); this.undoBtn.classList.toggle("dim", !s.undo.length || left===0);
  },
  /* a player's merge: a onto b */
  play(a, b){
    if(UL.paused()) return false;
    const s = this.st;
    const before = {cells:s.cells.map(t=>({id:t.id, v:t.v})), nextId:s.nextId, score:UL.cur.score, rng:UL.rng.s, moves:s.moves, best:s.best, reached:s.reached};
    const target = s.cells[b] && s.cells[b].id, res = this.merge(s, a, b);
    if(!res){ if(this.els.get(s.cells[a].id)) UL.shake(this.els.get(s.cells[a].id)); UL.buzz("err"); return false; }
    s.undo.push(before); if(s.undo.length > 30) s.undo.shift();
    if(this.hint){ this.hint.remove(); this.hint = null; UL.setKv("merged", true); }
    this.sel = -1; UL.addScore(res.made);
    const srcEl = this.els.get(before.cells[a].id), tgtEl = this.els.get(target);
    if(srcEl){ srcEl.style.transform = this.xy(b); srcEl.style.zIndex = 1; }     // the dragged tile slides into its twin, then disappears
    this.render(); UL.buzz("act");
    const at = s.cells.findIndex(t=>t.id===target), el = this.els.get(target);
    if(res.made > s.best){
      s.best = res.made;
      if(res.made >= s.target && !s.reached){ s.reached = true; UL.milestone(el, res.made+"!"); UL.confetti(); UL.toast("Target reached. Keep going for a higher score."); }
      else if(res.made >= 64) UL.praise(el, res.made >= 1024 ? 4 : res.made >= 256 ? 3 : 2);
    } else {
      const n = s.n, near = [at-n, at+n, (at%n) ? at-1 : -1, (at%n < n-1) ? at+1 : -1].filter(j=>j>=0 && j<n*n);
      if(near.some(j=>s.cells[j].v===res.made)) UL.praise(el, 1);   // the new tile already has a twin waiting: a set-up
    }
    this.hud(); UL.save();
    if(!this.pairs(s.cells, s.n).length) setTimeout(()=>UL.end({won:s.reached, title:s.reached ? "You made "+s.target : "No pairs left", line:"Best tile "+s.best+" in "+s.moves+" merges"}), 450);
    return true;
  },
  undoMove(){
    if(UL.paused()) return;
    const s = this.st; if(!s.undo.length) return;
    if(!UL.isPro() && s.undosUsed >= this.FREE_UNDOS){ UL.requirePro("Free games include "+this.FREE_UNDOS+" undos. Pro is unlimited."); return; }
    const u = s.undo.pop(); s.undosUsed++;
    s.cells = u.cells; s.nextId = u.nextId; s.moves = u.moves; s.best = u.best; s.reached = u.reached; UL.rng.s = u.rng; UL.setScore(u.score);
    for(const [,el] of this.els) el.remove(); this.els = new Map(); this.sel = -1;
    this.render(); this.hud(); UL.save();
  },
  cellAt(x, y){ const r = this.board.getBoundingClientRect(), n = this.st.n, c = Math.floor((x - r.left)/r.width*n), w = Math.floor((y - r.top)/r.height*n);
    return (c<0||w<0||c>=n||w>=n) ? -1 : w*n + c; },
  bind(){
    const b = this.board;
    b.addEventListener("pointerdown", e=>{
      if(UL.paused()) return; const i = this.cellAt(e.clientX, e.clientY); if(i < 0) return;
      e.preventDefault(); try{ b.setPointerCapture(e.pointerId); }catch(err){}
      this.drag = {i, id:e.pointerId, x0:e.clientX, y0:e.clientY, moved:false};
    });
    b.addEventListener("pointermove", e=>{ const d = this.drag; if(!d || d.id !== e.pointerId) return;
      const dx = e.clientX - d.x0, dy = e.clientY - d.y0; if(!d.moved && Math.hypot(dx, dy) < 10) return;
      if(!d.moved){ d.moved = true; this.sel = d.i; this.render(); d.el = this.els.get(this.st.cells[d.i].id); if(d.el) d.el.classList.add("lift"); }
      const cs = this.board.getBoundingClientRect().width / this.st.n, lim = cs*1.05;
      if(d.el) d.el.style.transform = this.xy(d.i)+" translate("+Math.max(-lim, Math.min(lim, dx))+"px,"+Math.max(-lim, Math.min(lim, dy))+"px)"; });
    const up = e=>{ const d = this.drag; if(!d || d.id !== e.pointerId) return; this.drag = null;
      if(d.el) d.el.classList.remove("lift");
      if(!d.moved){                                   // a tap: pick a tile, then tap its twin
        if(this.sel >= 0 && this.sel !== d.i && this.adjacent(this.sel, d.i, this.st.n) && this.st.cells[this.sel].v === this.st.cells[d.i].v){ this.play(this.sel, d.i); return; }
        this.sel = this.sel === d.i ? -1 : d.i; UL.buzz("tap"); this.render(); return; }
      const t = this.cellAt(e.clientX, e.clientY);
      if(t >= 0 && t !== d.i && this.adjacent(d.i, t, this.st.n) && this.st.cells[t].v === this.st.cells[d.i].v){ this.play(d.i, t); return; }
      if(t !== d.i && t >= 0) { UL.buzz("err"); }
      this.sel = -1; this.render(); };
    b.addEventListener("pointerup", up); b.addEventListener("pointercancel", e=>{ if(this.drag){ this.drag = null; this.sel = -1; this.render(); } });
    if(this.bound) return; this.bound = true;
    window.addEventListener("resize", ()=>{ if(!this.st || !this.board) return; for(const [,el] of this.els) el.remove(); this.els = new Map(); this.render(); });
  },
  onPro(){ if(this.undoBtn) this.hud(); }
};
