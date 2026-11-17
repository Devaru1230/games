/* ===================== AD FREE BLOCKS ===================== */
/* A placement puzzle: drag shapes from the tray onto the board; full rows and columns clear. */
const BK_FAM = ["single","line","square","corner","bend"];
const BK_SHAPES = (()=>{          // every shape in its fixed orientation, with a weight for the bag and a family for its shade
  const norm = cs => { const mx = Math.min(...cs.map(c=>c[0])), my = Math.min(...cs.map(c=>c[1]));
    return cs.map(c=>[c[0]-mx, c[1]-my]).sort((a,b)=>a[1]-b[1] || a[0]-b[0]); };
  const key = cs => norm(cs).map(c=>c.join(",")).join(";");
  const rots = cs => { const out = [], seen = new Set(); let cur = cs;
    for(let r=0;r<4;r++){ const k = key(cur); if(!seen.has(k)){ seen.add(k); out.push(norm(cur)); } cur = cur.map(([x,y])=>[-y, x]); } return out; };
  const base = [
    ["single",0,[[0,0]],4], ["domino",1,[[0,0],[1,0]],3], ["line3",1,[[0,0],[1,0],[2,0]],3], ["line4",1,[[0,0],[1,0],[2,0],[3,0]],2.5],
    ["line5",1,[[0,0],[1,0],[2,0],[3,0],[4,0]],1.5], ["sq2",2,[[0,0],[1,0],[0,1],[1,1]],5], ["sq3",2,[[0,0],[1,0],[2,0],[0,1],[1,1],[2,1],[0,2],[1,2],[2,2]],1.6],
    ["l3",3,[[0,0],[0,1],[1,1]],1.5], ["l5",3,[[0,0],[0,1],[0,2],[1,2],[2,2]],0.8],
    ["t4",4,[[0,0],[1,0],[2,0],[1,1]],1], ["s4",4,[[1,0],[2,0],[0,1],[1,1]],1], ["z4",4,[[0,0],[1,0],[1,1],[2,1]],1]
  ];
  const out = [];
  for(const [name, fam, cells, w] of base){ const rs = rots(cells); rs.forEach(c=>out.push({key:key(c), name, fam, cells:c, w:w/rs.length*2})); }
  return out;
})();
const BK_BYKEY = Object.fromEntries(BK_SHAPES.map(s=>[s.key, s]));

