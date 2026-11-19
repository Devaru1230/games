/* ===================== AD FREE BLOCKS ===================== */
/* A drop puzzle: tap a column and the shape drops straight down. Full rows clear and the rows above fall. */
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
  version: "2.0",
  changelog: [["2.0","A new way to play: the board fills the screen and each shape drops straight down where you tap. Full rows clear and everything above falls."],
    ["1.0","First release: Classic, Quick, Big and Master boards, a Daily, line streaks."]],
  blurb: "Tap a column and the shape drops in. Fill a row to clear it.",
  timer: false,
  daily: "classic",
  levels: [
    {id:"classic", name:"Classic 8×8", note:"play until a shape won't fit",  n:8},
    {id:"quick",   name:"Quick 6×6",   note:"30 shapes, highest score",     n:6, limit:30},
    {id:"big",     name:"Big 10×10",   note:"more room to plan",     pro:1, n:10},
    {id:"master",  name:"Master 8×8",  note:"rotate and hold shapes", pro:1, n:8, master:1}
  ],
  proPerks: ["Big 10×10 board","Master mode with rotate and hold","Three extra themes","Score chart and level breakdown"],
  tutorial: [
    {icon:"👆", title:"Tap to drop", body:"Touch the board: a shadow shows where the shape will land. Slide left or right to choose the column, then let go and it drops straight down."},
    {icon:"➖", title:"Fill a row to clear it", body:"A full row clears and everything above falls down. Clearing two rows at once, or one after another, scores much more."},
    {icon:"👀", title:"Plan ahead", body:"The next shapes wait under the board. The game ends when a shape no longer fits anywhere."}
  ],
  st: null, lvl: null, cells: [], board: null, tray: null, aim: null,

  /* ---------- pure logic (also used by the tests) ---------- */
  fits(b, n, sh, x, y){ for(const [dx,dy] of sh.cells){ const X = x+dx, Y = y+dy; if(X<0||Y<0||X>=n||Y>=n||b[Y*n+X]) return false; } return true; },
  width(sh){ return Math.max(...sh.cells.map(c=>c[0]))+1; },
  height(sh){ return Math.max(...sh.cells.map(c=>c[1]))+1; },
  /* where a shape dropped in column x comes to rest; -1 if it cannot enter */
  landing(b, n, sh, x){ if(x < 0 || x + this.width(sh) > n || !this.fits(b, n, sh, x, 0)) return -1; let y = 0; while(this.fits(b, n, sh, x, y+1)) y++; return y; },
  rotate(sh){ const c = sh.cells.map(([x,y])=>[-y, x]), mx = Math.min(...c.map(p=>p[0])), my = Math.min(...c.map(p=>p[1]));
    const k = c.map(p=>[p[0]-mx, p[1]-my]).sort((a,b)=>a[1]-b[1]||a[0]-b[0]).map(p=>p.join(",")).join(";"); return BK_BYKEY[k]; },
  forms(sh, master){ if(!master) return [sh]; const out = [sh]; let c = sh; for(let i=0;i<3;i++){ c = this.rotate(c); if(!out.includes(c)) out.push(c); } return out; },
  dropsAnywhere(b, n, sh){ for(let x=0;x+this.width(sh)<=n;x++) if(this.landing(b, n, sh, x) >= 0) return true; return false; },
  canPlay(st){
    const list = [st.queue[0]].concat(st.master && st.hold ? [st.hold] : []).map(k=>BK_BYKEY[k]);
    return list.some(sh=>this.forms(sh, st.master).some(f=>this.dropsAnywhere(st.board, st.n, f)));
  },
  /* drop the current shape into column x. Full rows clear and the rows above fall. */
  drop(st, x){
    const key = st.queue[0], sh = BK_BYKEY[key], n = st.n, b = st.board, y = this.landing(b, n, sh, x);
    if(y < 0) return null;
    const placed = sh.cells.map(([dx,dy])=>(y+dy)*n + x+dx); placed.forEach(i=>b[i] = sh.fam+1);
    const rows = []; for(let r=0;r<n;r++){ let f = true; for(let c=0;c<n;c++) if(!b[r*n+c]){ f = false; break; } if(f) rows.push(r); }
    if(rows.length){ const keep = []; for(let r=0;r<n;r++) if(!rows.includes(r)) keep.push(b.slice(r*n, r*n+n));
      const fresh = []; for(let k=0;k<rows.length;k++) fresh.push(new Array(n).fill(0));
      const nb = fresh.concat(keep).flat(); for(let i=0;i<n*n;i++) b[i] = nb[i]; }
    const lines = rows.length;
    st.streak = lines ? st.streak + 1 : 0;
    const points = sh.cells.length + 10*lines*lines + (lines ? st.streak*5 : 0);
    st.placed++; st.lines += lines;
    st.queue.shift(); this.refill(st);
    return {placed, y, rows, lines, points, empty: b.every(v=>!v), streak: st.streak};
  },
  bag(n){ return n <= 6 ? BK_SHAPES.filter(s=>!["sq3","line5","l5"].includes(s.name)) : BK_SHAPES; },
  drawShape(n){ const bag = this.bag(n||8), tot = bag.reduce((a,s)=>a+s.w, 0); let r = UL.random()*tot; for(const s of bag){ r -= s.w; if(r <= 0) return s; } return bag[0]; },
  /* keep three shapes waiting; the next one to play is never a dead shape while a shape that fits exists */
  refill(st){
    while(st.queue.length < 3) st.queue.push(this.drawShape(st.n).key);
    const cur = BK_BYKEY[st.queue[0]];
    if(!this.forms(cur, st.master).some(f=>this.dropsAnywhere(st.board, st.n, f))){
      for(let t=0;t<12;t++){ const c = this.drawShape(st.n); if(this.dropsAnywhere(st.board, st.n, c)){ st.queue[0] = c.key; break; } }
    }
  },

  /* ---------- game ---------- */
  start({level, restore}){
    this.lvl = level; this.aim = null; this.ending = false;
    let st = restore ? JSON.parse(JSON.stringify(restore)) : null;
    if(!st || !st.queue) st = {n:level.n, board:new Array(level.n*level.n).fill(0), queue:[], hold:null, placed:0, lines:0, streak:0, master:!!level.master, limit:level.limit||0};
    this.st = st; if(!st.queue.length) this.refill(st);
    const stage = document.getElementById("stage"), wrap = document.createElement("div"); wrap.className = "bk-wrap";
    const b = this.board = document.createElement("div"); b.className = "bk-board"; b.style.setProperty("--n", st.n);
    this.cells = [];
    for(let i=0;i<st.n*st.n;i++){ const c = document.createElement("div"); c.className = "bk-cell"; b.appendChild(c); this.cells.push(c); }
    wrap.appendChild(b); stage.appendChild(wrap);
    if(st.master){ UL.ctrl({icon:"fresh", label:"Rotate", onTap:()=>this.rotateCur()}); UL.ctrl({icon:"shuffle", label:"Hold", onTap:()=>this.hold()}); }
    const tray = this.tray = document.createElement("div"); tray.className = "bk-queue"; document.getElementById("below").appendChild(tray);
    this.paintBoard(); this.paintQueue(); this.hud(); this.bind();
  },
  serialize(){ return JSON.parse(JSON.stringify(this.st)); },
  best(){ return UL.kv("best_"+this.lvl.id, 0); },
  hud(){ const s = this.st;
    UL.setStat((s.limit ? "Shape <b>"+Math.min(s.placed+1, s.limit)+"/"+s.limit+"</b> · " : "")+"Best <b>"+this.best()+"</b>"+(s.streak >= 2 ? " · streak <b>"+s.streak+"</b>" : "")); },
  paintBoard(){ const s = this.st; this.cells.forEach((c, i)=>{ const v = s.board[i]; c.className = "bk-cell"+(v ? " on f"+(v-1) : ""); }); this.paintAim(); },
  piece(key){
    const sh = BK_BYKEY[key], el = document.createElement("div"); el.className = "bk-piece f"+sh.fam; el.style.setProperty("--w", this.width(sh)); el.style.setProperty("--h", this.height(sh));
    sh.cells.forEach(([x,y])=>{ const c = document.createElement("i"); c.style.gridColumn = (x+1); c.style.gridRow = (y+1); el.appendChild(c); });
    return el;
  },
  paintQueue(){
    const s = this.st, t = this.tray; t.innerHTML = "";
    const slot = (k, cls, label) => { const d = document.createElement("div"); d.className = "bk-q "+cls; const l = document.createElement("small"); l.textContent = label; d.appendChild(l); if(k) d.appendChild(this.piece(k)); t.appendChild(d); return d; };
    slot(s.queue[0], "now", "Now"); slot(s.queue[1], "next", "Next"); slot(s.queue[2], "next", "Then");
    if(s.master) slot(s.hold, "next hold", "Hold");
  },
  cellSize(){ return this.board.getBoundingClientRect().width / this.st.n; },
  /* the shadow: where the current shape lands in the aimed column */
  paintAim(){
    this.cells.forEach(c=>c.classList.remove("ghost","clearing"));
    if(this.aim == null) return;
    const s = this.st, n = s.n, sh = BK_BYKEY[s.queue[0]], y = this.landing(s.board, n, sh, this.aim);
    if(y < 0) return;
    const b = s.board.slice(); sh.cells.forEach(([dx,dy])=>{ const i = (y+dy)*n + this.aim+dx; this.cells[i].classList.add("ghost"); b[i] = 9; });
    for(let r=0;r<n;r++){ let f = true; for(let c=0;c<n;c++) if(!b[r*n+c]){ f = false; break; } if(f) for(let c=0;c<n;c++) this.cells[r*n+c].classList.add("clearing"); }
  },
  colAt(clientX){ const s = this.st, sh = BK_BYKEY[s.queue[0]], r = this.board.getBoundingClientRect(), cs = r.width/s.n, w = this.width(sh);
    return Math.max(0, Math.min(s.n - w, Math.round((clientX - r.left)/cs - w/2))); },
  bind(){
    const b = this.board;
    b.addEventListener("pointerdown", e=>{ if(UL.paused() || this.ending) return; e.preventDefault(); try{ b.setPointerCapture(e.pointerId); }catch(err){}
      this.pid = e.pointerId; this.aim = this.colAt(e.clientX); this.paintAim(); });
    b.addEventListener("pointermove", e=>{ if(this.pid !== e.pointerId || this.aim == null) return; const c = this.colAt(e.clientX); if(c !== this.aim){ this.aim = c; this.paintAim(); UL.buzz("tap"); } });
    b.addEventListener("pointerup", e=>{ if(this.pid !== e.pointerId || this.aim == null) return; this.pid = null; const c = this.aim; this.aim = null; this.play(c); });
    b.addEventListener("pointercancel", ()=>{ this.pid = null; this.aim = null; this.paintAim(); });
    if(this.bound) return; this.bound = true;
    document.addEventListener("keydown", e=>{ if(!this.st || !this.board || UL.paused() || document.activeElement.tagName === "INPUT") return;
      const s = this.st, w = this.width(BK_BYKEY[s.queue[0]]);
      if(e.key==="ArrowLeft"||e.key==="ArrowRight"){ e.preventDefault(); this.aim = Math.max(0, Math.min(s.n - w, (this.aim == null ? Math.floor((s.n - w)/2) : this.aim) + (e.key==="ArrowLeft" ? -1 : 1))); this.paintAim(); }
      else if((e.key===" "||e.key==="ArrowDown"||e.key==="Enter") && this.aim != null){ e.preventDefault(); const c = this.aim; this.aim = null; this.play(c); }
      else if((e.key==="r"||e.key==="ArrowUp") && s.master){ e.preventDefault(); this.rotateCur(); } });
  },
  rotateCur(){ if(UL.paused() || this.ending) return; const s = this.st; s.queue[0] = this.rotate(BK_BYKEY[s.queue[0]]).key; UL.buzz("tap"); this.paintQueue(); this.paintAim(); UL.pop(this.tray.querySelector(".now .bk-piece")); UL.save(); },
  hold(){ if(UL.paused() || this.ending) return; const s = this.st, k = s.queue[0];
    if(s.hold){ s.queue[0] = s.hold; } else { s.queue.shift(); this.refill(s); } s.hold = k; UL.buzz("tap"); this.paintQueue(); this.paintAim(); UL.save(); this.checkEnd(); },
  /* drop the current shape into column x, with a short fall */
  play(x){
    if(UL.paused() || this.ending) return false;
    const s = this.st, key = s.queue[0], sh = BK_BYKEY[key];
    const res = this.drop(s, x);
    if(!res){ UL.shake(this.board); UL.buzz("err"); this.paintAim(); return false; }
    UL.addScore(res.points);
    // the fall: a copy of the shape slides down from the top to where it landed (transform only, under 250ms)
    const anchor = this.cells[res.y*s.n + x], cw = anchor.offsetWidth, step = (this.cells[1].offsetLeft - this.cells[0].offsetLeft) || cw;
    const fall = this.piece(key); fall.classList.add("bk-fall"); fall.style.setProperty("--cs", cw+"px"); fall.style.gap = (step - cw)+"px";
    fall.style.left = anchor.offsetLeft+"px"; fall.style.top = anchor.offsetTop+"px"; fall.style.setProperty("--from", (-(res.y + this.height(sh))*step)+"px");
    fall.style.animationDuration = Math.min(240, 90 + res.y*18)+"ms"; this.board.appendChild(fall);
    const done = () => { fall.remove(); this.paintBoard();
      if(!res.lines) res.placed.forEach(i=>UL.pop(this.cells[i]));
      this.cells.forEach(c=>c.classList.remove("bk-gone"));
    };
    if(res.lines){                                     // flash the full rows before they clear
      const before = this.cells; res.rows.forEach(r=>{ for(let c=0;c<s.n;c++){ const cell = before[r*s.n+c]; cell.className = "bk-cell on f"+sh.fam+" bk-gone"; } });
      UL.sweep(res.rows.flatMap(r=>[...Array(s.n).keys()].map(c=>before[r*s.n+c])), Math.min(18, 200/(res.rows.length*s.n)));
      const mid = before[res.rows[0]*s.n + Math.floor(s.n/2)];
      const tier = (res.streak >= 5 || res.lines >= 4 || res.empty) ? 4 : res.lines >= 3 ? 3 : res.lines === 2 ? 2 : 1;
      UL.praise(mid, tier);
    }
    setTimeout(done, res.lines ? 240 : Math.min(240, 90 + res.y*18));
    UL.buzz(res.lines ? "act" : "tap");
    this.paintQueue(); this.hud(); UL.save();
    setTimeout(()=>this.checkEnd(), res.lines ? 260 : 120);
    return true;
  },
  checkEnd(){
    const s = this.st; if(this.ending) return;
    if(s.limit && s.placed >= s.limit) return this.finish("30 shapes placed");
    if(!this.canPlay(s)) return this.finish("No room for the next shape");
  },
  finish(why){
    if(this.ending) return; this.ending = true;
    const s = this.st, sc = UL.cur.score, best = this.best(), pb = sc > best;
    if(pb){ UL.setKv("best_"+this.lvl.id, sc); UL.milestone(this.board, "New best!"); }
    this.hud();
    setTimeout(()=>UL.end({won:true, title: pb ? "New best" : "Well played", line: why+" · "+s.lines+" row"+(s.lines===1?"":"s")+" cleared"}), 450);
  },
  onPause(){ this.aim = null; this.pid = null; if(this.board) this.paintAim(); },
  onPro(){ if(this.tray) this.paintQueue(); }
};
