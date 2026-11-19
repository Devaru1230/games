/* ===================== AD FREE SOLITAIRE ===================== */
/* The traditional single-deck patience game. Card id 0..51: suit = id/13 (0 spades, 1 hearts, 2 diamonds, 3 clubs), rank = id%13 + 1. */
const SO_SUITS = ["spades","hearts","diamonds","clubs"], SO_RANKS = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
const soSuit = c => Math.floor(c/13), soRank = c => c%13 + 1, soRed = c => soSuit(c)===1 || soSuit(c)===2;
const SO_PIPS = [
  '<path d="M12 2C9 7 3 9.5 3 14a4.5 4.5 0 0 0 7.6 3.2L9 22h6l-1.6-4.8A4.5 4.5 0 0 0 21 14c0-4.5-6-7-9-12z"/>',
  '<path d="M12 21C6 16 2.5 12.5 2.5 8.3A4.8 4.8 0 0 1 12 6a4.8 4.8 0 0 1 9.5 2.3C21.5 12.5 18 16 12 21z"/>',
  '<path d="M12 2l7.5 10L12 22 4.5 12z"/>',
  '<path d="M12 2.5a4.3 4.3 0 0 0-3.6 6.7A4.3 4.3 0 1 0 10.6 17L9 22h6l-1.6-5a4.3 4.3 0 1 0 2.2-7.8A4.3 4.3 0 0 0 12 2.5z"/>'
];