const GAME = {
  id: "blocks",
  name: "Ad Free Blocks",
  title: ["BLO","CKS"],
  icon: "🟨",
  version: "1.0",
  changelog: [["1.0","First release: Classic, Quick, Big and Master boards, a Daily, line streaks."]],
  blurb: "Drag shapes onto the board. Fill a row or column to clear it.",
  timer: false,
  daily: "classic",
  levels: [
    {id:"classic", name:"Classic 8×8", note:"play until nothing fits",       n:8},
    {id:"quick",   name:"Quick 6×6",   note:"30 shapes, highest score",     n:6, limit:30},
    {id:"big",     name:"Big 10×10",   note:"more room to plan",     pro:1, n:10},
    {id:"master",  name:"Master 8×8",  note:"hold a shape, tap to rotate", pro:1, n:8, master:1}
  ],
  proPerks: ["Big 10×10 board","Master mode with hold and rotate","Three extra themes","Score chart and level breakdown"],
  tutorial: [
    {icon:"👆", title:"Drag a shape", body:"Three shapes wait under the board. Drag one onto the board. A shadow shows where it will land."},
    {icon:"➖", title:"Fill a line to clear it", body:"A full row or column clears. Clearing several at once, or one after another, scores much more."},
    {icon:"🏁", title:"Until nothing fits", body:"When all three shapes are placed, three more arrive. The game ends when none of the waiting shapes fits."}
  ],
  st: null, lvl: null, cells: [], board: null, tray: null, drag: null,

  /* ---------- pure logic (also used by the tests) ---------- */
  fits(b, n, sh, x, y){ for(const [dx,dy] of sh.cells){ const X = x+dx, Y = y+dy; if(X<0||Y<0||X>=n||Y>=n||b[Y*n+X]) return false; } return true; },
  fitsAnywhere(b, n, sh){ for(let y=0;y<n;y++) for(let x=0;x<n;x++) if(this.fits(b,n,sh,x,y)) return true; return false; },
  rotate(sh){ const c = sh.cells.map(([x,y])=>[-y, x]), mx = Math.min(...c.map(p=>p[0])), my = Math.min(...c.map(p=>p[1]));
    const k = c.map(p=>[p[0]-mx, p[1]-my]).sort((a,b)=>a[1]-b[1]||a[0]-b[0]).map(p=>p.join(",")).join(";"); return BK_BYKEY[k]; },
  /* every orientation a player may use for this shape (Master can rotate) */
  forms(sh, master){ if(!master) return [sh]; const out = [sh]; let c = sh; for(let i=0;i<3;i++){ c = this.rotate(c); if(!out.includes(c)) out.push(c); } return out; },
  canPlay(st){
    const m = !!st.master, list = st.tray.filter(Boolean).map(k=>BK_BYKEY[k]).concat(m && st.hold ? [BK_BYKEY[st.hold]] : []);
    return list.some(sh=>this.forms(sh, m).some(f=>this.fitsAnywhere(st.board, st.n, f)));
  },
  /* place a shape; returns what happened. Full rows and columns clear together. */
  place(st, key, x, y){
    const sh = BK_BYKEY[key], n = st.n, b = st.board;
    if(!this.fits(b, n, sh, x, y)) return null;
    const placed = sh.cells.map(([dx,dy])=>(y+dy)*n + x+dx); placed.forEach(i=>b[i] = sh.fam+1);
    const rows = [], cols = [];
    for(let r=0;r<n;r++){ let f = true; for(let c=0;c<n;c++) if(!b[r*n+c]){ f = false; break; } if(f) rows.push(r); }
    for(let c=0;c<n;c++){ let f = true; for(let r=0;r<n;r++) if(!b[r*n+c]){ f = false; break; } if(f) cols.push(c); }
    const cleared = new Set(); rows.forEach(r=>{ for(let c=0;c<n;c++) cleared.add(r*n+c); }); cols.forEach(c=>{ for(let r=0;r<n;r++) cleared.add(r*n+c); });
    const lines = rows.length + cols.length;
    cleared.forEach(i=>b[i] = 0);
    st.streak = lines ? st.streak + 1 : 0;
    const points = sh.cells.length + 10*lines*lines + (lines ? st.streak*5 : 0);   // 10 a line, times the number of lines; streak x 5
    st.placed++; st.lines += lines;
    return {placed, rows, cols, lines, cleared:[...cleared], points, empty: b.every(v=>!v), streak: st.streak};
  },
  /* the bag: weighted, seeded; never deal three shapes that all fail when a shape that fits exists */
  /* the small Quick board leaves out the three largest shapes, so a sensible player can usually place all 30 */
  bag(n){ return n <= 6 ? BK_SHAPES.filter(s=>!["sq3","line5","l5"].includes(s.name)) : BK_SHAPES; },
  drawShape(n){ const bag = this.bag(n||8), tot = bag.reduce((a,s)=>a+s.w, 0); let r = UL.random()*tot; for(const s of bag){ r -= s.w; if(r <= 0) return s; } return bag[0]; },
  deal(st){
    let best = null;
    for(let t=0;t<12;t++){ const three = [this.drawShape(st.n), this.drawShape(st.n), this.drawShape(st.n)];
      if(three.some(sh=>this.forms(sh, st.master).some(f=>this.fitsAnywhere(st.board, st.n, f)))){ best = three; break; }
      if(!best) best = three; }
    if(!best.some(sh=>this.fitsAnywhere(st.board, st.n, sh))){           // still nothing: offer a shape that does fit, if any exists
      const ok = this.bag(st.n).filter(sh=>this.fitsAnywhere(st.board, st.n, sh)); if(ok.length) best[0] = ok[UL.rnd(ok.length)]; }
    st.tray = best.map(s=>s.key);
  },

  /* ---------- game ---------- */
  start({level, restore}){
    this.lvl = level; this.drag = null; this.ending = false;
    const st = this.st = restore ? JSON.parse(JSON.stringify(restore))
      : {n:level.n, board:new Array(level.n*level.n).fill(0), tray:[], hold:null, held:false, placed:0, lines:0, streak:0, master:!!level.master, limit:level.limit||0};
    if(!restore) this.deal(st);
    const stage = document.getElementById("stage"), wrap = document.createElement("div"); wrap.className = "bk-wrap";
    const b = this.board = document.createElement("div"); b.className = "bk-board"; b.style.setProperty("--n", st.n);
    this.cells = [];
    for(let i=0;i<st.n*st.n;i++){ const c = document.createElement("div"); c.className = "bk-cell"; b.appendChild(c); this.cells.push(c); }
    wrap.appendChild(b); stage.appendChild(wrap);
    const below = document.getElementById("below"), tray = this.tray = document.createElement("div"); tray.className = "bk-tray"+(st.master ? " master" : "");
    below.appendChild(tray);
    this.paintBoard(); this.paintTray(); this.hud(); this.bind();
  },
  serialize(){ return JSON.parse(JSON.stringify(this.st)); },
  best(){ return UL.kv("best_"+this.lvl.id, 0); },
  hud(){ const s = this.st;
    UL.setStat((s.limit ? "Shape <b>"+Math.min(s.placed+1, s.limit)+"/"+s.limit+"</b> · " : "")+"Best <b>"+this.best()+"</b>"+(s.streak >= 2 ? " · streak <b>"+s.streak+"</b>" : "")); },
  paintBoard(){ const s = this.st; this.cells.forEach((c, i)=>{ const v = s.board[i]; c.className = "bk-cell"+(v ? " on f"+(v-1) : ""); }); },
  piece(key, mini){
    const sh = BK_BYKEY[key], w = Math.max(...sh.cells.map(c=>c[0]))+1, h = Math.max(...sh.cells.map(c=>c[1]))+1;
    const el = document.createElement("div"); el.className = "bk-piece f"+sh.fam; el.style.setProperty("--w", w); el.style.setProperty("--h", h);
    sh.cells.forEach(([x,y])=>{ const c = document.createElement("i"); c.style.gridColumn = (x+1); c.style.gridRow = (y+1); el.appendChild(c); });
    el.dataset.key = key; return el;
  },
  paintTray(){
    const s = this.st, t = this.tray; t.innerHTML = "";
    const slots = s.tray.map((k, i)=>({k, i})); if(s.master) slots.push({k:s.hold, i:"hold"});
    for(const {k, i} of slots){
      const slot = document.createElement("div"); slot.className = "bk-slot"+(i==="hold" ? " hold" : ""); slot.dataset.slot = i;
      if(i==="hold"){ const lab = document.createElement("small"); lab.textContent = "Hold"; slot.appendChild(lab); }
      if(k){ const p = this.piece(k); slot.appendChild(p);
        if(!this.forms(BK_BYKEY[k], s.master).some(f=>this.fitsAnywhere(s.board, s.n, f))) slot.classList.add("nofit"); }
      t.appendChild(slot);
    }
  },
  cellSize(){ return this.board.getBoundingClientRect().width / this.st.n; },

  /* ---------- dragging ---------- */
  bind(){
    this.tray.addEventListener("pointerdown", e=>{
      if(UL.paused() || this.ending) return; const slot = e.target.closest(".bk-slot"); if(!slot) return;
      const which = slot.dataset.slot, key = which==="hold" ? this.st.hold : this.st.tray[+which]; if(!key) return;
      e.preventDefault(); slot.setPointerCapture(e.pointerId);
      this.drag = {which, key, slot, id:e.pointerId, x0:e.clientX, y0:e.clientY, moved:false, el:null, at:null};
    });
    this.tray.addEventListener("pointermove", e=>{ const d = this.drag; if(!d || e.pointerId !== d.id) return;
      if(!d.moved && Math.hypot(e.clientX-d.x0, e.clientY-d.y0) < 8) return;
      if(!d.moved){ d.moved = true; this.lift(d); }
      this.follow(d, e.clientX, e.clientY); });
    const up = e=>{ const d = this.drag; if(!d || e.pointerId !== d.id) return; this.drag = null;
      if(!d.moved){ if(this.st.master && d.which !== "hold") this.rotateSlot(+d.which); return; }
      this.drop(d); };
    this.tray.addEventListener("pointerup", up); this.tray.addEventListener("pointercancel", e=>{ const d = this.drag; if(d){ this.drag = null; this.cancel(d); } });
    if(!this.bound){ this.bound = true; window.addEventListener("resize", ()=>{ if(this.drag) this.cancel(this.drag); }); }
  },
  lift(d){
    const cs = this.cellSize(), el = this.piece(d.key); el.classList.add("bk-float"); el.style.setProperty("--cs", cs+"px");
    document.body.appendChild(el); d.el = el; d.slot.classList.add("lifted"); UL.buzz("tap");
  },
  follow(d, x, y){
    const sh = BK_BYKEY[d.key], cs = this.cellSize(), w = (Math.max(...sh.cells.map(c=>c[0]))+1)*cs, h = (Math.max(...sh.cells.map(c=>c[1]))+1)*cs;
    const left = x - w/2, top = y - h - cs*0.9;                   // the shape floats above the finger so the finger never covers it
    d.el.style.transform = "translate("+left+"px,"+top+"px)";
    const r = this.board.getBoundingClientRect(), gx = Math.round((left - r.left)/cs), gy = Math.round((top - r.top)/cs);
    const ok = this.fits(this.st.board, this.st.n, sh, gx, gy), overHold = this.overHold(x, y);
    d.at = ok ? [gx, gy] : null; d.hold = overHold;
    this.ghost(ok ? sh : null, gx, gy);
  },
  overHold(x, y){ if(!this.st.master) return false; const h = this.tray.querySelector(".bk-slot.hold"); if(!h) return false; const r = h.getBoundingClientRect(); return x>=r.left && x<=r.right && y>=r.top && y<=r.bottom; },
  ghost(sh, gx, gy){
    this.cells.forEach(c=>c.classList.remove("ghost","clearing"));
    if(!sh) return;
    const s = this.st, n = s.n, b = s.board.slice(); sh.cells.forEach(([dx,dy])=>{ const i = (gy+dy)*n + gx+dx; this.cells[i].classList.add("ghost"); b[i] = 9; });
    for(let r=0;r<n;r++){ let f = true; for(let c=0;c<n;c++) if(!b[r*n+c]){ f = false; break; } if(f) for(let c=0;c<n;c++) this.cells[r*n+c].classList.add("clearing"); }
    for(let c=0;c<n;c++){ let f = true; for(let r=0;r<n;r++) if(!b[r*n+c]){ f = false; break; } if(f) for(let r=0;r<n;r++) this.cells[r*n+c].classList.add("clearing"); }
  },
  cancel(d){ if(d.el) d.el.remove(); d.slot.classList.remove("lifted"); this.ghost(null); },
  drop(d){
    const s = this.st; this.cancel(d);
    if(d.hold && d.which !== "hold"){ this.toHold(+d.which); return; }
    if(!d.at){ UL.shake(d.slot); UL.buzz("err"); return; }
    this.play(d.which, d.at[0], d.at[1]);
  },
  rotateSlot(i){ const s = this.st, k = s.tray[i]; if(!k) return; s.tray[i] = this.rotate(BK_BYKEY[k]).key; UL.buzz("tap"); this.paintTray(); UL.pop(this.tray.querySelector('[data-slot="'+i+'"] .bk-piece')); UL.save(); },
  toHold(i){ const s = this.st; const k = s.tray[i]; s.tray[i] = s.hold; s.hold = k; UL.buzz("tap");
    if(s.tray.every(x=>!x)) this.deal(s);
    this.paintTray(); UL.save(); this.checkEnd(); },
  /* play the shape in tray slot `which` (or the held shape) with its top-left cell at x, y */
  play(which, x, y){
    if(UL.paused() || this.ending) return false;
    const s = this.st, key = which==="hold" ? s.hold : s.tray[+which]; if(!key) return false;
    const res = this.place(s, key, x, y); if(!res) return false;
    if(which==="hold") s.hold = null; else s.tray[+which] = null;
    UL.addScore(res.points);
    this.paintBoard();
    res.placed.forEach(i=>{ if(!res.cleared.includes(i)) UL.pop(this.cells[i]); });
    UL.buzz(res.lines ? "act" : "tap");
    if(res.lines){
      const order = res.cleared.slice().sort((a,b)=>a-b).map(i=>this.cells[i]); order.forEach(c=>c.classList.add("bk-gone"));
      setTimeout(()=>order.forEach(c=>c.classList.remove("bk-gone")), 260);
      UL.sweep(order, Math.min(18, 240/order.length));
      const mid = this.cells[res.cleared[Math.floor(res.cleared.length/2)]];
      const tier = (res.streak >= 5 || res.lines >= 4 || res.empty) ? 4 : res.lines >= 3 ? 3 : res.lines === 2 ? 2 : 1;
      UL.praise(mid, tier);
    }
    if(s.tray.every(k=>!k)) this.deal(s);
    this.paintTray(); this.hud(); UL.save();
    this.checkEnd();
    return true;
  },
  checkEnd(){
    const s = this.st;
    if(s.limit && s.placed >= s.limit) return this.finish("30 shapes placed");
    if(!this.canPlay(s)) return this.finish("No shape fits");
  },
  finish(why){
    if(this.ending) return; this.ending = true;
    const s = this.st, sc = UL.cur.score, best = this.best(), pb = sc > best;
    if(pb){ UL.setKv("best_"+this.lvl.id, sc); UL.milestone(this.board, "New best!"); }
    this.hud();
    setTimeout(()=>UL.end({won:true, title: pb ? "New best" : "Well played", line: why+" · "+s.lines+" line"+(s.lines===1?"":"s")+" cleared"}), 450);
  },
  onPause(){ if(this.drag){ this.cancel(this.drag); this.drag = null; } },
  onPro(){ if(this.tray) this.paintTray(); }
};