const GAME = {
  id: "solitaire",
  name: "Ad Free Solitaire",
  title: ["SOLI","TAIRE"],
  icon: "♠️",
  version: "1.0",
  changelog: [["1.0","First release: draw one, draw three and winnable-only deals, a Daily deal, undo, hints and auto-finish."]],
  blurb: "Build the four suits from ace to king.",
  timer: true,
  daily: "one",
  levels: [
    {id:"one",      name:"Draw one",      note:"the classic deal",                 draw:1, par:600},
    {id:"three",    name:"Draw three",    note:"three cards at a time",  pro:1,    draw:3, par:900, parMoves:150},
    {id:"winnable", name:"Winnable deal", note:"every deal can be won",  pro:1,    draw:1, par:600, winnable:1}
  ],
  proPerks: ["Draw-three mode","Winnable-only deals","Unlimited undo","Three extra themes"],
  tutorial: [
    {icon:"🂡", title:"Build the four suits", body:"Move every card to the four piles at the top, one pile per suit, from ace up to king."},
    {icon:"↕️", title:"Stack down, colours alternate", body:"In the seven columns, put a card on one rank higher of the other colour: a red 6 on a black 7. Only a king goes into an empty column."},
    {icon:"👆", title:"Tap and it goes", body:"Tap a card and it moves to the best place it can. You can also drag cards, including a whole run. Tap the deck to turn over new cards."}
  ],
  FREE_UNDOS: 5, WIN_CAP: 30000,
  st: null, lvl: null, els: [], wrap: null,

  /* ---------- rules (pure; the solver and the tests use them too) ---------- */
  deal(draw, deck){
    const st = {draw, stock:[], waste:[], found:[[],[],[],[]], tab:[[],[],[],[],[],[],[]], down:[0,0,0,0,0,0,0], moves:0, passes:0};
    let k = 0; for(let c=0;c<7;c++){ for(let r=0;r<=c;r++) st.tab[c].push(deck[k++]); st.down[c] = c; }
    st.stock = deck.slice(k).reverse();              // top of the stock is the end of the array
    return st;
  },
  canFound(st, c){ return st.found[soSuit(c)].length === soRank(c)-1; },
  canTab(st, c, col){ const t = st.tab[col]; if(!t.length) return soRank(c) === 13; const top = t[t.length-1];
    return t.length > st.down[col] && soRed(top) !== soRed(c) && soRank(top) === soRank(c)+1; },
  clone(st){ return {draw:st.draw, stock:st.stock.slice(), waste:st.waste.slice(), found:st.found.map(f=>f.slice()), tab:st.tab.map(t=>t.slice()), down:st.down.slice(), moves:st.moves, passes:st.passes}; },
  /* every legal move: draw, recycle, w2f, w2t, t2f, t2t (from, idx, to), f2t */
  moves(st){
    const out = [];
    if(st.stock.length) out.push({t:"draw"}); else if(st.waste.length) out.push({t:"recycle"});
    const w = st.waste[st.waste.length-1];
    if(w != null){ if(this.canFound(st, w)) out.push({t:"w2f"}); for(let c=0;c<7;c++) if(this.canTab(st, w, c)) out.push({t:"w2t", to:c}); }
    for(let c=0;c<7;c++){ const t = st.tab[c]; if(!t.length) continue;
      if(this.canFound(st, t[t.length-1])) out.push({t:"t2f", from:c});
      for(let i=st.down[c]; i<t.length; i++) for(let d=0; d<7; d++) if(d !== c && this.canTab(st, t[i], d)) out.push({t:"t2t", from:c, idx:i, to:d}); }
    for(let s=0;s<4;s++){ const f = st.found[s]; if(!f.length) continue; const c = f[f.length-1]; for(let d=0;d<7;d++) if(this.canTab(st, c, d)) out.push({t:"f2t", suit:s, to:d}); }
    return out;
  },
  /* apply a legal move in place; returns {points, flip, moved} or null if not legal */
  apply(st, m){
    let points = 0, flip = false, moved = [];
    const reveal = c => { if(st.tab[c].length && st.down[c] >= st.tab[c].length){ st.down[c] = st.tab[c].length-1; flip = true; points += 5; } };
    switch(m.t){
      case "draw": { if(!st.stock.length) return null; const n = Math.min(st.draw, st.stock.length); for(let k=0;k<n;k++){ const c = st.stock.pop(); st.waste.push(c); moved.push(c); } break; }
      case "recycle": { if(st.stock.length || !st.waste.length) return null; st.stock = st.waste.reverse(); st.waste = []; st.passes++; break; }
      case "w2f": { const c = st.waste[st.waste.length-1]; if(c == null || !this.canFound(st, c)) return null; st.waste.pop(); st.found[soSuit(c)].push(c); points += 10; moved = [c]; break; }
      case "w2t": { const c = st.waste[st.waste.length-1]; if(c == null || !this.canTab(st, c, m.to)) return null; st.waste.pop(); st.tab[m.to].push(c); points += 5; moved = [c]; break; }
      case "t2f": { const t = st.tab[m.from], c = t[t.length-1]; if(c == null || t.length <= st.down[m.from] || !this.canFound(st, c)) return null; t.pop(); st.found[soSuit(c)].push(c); points += 10; moved = [c]; reveal(m.from); break; }
      case "t2t": { const t = st.tab[m.from]; if(m.idx < st.down[m.from] || m.idx >= t.length || m.from === m.to || !this.canTab(st, t[m.idx], m.to)) return null;
        moved = t.splice(m.idx); st.tab[m.to].push(...moved); reveal(m.from); break; }
      case "f2t": { const f = st.found[m.suit], c = f[f.length-1]; if(c == null || !this.canTab(st, c, m.to)) return null; f.pop(); st.tab[m.to].push(c); points -= 15; moved = [c]; break; }
      default: return null;
    }
    st.moves++;
    return {points, flip, moved};
  },
  won(st){ return st.found.every(f=>f.length === 13); },
  allOpen(st){ return !st.stock.length && !st.waste.length && st.tab.every((t,c)=>st.down[c]===0 || !t.length); },
  /* is there anything to do besides turning the deck? (checks every card waiting in the deck too) */
  stuck(st){
    const progress = m => m.t==="w2f" || m.t==="w2t" || m.t==="t2f" ||
      (m.t==="t2t" && ((m.idx===st.down[m.from] && st.down[m.from] > 0) || (m.idx > st.down[m.from] && this.canFound(st, st.tab[m.from][m.idx-1]))));
    if(this.moves(st).some(progress)) return false;
    const deck = st.stock.concat(st.waste);
    return !deck.some(c=>this.canFound(st, c) || [0,1,2,3,4,5,6].some(d=>this.canTab(st, c, d)));
  },
  /* depth-first search with a visited set, for the winnable deals. Returns the moves that win, or null. */
  solve(start, cap){
    cap = cap || 60000; const seen = new Set(), path = []; let nodes = 0;
    const key = s => s.tab.map((t,c)=>s.down[c]+":"+t.join(",")).sort().join("|")+"/"+s.found.map(f=>f.length).join(",")+"/"+s.stock.join(",")+"/"+s.waste.join(",");
    const go = s => {
      if(this.won(s)) return true; if(++nodes > cap) return false;
      const k = key(s); if(seen.has(k)) return false; seen.add(k);
      const ms = this.moves(s).filter(m=>{
        if(m.t==="f2t") return false;
        if(m.t==="t2t"){ const runFromBottom = m.idx === s.down[m.from];
          if(!runFromBottom) return false;                                   // only whole face-up runs
          if(m.idx === 0 && soRank(s.tab[m.from][0]) === 13) return false;  // a king already at the bottom of a column stays
          if(!s.tab[m.to].length && m.idx === 0) return false; }
        return true; });
      const prio = m => m.t==="t2f"||m.t==="w2f" ? 0 : m.t==="t2t" ? 1 : m.t==="w2t" ? 2 : 3;
      ms.sort((a,b)=>prio(a)-prio(b));
      for(const m of ms){ const n = this.clone(s); if(!this.apply(n, m)) continue; path.push(m); if(go(n)) return true; path.pop(); if(nodes > cap) return false; }
      return false; };
    return go(this.clone(start)) ? path.slice() : null;
  },
  newDeal(level){
    for(let t=0;t<(level.winnable ? 60 : 1);t++){
      const st = this.deal(level.draw, UL.shuffle([...Array(52).keys()]));
      if(!level.winnable || this.solve(st, this.WIN_CAP)) return st;
    }
    return this.deal(level.draw, UL.shuffle([...Array(52).keys()]));
  },

  /* ---------- game ---------- */
  start({level, restore}){
    this.lvl = level; this.ending = false; this.drag = null; this.hinted = null; this.token = null;
    if(restore){ this.st = JSON.parse(JSON.stringify(restore)); this.boot(); return; }
    const stage = document.getElementById("stage");
    if(level.winnable){                               // a winnable deal can take a few seconds on a slow phone: deal in steps, show it
      const w = document.createElement("div"); w.className = "so-dealing"; w.textContent = "Dealing a winnable game…"; stage.appendChild(w);
      this.st = null; const token = this.token = {}; let tries = 0;
      const step = () => { if(this.token !== token) return;
        const st = this.deal(level.draw, UL.shuffle([...Array(52).keys()])); tries++;
        if(this.solve(st, this.WIN_CAP) || tries >= 80){ w.remove(); this.st = Object.assign(st, {undo:[], undosUsed:0, hints:0, score:0}); this.boot(); UL.save(); }
        else setTimeout(step, 0); };
      setTimeout(step, 30); return;
    }
    this.st = this.newDeal(level);
    Object.assign(this.st, {undo:[], undosUsed:0, hints:0, score:0});
    this.boot();
  },
  boot(){
    const stage = document.getElementById("stage"), wrap = this.wrap = document.createElement("div"); wrap.className = "so-wrap"+(UL.kv("four", false) ? " four" : "");
    stage.appendChild(wrap);
    this.slots = [];
    for(let k=0;k<13;k++){ const s = document.createElement("div"); s.className = "so-slot"; wrap.appendChild(s); this.slots.push(s); }
    this.els = [];
    for(let c=0;c<52;c++){ const e = document.createElement("div"); e.className = "so-card "+(soRed(c) ? "red" : "black")+" s"+soSuit(c); e.dataset.c = c;
      e.innerHTML = '<span class="so-r">'+SO_RANKS[soRank(c)-1]+'</span><svg class="so-s" viewBox="0 0 24 24">'+SO_PIPS[soSuit(c)]+'</svg><svg class="so-big" viewBox="0 0 24 24">'+SO_PIPS[soSuit(c)]+'</svg>';
      e.setAttribute("aria-label", SO_RANKS[soRank(c)-1]+" of "+SO_SUITS[soSuit(c)]);
      wrap.appendChild(e); this.els.push(e); }
    this.undoBtn = UL.ctrl({icon:"undo", label:"Undo", onTap:()=>this.undoMove()});
    this.hintBtn = UL.ctrl({icon:"hint", label:"Hint", onTap:()=>this.hint()});
    this.finBtn = UL.ctrl({icon:"bolt", label:"Finish", onTap:()=>this.autoFinish()});
    this.endBtn = UL.ctrl({icon:"flag", label:"End game", onTap:()=>this.giveUp()});
    const opt = document.createElement("button"); opt.className = "so-opt"; document.getElementById("below").appendChild(opt); this.optBtn = opt;
    opt.addEventListener("click", ()=>{ const v = !UL.kv("four", false); UL.setKv("four", v); this.wrap.classList.toggle("four", v); this.paintOpt(); });
    this.paintOpt(); this.layout(); this.render(true); this.hud(); this.bind();
  },
  serialize(){ return this.st ? JSON.parse(JSON.stringify(this.st)) : null; },
  paintOpt(){ this.optBtn.textContent = UL.kv("four", false) ? "Suit colours: four" : "Suit colours: red and black"; },
  layout(){
    const stage = document.getElementById("stage"), S = Math.min(stage.clientWidth, stage.clientHeight) || 340, gap = Math.max(3, S*0.012);
    const cw = (S - gap*8)/7, ch = cw*1.4;
    this.L = {S, gap, cw, ch, x:c=>gap + c*(cw+gap), top:gap, tabY:gap*2 + ch};
    this.wrap.style.setProperty("--cw", cw+"px"); this.wrap.style.setProperty("--ch", ch+"px");
  },
  /* where every card sits; face-down and face-up overlaps squeeze so a long column still fits */
  render(instant){
    const s = this.st, L = this.L, pos = new Array(52);
    // slots: stock, waste, 4 foundations, 7 columns
    const place = (el, x, y) => { el.style.transform = "translate("+x+"px,"+y+"px)"; };
    place(this.slots[0], L.x(0), L.top); place(this.slots[1], L.x(1), L.top); for(let f=0;f<4;f++) place(this.slots[2+f], L.x(3+f), L.top);
    for(let c=0;c<7;c++) place(this.slots[6+c], L.x(c), L.tabY);
    this.slots[0].classList.toggle("recycle", !s.stock.length && s.waste.length > 0);
    s.stock.forEach((c,i)=>{ pos[c] = {x:L.x(0), y:L.top, up:false, z:i}; });
    const fan = s.draw === 3 ? Math.min(3, s.waste.length) : 1;
    s.waste.forEach((c,i)=>{ const k = i - (s.waste.length - fan), dx = k > 0 ? k*L.cw*0.32 : 0; pos[c] = {x:L.x(1) + dx, y:L.top, up:true, z:100+i}; });
    s.found.forEach((f, si)=>f.forEach((c,i)=>{ pos[c] = {x:L.x(3+si), y:L.top, up:true, z:200+i}; }));
    const avail = L.S - L.tabY - L.ch - 2;
    s.tab.forEach((t, col)=>{ const dn = s.down[col], upN = Math.max(0, t.length - dn - 1);
      let dd = L.ch*0.13, du = L.ch*0.27; const need = dd*dn + du*upN; if(need > avail){ const k = avail/need; dd *= k; du *= k; }
      let y = L.tabY; t.forEach((c,i)=>{ pos[c] = {x:L.x(col), y, up:i >= dn, z:300+i}; y += i < dn ? dd : du; }); });
    this.pos = pos;
    this.els.forEach((e, c)=>{ const p = pos[c]; if(!p) return; if(instant) e.style.transition = "none";
      place(e, p.x, p.y); e.style.zIndex = p.z; e.classList.toggle("up", p.up); e.classList.toggle("hintme", !!(this.hinted && this.hinted.includes(c)));
      if(instant){ void e.offsetWidth; e.style.transition = ""; } });
  },
  hud(){
    const s = this.st, left = UL.isPro() ? "∞" : Math.max(0, this.FREE_UNDOS - s.undosUsed);
    UL.setStat("Moves <b>"+s.moves+"</b>");
    this.undoBtn.setLabel("Undo "+left); this.undoBtn.classList.toggle("dim", !s.undo.length || left===0);
    const fin = this.allOpen(s) && !this.won(s); this.finBtn.style.display = fin ? "" : "none";
    this.endBtn.style.display = this.stuck(s) && !this.won(s) ? "" : "none";
  },
  /* ---------- playing a move ---------- */
  doMove(m, quiet){
    if(UL.paused() || this.ending) return false;
    const s = this.st, snap = JSON.stringify({stock:s.stock, waste:s.waste, found:s.found, tab:s.tab, down:s.down, moves:s.moves, passes:s.passes, score:UL.cur.score});
    const doneBefore = s.found.map(f=>f.length===13), emptyBefore = s.tab.map(t=>!t.length);
    const r = this.apply(s, m); if(!r) return false;
    s.undo.push(snap); if(s.undo.length > 60) s.undo.shift();
    this.hinted = null;
    if(r.points) UL.setScore(Math.max(0, UL.cur.score + r.points));
    this.render(); UL.buzz(r.flip ? "act" : "tap");
    const lastEl = this.els[r.moved[r.moved.length-1] ?? s.waste[s.waste.length-1]];
    if(m.t==="w2f" || m.t==="t2f"){ UL.pop(lastEl);
      const si = soSuit(r.moved[0]); if(!doneBefore[si] && s.found[si].length===13 && !this.won(s)){ UL.sweep(s.found[si].map(c=>this.els[c]).reverse().slice(0,6), 30); UL.praise(lastEl, 3); } }
    if(!quiet && !this.won(s)){
      if(m.t==="t2t" && r.moved.length >= 4) UL.praise(lastEl, 2);
      else if((m.t==="t2t" || m.t==="t2f") && !emptyBefore[m.from] && !s.tab[m.from].length) UL.praise(lastEl, 1);
    }
    this.hud(); UL.save();
    if(this.won(s)) this.win();
    else if(!quiet && this.stuck(s)) UL.toast("No moves left. Undo, restart, or tap End game.");
    return true;
  },
  /* tap: send the card (or the run from it) to the best legal place: foundation first, then a column */
  tapCard(c){
    const s = this.st;
    if(s.stock.includes(c)) return this.doMove({t:"draw"});
    if(s.waste.length && s.waste[s.waste.length-1] === c){
      if(this.canFound(s, c)) return this.doMove({t:"w2f"});
      const to = this.bestCol(c, -1); if(to >= 0) return this.doMove({t:"w2t", to});
      return this.nope(c); }
    for(let col=0;col<7;col++){ const t = s.tab[col], i = t.indexOf(c); if(i < 0) continue;
      if(i < s.down[col]) return this.nope(c);
      if(i === t.length-1 && this.canFound(s, c)) return this.doMove({t:"t2f", from:col});
      const to = this.bestCol(c, col); if(to >= 0 && !(i === 0 && soRank(c) === 13 && !s.tab[to].length)) return this.doMove({t:"t2t", from:col, idx:i, to});
      return this.nope(c); }
    for(let si=0;si<4;si++){ const f = s.found[si]; if(f[f.length-1] === c){ const to = this.bestCol(c, -1); if(to >= 0) return this.doMove({t:"f2t", suit:si, to}); return this.nope(c); } }
    return false;
  },
  bestCol(c, from){ const s = this.st; let empty = -1;
    for(let d=0; d<7; d++){ if(d === from || !this.canTab(s, c, d)) continue; if(s.tab[d].length) return d; if(empty < 0) empty = d; }
    return empty; },
  nope(c){ UL.shake(this.els[c]); UL.buzz("err"); return false; },
  /* ---------- dragging ---------- */
  pileAt(x, y){
    const r = this.wrap.getBoundingClientRect(), L = this.L, lx = x - r.left, ly = y - r.top;
    const col = Math.max(0, Math.min(6, Math.floor((lx - L.gap/2)/(L.cw + L.gap))));
    if(ly < L.tabY - L.gap/2){ if(col >= 3) return {kind:"f", i:col-3}; return null; }
    return {kind:"t", i:col};
  },
  bind(){
    const w = this.wrap;
    w.addEventListener("pointerdown", e=>{
      if(UL.paused() || this.ending) return;
      const card = e.target.closest(".so-card"), slot = e.target.closest(".so-slot");
      if(!card){ if(slot === this.slots[0]){ e.preventDefault(); this.doMove({t:"recycle"}); } return; }
      e.preventDefault(); try{ w.setPointerCapture(e.pointerId); }catch(err){}
      const c = +card.dataset.c; this.drag = {c, id:e.pointerId, x0:e.clientX, y0:e.clientY, moved:false, cards:null};
    });
    w.addEventListener("pointermove", e=>{ const d = this.drag; if(!d || d.id !== e.pointerId) return;
      const dx = e.clientX - d.x0, dy = e.clientY - d.y0; if(!d.moved && Math.hypot(dx, dy) < 8) return;
      if(!d.moved){ d.moved = true; d.cards = this.runFrom(d.c); if(!d.cards){ this.drag = null; return; } d.cards.forEach(c=>{ const el = this.els[c]; el.classList.add("lift"); }); }
      d.cards.forEach(c=>{ const p = this.pos[c]; this.els[c].style.transform = "translate("+(p.x+dx)+"px,"+(p.y+dy)+"px)"; }); });
    const up = e=>{ const d = this.drag; if(!d || d.id !== e.pointerId) return; this.drag = null;
      if(!d.moved){ this.tapCard(d.c); return; }
      d.cards.forEach(c=>this.els[c].classList.remove("lift"));
      const s = this.st, tgt = this.pileAt(e.clientX, e.clientY), src = this.where(d.c);
      let m = null;
      if(tgt && tgt.kind==="f" && d.cards.length===1 && soSuit(d.c)===tgt.i){ m = src.kind==="w" ? {t:"w2f"} : src.kind==="t" ? {t:"t2f", from:src.i} : null; }
      else if(tgt && tgt.kind==="t" && !(src.kind==="t" && src.i===tgt.i)){ m = src.kind==="w" ? {t:"w2t", to:tgt.i} : src.kind==="t" ? {t:"t2t", from:src.i, idx:src.idx, to:tgt.i} : src.kind==="f" ? {t:"f2t", suit:src.i, to:tgt.i} : null; }
      if(!m || !this.doMove(m)){ this.render(); if(tgt && !(src.kind==="t" && tgt.kind==="t" && src.i===tgt.i)) this.nope(d.c); } };
    w.addEventListener("pointerup", up); w.addEventListener("pointercancel", ()=>{ this.drag = null; this.render(); });
    if(this.bound) return; this.bound = true;
    window.addEventListener("resize", ()=>{ if(this.st && this.wrap){ this.layout(); this.render(true); } });
  },
  where(c){ const s = this.st;
    if(s.waste[s.waste.length-1] === c) return {kind:"w"};
    for(let i=0;i<7;i++){ const k = s.tab[i].indexOf(c); if(k >= 0) return {kind:"t", i, idx:k}; }
    for(let i=0;i<4;i++) if(s.found[i][s.found[i].length-1] === c) return {kind:"f", i};
    return {kind:"x"}; },
  runFrom(c){ const s = this.st, w = this.where(c);
    if(w.kind==="w" || w.kind==="f") return [c];
    if(w.kind==="t" && w.idx >= s.down[w.i]) return s.tab[w.i].slice(w.idx);
    return null; },
  /* ---------- help ---------- */
  hint(){
    if(UL.paused() || this.ending) return;
    const s = this.st, ms = this.moves(s);
    const useful = m => !(m.t==="f2t") && !(m.t==="t2t" && m.idx===0 && soRank(s.tab[m.from][0])===13 && !s.tab[m.to].length) && !(m.t==="t2t" && m.idx > s.down[m.from] && s.tab[m.from].length);
    const prio = m => (m.t==="t2f"||m.t==="w2f") ? 0 : (m.t==="t2t" && m.idx===s.down[m.from] && s.down[m.from]>0) ? 1 : m.t==="t2t" ? 2 : m.t==="w2t" ? 3 : 4;
    const best = ms.filter(useful).sort((a,b)=>prio(a)-prio(b))[0];
    if(!best){ UL.toast(this.stuck(s) ? "No moves left. Undo, restart, or tap End game." : "Nothing to do here. Try turning the deck."); return; }
    s.hints++;
    const cards = best.t==="draw" ? [s.stock[s.stock.length-1]] : best.t==="recycle" ? [] : best.t.startsWith("w") ? [s.waste[s.waste.length-1]] : best.t==="t2f" ? [s.tab[best.from][s.tab[best.from].length-1]] : best.t==="t2t" ? [s.tab[best.from][best.idx]] : [];
    if(!cards.length){ UL.toast("Tap the empty deck to turn the cards over again."); return; }
    this.hinted = cards; this.render(); UL.buzz("tap");
    setTimeout(()=>{ if(this.hinted === cards){ this.hinted = null; this.render(); } }, 1600);
  },
  autoFinish(){
    if(UL.paused() || this.ending || !this.allOpen(this.st)) return;
    const step = () => { if(this.ending || UL.paused()) return; const s = this.st;
      const m = this.moves(s).find(x=>x.t==="t2f"); if(!m) return; this.doMove(m, true); if(!this.won(this.st)) setTimeout(step, 70); };
    step();
  },
  undoMove(){
    if(UL.paused() || this.ending) return; const s = this.st; if(!s.undo.length) return;
    if(!UL.isPro() && s.undosUsed >= this.FREE_UNDOS){ UL.requirePro("Free games include "+this.FREE_UNDOS+" undos. Pro is unlimited."); return; }
    const u = JSON.parse(s.undo.pop()); Object.assign(s, {stock:u.stock, waste:u.waste, found:u.found, tab:u.tab, down:u.down, moves:u.moves, passes:u.passes}); s.undosUsed++;
    UL.setScore(u.score); this.hinted = null; this.render(); this.hud(); UL.save();
  },
  giveUp(){ if(this.ending || UL.paused()) return; if(!confirm("End this game? It counts as a loss.")) return; this.ending = true;
    UL.end({won:false, title:"Game over", line:this.st.found.reduce((a,f)=>a+f.length,0)+" of 52 cards home in "+this.st.moves+" moves"}); },
  win(){
    if(this.ending) return; this.ending = true;
    const s = this.st, lvl = this.lvl, sec = UL.cur.sec;
    UL.setScore(UL.cur.score + Math.max(0, lvl.par - sec));
    const mid = this.els[s.found[1][12]];
    if(s.undosUsed === 0 || (lvl.parMoves && s.moves <= lvl.parMoves)) UL.praise(mid, 4); else UL.milestone(mid, "All home!");
    // the cards tumble off the foundations for a moment; a tap skips it
    const cascade = document.createElement("div"); cascade.className = "so-cascade"; this.wrap.appendChild(cascade);
    s.found.forEach((f, si)=>f.slice().reverse().forEach((c, k)=>{ const el = this.els[c]; el.style.transition = "transform 1.2s cubic-bezier(.5,0,.9,.6), opacity 1.2s";
      el.style.transitionDelay = (k*60 + si*25)+"ms"; el.style.transform = "translate("+(this.pos[c].x + (si-1.5)*40)+"px,"+(this.L.S + 40)+"px) rotate("+((si%2?1:-1)*25)+"deg)"; el.style.opacity = "0"; }));
    const stop = ()=>{ cascade.remove(); this.els.forEach(e=>{ e.style.transition = "none"; e.style.opacity = ""; e.style.transitionDelay = ""; }); this.render(true); };
    cascade.addEventListener("pointerdown", stop); setTimeout(stop, 1900);
    UL.end({won:true, title:"Solved", line:"All 52 cards home in "+s.moves+" moves"});
  },
  onPause(){ if(this.drag){ this.drag = null; this.render(); } },
  onPro(){ if(this.undoBtn) this.hud(); }
};
