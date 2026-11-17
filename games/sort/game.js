/* ===================== AD FREE COLOUR SORT ===================== */
/* A tube is a string of colour letters, bottom first: "aab" has two of colour a at the bottom and b on top. */
const CS_CAP = 4, CS_LET = "abcdefghij";

const GAME = {
  id: "sort",
  name: "Ad Free Colour Sort",
  title: ["COLOUR","SORT"],
  icon: "🧪",
  version: "1.3",
  changelog: [["1.3","Longer, wider tubes that are easier to see and tap."],["1.2","Long glass tubes, and pours that behave like real liquid: the tube tips over the target, the stream falls and splashes, and the levels settle."],["1.1","The tubes now hold real-looking liquid that flows when you pour, the tubes are bigger, and a Hint button shows a good next pour."],["1.0","First release: Easy, Medium, Hard and Expert puzzles, a Daily, undo and an extra tube."]],
  blurb: "Pour until every tube holds one colour.",
  timer: false,
  daily: "medium",
  levels: [
    {id:"easy",   name:"Easy",   note:"5 colours · 7 tubes",           k:5,  n:7,  base:100},
    {id:"medium", name:"Medium", note:"7 colours · 9 tubes",           k:7,  n:9,  base:150},
    {id:"hard",   name:"Hard",   note:"9 colours · 11 tubes",  pro:1,  k:9,  n:11, base:200},
    {id:"expert", name:"Expert", note:"10 colours · 11 tubes", pro:1,  k:10, n:11, base:250}
  ],
  proPerks: ["Hard and Expert puzzles","Unlimited undo and hints","One extra tube when you are stuck","Three extra themes"],
  tutorial: [
    {icon:"👆", title:"Tap to lift, tap to pour", body:"Tap a tube to lift its top colour. Tap another tube to pour it in. Tap the same tube again to put it back."},
    {icon:"🧪", title:"Same colour or empty", body:"You can pour only onto the same colour, or into an empty tube, and only as much as fits."},
    {icon:"✅", title:"One colour per tube", body:"Sort every tube so each one holds a single colour. Fewer moves score more."}
  ],
  FREE_UNDOS: 3, FREE_HINTS: 3, SOLVER_CAP: 60000,
  st: null, sel: -1, els: [], box: null, undoBtn: null, extraBtn: null, hintBtn: null, hinted: null, lvl: null,

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
    this.lvl = level; this.sel = -1; this.anim = null; this.fx = {};
    const st = this.st = restore ? JSON.parse(JSON.stringify(restore))
      : Object.assign(this.make(level), {moves:0, undosUsed:0, hintsUsed:0, undo:[], extra:false, done:0, recent:[]});
    if(st.hintsUsed == null) st.hintsUsed = 0;
    const stage = document.getElementById("stage");
    const box = this.box = document.createElement("div"); box.className = "cs-box"; stage.appendChild(box);
    this.cv = document.createElement("canvas"); this.cv.className = "cs-cv"; box.appendChild(this.cv);
    this.undoBtn = UL.ctrl({icon:"undo", label:"Undo", onTap:()=>this.undoMove()});
    this.hintBtn = UL.ctrl({icon:"hint", label:"Hint", onTap:()=>this.hint()});
    this.extraBtn = UL.ctrl({icon:"fresh", label:"Extra tube", onTap:()=>this.addTube()});
    this.readTheme(); this.render(); this.hud(); this.bind();
  },
  serialize(){ return JSON.parse(JSON.stringify(this.st)); },

  /* ---------- geometry: long test tubes, two rows ---------- */
  layout(){
    const stage = document.getElementById("stage"), S = Math.min(stage.clientWidth, stage.clientHeight) || 340, n = this.st.tubes.length;
    const rows = n > 5 ? 2 : 1, per = Math.ceil(n/rows), slotW = S/per, rowH = S/rows;
    const w = Math.min(slotW*0.66, 56), len = rowH - 16, padTop = Math.round(len*1.05), padX = 24;   // as tall as a row allows, and wide enough to tap easily
    return {S, rows, per, slotW, rowH, w, len, g:2.4, padTop, padX};
  },
  /* the inside of a tube in its own frame: mouth centre at (0,0), y grows toward the rounded bottom */
  innerPoly(L){
    const wi = L.w - 2*L.g, r = wi/2, top = 3, bot = L.len - L.g, cy = bot - r, pts = [[-r, top]];
    for(let k=0;k<=18;k++){ const a = Math.PI - k*Math.PI/18; pts.push([r*Math.cos(a), cy + r*Math.sin(a)]); }
    pts.push([r, top]); return pts;
  },
  /* ---------- liquid physics: the surface stays level, whatever the tube does ---------- */
  rot(p, a, c){ const s = Math.sin(a), co = Math.cos(a), x = p[0]-(c?c[0]:0), y = p[1]-(c?c[1]:0); return [x*co - y*s + (c?c[0]:0), x*s + y*co + (c?c[1]:0)]; },
  area(poly){ let a = 0; for(let i=0;i<poly.length;i++){ const p = poly[i], q = poly[(i+1)%poly.length]; a += p[0]*q[1] - q[0]*p[1]; } return Math.abs(a)/2; },
  clipY(poly, Y, below){       // keep the part with y >= Y (below) or y <= Y
    const out = [], inside = p => below ? p[1] >= Y : p[1] <= Y;
    for(let i=0;i<poly.length;i++){ const p = poly[i], q = poly[(i+1)%poly.length], pi = inside(p), qi = inside(q);
      if(pi) out.push(p);
      if(pi !== qi){ const t = (Y - p[1]) / (q[1] - p[1]); out.push([p[0] + t*(q[0]-p[0]), Y]); } }
    return out;
  },
  levelFor(poly, A){            // world height of the surface that holds area A at the bottom of poly
    let lo = Infinity, hi = -Infinity; for(const p of poly){ lo = Math.min(lo, p[1]); hi = Math.max(hi, p[1]); }
    if(A <= 0) return hi; let a = lo, b = hi;
    for(let i=0;i<26;i++){ const m = (a+b)/2; if(this.area(this.clipY(poly, m, true)) > A) a = m; else b = m; }
    return (a+b)/2;
  },
  /* the tilt at which a tube holding area A brings its liquid up to the pouring lip (table, built once per layout) */
  tiltTable(){
    const L = this.L, P = this.inner, out = [], wi = L.w - 2*L.g, steps = 80;
    for(let k=0;k<=steps;k++){ const A = this.unitA*CS_CAP*k/steps; let lo = 0, hi = 2.6;
      for(let i=0;i<22;i++){ const m = (lo+hi)/2, poly = P.map(p=>this.rot(p, m)), lip = this.rot([wi/2, 3], m);
        if(this.levelFor(poly, A) <= lip[1] + 0.3) hi = m; else lo = m; }
      out.push(hi); }
    return out;
  },
  tiltFor(A){ const T = this.tilt, f = Math.max(0, Math.min(1, A/(this.unitA*CS_CAP)))*(T.length-1), i = Math.floor(f), t = f - i; return i >= T.length-1 ? T[T.length-1] : T[i]*(1-t) + T[i+1]*t; },

  readTheme(){
    const cs = getComputedStyle(this.box), v = n => cs.getPropertyValue(n).trim();
    this.C = {ink:v("--ink"), cell:v("--cellbg"), gold:v("--gold"), deep:v("--gold-deep"), cream:v("--cream"), mark:v("--cs-mark"),
      liq:[1,2,3,4,5,6,7,8,9,10].map(k=>v("--cs-"+k))};
  },
  onTheme(){ if(this.box){ this.readTheme(); this.draw(); } },
  mix(hex, other, t){ const h = c => { c = c.replace("#",""); if(c.length===3) c = c.split("").map(x=>x+x).join(""); return [0,2,4].map(i=>parseInt(c.substr(i,2),16)); };
    try{ const a = h(hex), b = h(other); return "rgb("+a.map((x,i)=>Math.round(x*(1-t)+b[i]*t)).join(",")+")"; }catch(e){ return hex; } },

  render(){
    this.finishAnim(true);
    const L = this.L = this.layout(), t = this.st.tubes, box = this.box;
    box.querySelectorAll(".cs-slot,.cs-tag").forEach(e=>e.remove()); this.els = []; this.hinted = null;
    this.inner = this.innerPoly(L);
    const full = this.area(this.inner), headroom = this.area(this.clipY(this.inner, L.len*0.16, false));
    this.unitA = (full - headroom)/CS_CAP; this.tilt = this.tiltTable();
    this.pos = [];
    t.forEach((z, i)=>{
      const row = L.rows===2 && i >= L.per ? 1 : 0, inRow = row ? t.length - L.per : Math.min(L.per, t.length), col = row ? i - L.per : i;
      const x = (L.S - inRow*L.slotW)/2 + col*L.slotW, y = row*L.rowH;
      const slot = document.createElement("button"); slot.className = "cs-slot"; slot.dataset.i = i;
      slot.style.left = x+"px"; slot.style.top = y+"px"; slot.style.width = L.slotW+"px"; slot.style.height = L.rowH+"px";
      box.appendChild(slot); this.els.push(slot);
      this.pos.push([x + L.slotW/2, y + L.rowH - 4 - L.len]);
    });
    const dpr = Math.min(3, window.devicePixelRatio || 1), W = L.S + 2*L.padX, H = L.S + L.padTop + 8;
    const cv = this.cv; cv.width = Math.round(W*dpr); cv.height = Math.round(H*dpr);
    cv.style.width = W+"px"; cv.style.height = H+"px"; cv.style.left = (-L.padX)+"px"; cv.style.top = (-L.padTop)+"px";
    this.dpr = dpr; this.lift = t.map((_,i)=>i===this.sel ? 1 : 0);
    this.sync(); this.draw();
  },
  /* the slot buttons carry the state in words (for screen readers and the tests) */
  sync(){
    const names = ["red","orange","yellow","green","teal","blue","violet","pink","brown","grey"];
    this.st.tubes.forEach((z, i)=>{ const e = this.els[i]; if(!e) return;
      e.dataset.layers = z.length; e.classList.toggle("up", i===this.sel); e.classList.toggle("done", this.full(z));
      e.setAttribute("aria-label", "Tube "+(i+1)+": "+(z.length ? z.split("").map(c=>names[CS_LET.indexOf(c)]).join(", ")+" (top)" : "empty")); });
  },
  segs(z){ const out = []; for(const c of z){ const k = CS_LET.indexOf(c); if(out.length && out[out.length-1].c===k) out[out.length-1].v++; else out.push({c:k, v:1}); } return out; },

  /* ---------- drawing ---------- */
  draw(){
    const L = this.L, cv = this.cv, ctx = cv.getContext("2d"), now = performance.now(), a = this.anim, n = this.st.tubes.length;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.translate(L.padX, L.padTop);
    let busy = false;
    for(let i=0;i<n;i++){ const target = i===this.sel ? 1 : 0; this.lift[i] += (target - this.lift[i])*0.35; if(Math.abs(target - this.lift[i]) > 0.01) busy = true; else this.lift[i] = target; }
    const order = [...Array(n).keys()].filter(i=>!a || i!==a.a).concat(a ? [a.a] : []);   // the pouring tube is drawn on top
    let stream = null;
    for(const i of order){
      let P = [this.pos[i][0], this.pos[i][1] - 14*this.lift[i]], ang = 0, segs = this.segs(this.st.tubes[i]), wave = 0, slosh = 0;
      const fx = this.fx[i];
      if(fx){ const t = (now - fx.t0)/1000;
        if(fx.shake && t < 0.24){ P = [P[0] + 5*Math.sin(t*60)*(1 - t/0.24), P[1]]; busy = true; }
        if(fx.slosh && t < 1.2){ slosh = fx.slosh*Math.exp(-t*4.2)*Math.sin(t*17); busy = true; } }
      if(a && (i===a.a || i===a.b)){ const r = this.animFrame(a, now, i); P = r.P || P; ang = r.ang || 0; segs = r.segs; wave = r.wave || 0; slosh = r.slosh || slosh; if(r.stream) stream = r.stream; busy = true; }
      this.drawTube(ctx, i, P, ang, segs, wave, slosh, now);
    }
    if(stream) this.drawStream(ctx, stream);
    if(a && now >= a.tEnd) this.finishAnim(false);
    if(busy || this.anim){ cancelAnimationFrame(this.raf); this.raf = requestAnimationFrame(()=>this.draw()); }
  },
  tubePath(ctx, L, outer){
    const w = outer ? L.w/2 : L.w/2 - L.g, bot = outer ? L.len : L.len - L.g, cy = bot - w;
    ctx.beginPath(); ctx.moveTo(-w, 0); ctx.lineTo(-w, cy); ctx.arc(0, cy, w, Math.PI, 0, true); ctx.lineTo(w, 0);
  },
  drawTube(ctx, i, P, ang, segs, wave, slosh, now){
    const L = this.L, C = this.C, wi = L.w - 2*L.g;
    const hintOn = this.hinted && (this.hinted[0]===i || this.hinted[1]===i), done = this.full(this.st.tubes[i]) && !(this.anim && (this.anim.b===i || this.anim.a===i));
    ctx.save(); ctx.translate(P[0], P[1]); ctx.rotate(ang);
    // glass body
    if(hintOn){ ctx.save(); ctx.shadowColor = C.gold; ctx.shadowBlur = 16; this.tubePath(ctx, L, true); ctx.strokeStyle = C.gold; ctx.lineWidth = 4; ctx.stroke(); ctx.restore(); }
    this.tubePath(ctx, L, true); ctx.fillStyle = this.mix(C.cell, C.gold, 0.06); ctx.fill();
    ctx.restore();
    // liquid, computed in the world frame so its surface is level
    if(segs.length){
      const c0 = [P[0], P[1] + L.len/2], g = slosh;               // slosh tips the "gravity" a little after a bump
      const world = this.inner.map(p=>{ const q = this.rot(p, ang); return this.rot([q[0]+P[0], q[1]+P[1]], -g, c0); });
      let cum = 0, prevY = Infinity; const bands = [];
      for(const s of segs){ cum += s.v; const Y = this.levelFor(world, cum*this.unitA); bands.push({c:s.c, top:Y, bot:prevY, v:s.v}); prevY = Y; }
      ctx.save(); ctx.translate(c0[0], c0[1]); ctx.rotate(g); ctx.translate(-c0[0], -c0[1]);
      bands.forEach((bd, k)=>{
        let poly = this.clipY(world, bd.top, true); if(bd.bot !== Infinity) poly = this.clipY(poly, bd.bot, false);
        if(poly.length < 3) return;
        const col = C.liq[bd.c], ax = this.rot([1,0], ang), cx = P[0], cy = P[1] + L.len/2;
        const gr = ctx.createLinearGradient(cx - ax[0]*wi/2, cy - ax[1]*wi/2, cx + ax[0]*wi/2, cy + ax[1]*wi/2);
        gr.addColorStop(0, this.mix(col, "#000", 0.22)); gr.addColorStop(0.3, col); gr.addColorStop(0.48, this.mix(col, "#fff", 0.18)); gr.addColorStop(0.68, col); gr.addColorStop(1, this.mix(col, "#000", 0.2));
        ctx.beginPath(); poly.forEach((p, j)=> j ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); ctx.fillStyle = gr; ctx.fill();
        if(k === bands.length-1){            // the surface: a lighter skin, with ripples while liquid lands
          const xs = poly.filter(p=>Math.abs(p[1]-bd.top) < 0.6).map(p=>p[0]); if(xs.length >= 2){
            const x0 = Math.min(...xs), x1 = Math.max(...xs); ctx.beginPath();
            for(let x = x0; x <= x1; x += 2){ const y = bd.top + wave*Math.sin((x - x0)*0.45 + now*0.03)*Math.sin(Math.PI*(x - x0)/(x1 - x0 || 1)); x===x0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
            ctx.strokeStyle = this.mix(col, "#fff", 0.42); ctx.lineWidth = 2.6; ctx.lineCap = "round"; ctx.stroke(); } }
        if(Math.abs(ang) < 0.02 && Math.abs(g) < 0.02 && Math.abs(bd.v - Math.round(bd.v)) < 1e-3 && (k < bands.length-1 || !wave)) this.drawMarks(ctx, bd, P);
      });
      ctx.restore();
    }
    // glass front: shine, outline, rim, cap
    ctx.save(); ctx.translate(P[0], P[1]); ctx.rotate(ang);
    ctx.fillStyle = "rgba(255,255,255,.34)"; ctx.beginPath(); ctx.roundRect(-wi/2 + wi*0.14, L.len*0.08, wi*0.13, L.len*0.72, wi*0.07); ctx.fill();
    this.tubePath(ctx, L, true); ctx.strokeStyle = this.mix(C.ink, C.cell, 0.25); ctx.lineWidth = L.g; ctx.stroke();
    ctx.beginPath(); ctx.roundRect(-L.w/2 - 5, -3, L.w + 10, 5, 2.5); ctx.fillStyle = this.mix(C.ink, C.cell, 0.25); ctx.fill();
    if(done){ const f = this.fx[i], t = f && f.cap ? Math.min(1, (now - f.cap)/220) : 1, e = 1 - Math.pow(1 - t, 3);
      ctx.globalAlpha = e; ctx.beginPath(); ctx.roundRect(-L.w/2 - 6, -12 - 16*(1 - e), L.w + 12, 11, [5,5,2,2]); ctx.fillStyle = C.gold; ctx.fill(); ctx.globalAlpha = 1;
      if(f && f.cap && now - f.cap < 700){ const gl = 1 - (now - f.cap)/700; ctx.save(); ctx.globalAlpha = gl*0.55; ctx.shadowColor = C.gold; ctx.shadowBlur = 22; this.tubePath(ctx, L, true); ctx.strokeStyle = C.gold; ctx.lineWidth = 3; ctx.stroke(); ctx.restore(); } }
    ctx.restore();
  },
  drawMarks(ctx, bd, P){        // each layer keeps a faint symbol, so colour is never the only clue
    const L = this.L, C = this.C, bot = bd.bot === Infinity ? P[1] + L.len - L.g : bd.bot, step = (bot - bd.top)/bd.v, s = Math.min(L.w*0.2, step*0.26);
    ctx.save(); ctx.fillStyle = C.mark; ctx.strokeStyle = C.mark; ctx.lineWidth = Math.max(1.6, s*0.32); ctx.lineCap = "round";
    for(let u=0;u<bd.v;u++){ const x = P[0], y = bd.top + step*(u + 0.55); ctx.beginPath();
      switch(bd.c){
        case 0: ctx.arc(x, y, s*0.8, 0, 7); ctx.fill(); break;
        case 1: ctx.arc(x, y, s*0.85, 0, 7); ctx.stroke(); break;
        case 2: ctx.moveTo(x - s*1.3, y); ctx.lineTo(x + s*1.3, y); ctx.stroke(); break;
        case 3: ctx.moveTo(x - s, y); ctx.lineTo(x + s, y); ctx.moveTo(x, y - s); ctx.lineTo(x, y + s); ctx.stroke(); break;
        case 4: ctx.moveTo(x, y - s*1.3); ctx.lineTo(x, y + s*1.3); ctx.stroke(); break;
        case 5: ctx.moveTo(x, y - s); ctx.lineTo(x + s, y + s*0.8); ctx.lineTo(x - s, y + s*0.8); ctx.closePath(); ctx.fill(); break;
        case 6: ctx.rect(x - s*0.85, y - s*0.85, s*1.7, s*1.7); ctx.stroke(); break;
        case 7: ctx.moveTo(x, y - s); ctx.lineTo(x + s, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s, y); ctx.closePath(); ctx.fill(); break;
        case 8: ctx.arc(x - s*0.7, y, s*0.5, 0, 7); ctx.moveTo(x + s*1.2, y); ctx.arc(x + s*0.7, y, s*0.5, 0, 7); ctx.fill(); break;
        default: ctx.moveTo(x - s, y - s); ctx.lineTo(x + s, y + s); ctx.moveTo(x + s, y - s); ctx.lineTo(x - s, y + s); ctx.stroke();
      } }
    ctx.restore();
  },

  /* ---------- the pour ----------
     1. lift and carry: the tube rises, swings over the target and tips until its liquid reaches the lip
     2. pour: it turns around its lip, just as fast as the liquid level needs; the stream falls under gravity,
        thick while the flow is strong and thin at the start and end, and lands in the target, which rises and ripples
     3. return: the tube rights itself and goes home, and both liquids slosh and settle */
  ease(t){ return t<0 ? 0 : t>1 ? 1 : t<0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3)/2; },
  pourEase(t){ return t<0 ? 0 : t>1 ? 1 : (1 - Math.cos(Math.PI*t))/2; },
  startPour(a, b, k, before){
    const L = this.L, now = performance.now(), dir = this.pos[b][0] >= this.pos[a][0] ? 1 : -1, wi = L.w - 2*L.g;
    const T1 = 260, T2 = 300 + 130*k, T3 = 280, vA0 = before[a].length*this.unitA;
    const lipT = [this.pos[b][0] - dir*(wi/2 - 4), this.pos[b][1] - 14];
    this.anim = {a, b, k, dir, c:CS_LET.indexOf(this.top(before[a])), segA:this.segs(before[a]), segB:this.segs(before[b]),
      t0:now, t1:now + T1, t2:now + T1 + T2, tEnd:now + T1 + T2 + T3, vA0, lipT, home:[this.pos[a][0], this.pos[a][1] - 14*this.lift[a]], emits:[]};
    this.anim.fall = Math.sqrt(2*Math.max(20, (this.pos[b][1] + L.len*0.6) - lipT[1])/5200)*1000;
    this.anim.tEnd += Math.max(0, this.anim.fall - T3 + 120);
    cancelAnimationFrame(this.raf); this.raf = requestAnimationFrame(()=>this.draw());
  },
  pivot(a, ang){ const wi = this.L.w - 2*this.L.g, lip = this.rot([a.dir*wi/2, 3], ang); return [a.lipT[0] - lip[0], a.lipT[1] - lip[1]]; },
  pouredAt(a, t){ return t <= a.t1 ? 0 : t >= a.t2 ? a.k : a.k*this.pourEase((t - a.t1)/(a.t2 - a.t1)); },
  animFrame(a, now, i){
    const L = this.L, U = this.unitA, out = {};
    const take = (segs, v) => { const s = segs.map(x=>({c:x.c, v:x.v})); let r = v; while(r > 1e-6 && s.length){ const t = s[s.length-1], d = Math.min(t.v, r); t.v -= d; r -= d; if(t.v <= 1e-6) s.pop(); } return s; };
    const add = (segs, c, v) => { const s = segs.map(x=>({c:x.c, v:x.v})); if(v <= 1e-6) return s; if(s.length && s[s.length-1].c===c) s[s.length-1].v += v; else s.push({c, v}); return s; };
    const poured = this.pouredAt(a, now);
    if(i === a.a){
      out.segs = take(a.segA, poured);
      const vol = a.vA0 - poured*U, tiltNow = a.dir*this.tiltFor(vol);
      if(now < a.t1){ const u = this.ease((now - a.t0)/(a.t1 - a.t0)), start = a.dir*this.tiltFor(a.vA0)*0.92, end = this.pivot(a, start);
        out.ang = start*u; const arc = -26*Math.sin(Math.PI*u);
        out.P = [a.home[0] + (end[0] - a.home[0])*u, a.home[1] + (end[1] - a.home[1])*u + arc]; }
      else if(now < a.t2){ out.ang = tiltNow; out.P = this.pivot(a, tiltNow); }
      else { const u = this.ease((now - a.t2)/(a.tEnd - a.t2 - Math.max(0, a.fall - 160))), from = a.dir*this.tiltFor(a.vA0 - a.k*U), p0 = this.pivot(a, from);
        const uu = Math.min(1, u); out.ang = from*(1 - uu); out.P = [p0[0] + (a.home[0] - p0[0])*uu, p0[1] + (a.home[1] - p0[1])*uu - 18*Math.sin(Math.PI*uu)];
        if(uu >= 1){ const t = (now - a.t2)/1000 - 0.28; out.slosh = -a.dir*0.12*Math.exp(-t*5)*Math.sin(t*16); } }
      // the stream: parcels leave the lip and fall; each is drawn where it is now
      if(now >= a.t1){
        const last = a.emits.length ? a.emits[a.emits.length-1].t : a.t1;
        for(let e = last + 8; e <= Math.min(now, a.t2); e += 8){ const q = (this.pouredAt(a, e) - this.pouredAt(a, e - 8))/8*1000/a.k;   // flow, 0..~1.6
          const ang = a.dir*this.tiltFor(a.vA0 - this.pouredAt(a, e)*U), wi = L.w - 2*L.g, lip = this.rot([a.dir*wi/2, 3], ang), P = this.pivot(a, ang);
          a.emits.push({t:e, x:P[0] + lip[0], y:P[1] + lip[1], q}); }
        out.stream = {a, now};
      }
    } else {
      const fall = a.fall, got = this.pouredAt(a, now - fall);
      out.segs = add(a.segB, a.c, got);
      const flowing = now - fall > a.t1 && now - fall < a.t2, after = (now - fall - a.t2)/1000;
      out.wave = flowing ? 2.4 : after > 0 && after < 0.8 ? 2.4*Math.exp(-after*5) : 0;
      if(after > 0 && after < 1.2) out.slosh = a.dir*0.07*Math.exp(-after*4)*Math.sin(after*15);
    }
    return out;
  },
  drawStream(ctx, st){
    const a = st.a, now = st.now, L = this.L, G = 5200, col = this.C.liq[a.c];
    const tops = this.surfaceOf(a.b, now);           // the target's liquid surface, where the stream disappears
    const pts = [];
    for(const e of a.emits){ const tau = (now - e.t)/1000; if(tau < 0) continue;
      const x = e.x + a.dir*(10 + 30*e.q)*tau, y = e.y + 0.5*G*tau*tau + 30*tau;
      if(y > tops) continue; pts.push([x, y, Math.max(0, Math.min(1.4, e.q))]); }
    if(pts.length < 2) return;
    ctx.save(); ctx.lineCap = "round"; ctx.lineJoin = "round";
    for(let j=1;j<pts.length;j++){ const p = pts[j-1], q = pts[j], wq = 2.6 + 4.6*Math.min(p[2], q[2]);
      if(Math.hypot(q[0]-p[0], q[1]-p[1]) > 40) continue;
      ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.strokeStyle = col; ctx.lineWidth = wq; ctx.stroke();
      ctx.strokeStyle = this.mix(col, "#fff", 0.35); ctx.lineWidth = Math.max(0.8, wq*0.28); ctx.stroke(); }
    // a few drops jump where the stream lands
    const land = pts.reduce((m, p)=>p[1] > m[1] ? p : m, pts[0]);
    if(tops - land[1] < 12 && now < a.t2 + a.fall){ ctx.fillStyle = col;
      for(let d=0; d<4; d++){ const ph = ((now*0.004 + d*0.27) % 1), dx = (d%2 ? 1 : -1)*(3 + 7*ph)*(1 + d*0.2), dy = -14*ph*(1 - ph)*4*(0.6 + 0.2*d);
        ctx.globalAlpha = 1 - ph; ctx.beginPath(); ctx.arc(land[0] + dx, tops + dy, 1.4 + 0.6*(1 - ph), 0, 7); ctx.fill(); } }
    ctx.restore();
  },
  surfaceOf(i, now){
    const L = this.L, a = this.anim; let segs = this.segs(this.st.tubes[i]);
    if(a && i === a.b) segs = this.animFrame(a, now, i).segs;
    const v = segs.reduce((s, x)=>s + x.v, 0), world = this.inner.map(p=>[p[0] + this.pos[i][0], p[1] + this.pos[i][1]]);
    return v ? this.levelFor(world, v*this.unitA) : this.pos[i][1] + L.len - L.g;
  },
  finishAnim(silent){
    const a = this.anim; if(!a) return; this.anim = null;
    if(!silent){ const now = performance.now(); this.fx[a.b] = Object.assign(this.fx[a.b] || {}, {t0:now, slosh:a.dir*0.05}); }
  },
  reduced(){ try{ return matchMedia("(prefers-reduced-motion: reduce)").matches; }catch(e){ return false; } },

  /* ---------- play ---------- */
  hud(){
    const s = this.st; UL.setStat("Moves <b>"+s.moves+"</b> · par "+s.par);
    const left = UL.isPro() ? "∞" : Math.max(0, this.FREE_UNDOS - s.undosUsed);
    this.undoBtn.setLabel("Undo "+left); this.undoBtn.classList.toggle("dim", !s.undo.length || left===0);
    this.extraBtn.setLabel(s.extra ? "Extra tube used" : "Extra tube"); this.extraBtn.classList.toggle("dim", s.extra);
    const hl = UL.isPro() ? "∞" : Math.max(0, this.FREE_HINTS - s.hintsUsed);
    this.hintBtn.setLabel("Hint "+hl); this.hintBtn.classList.toggle("dim", hl===0);
  },
  shakeTube(i){ this.fx[i] = Object.assign(this.fx[i] || {}, {t0:performance.now(), shake:1}); this.draw(); },
  tapTube(i){
    if(UL.paused()) return;
    const s = this.st; this.clearHint();
    if(this.anim && (i === this.anim.a || i === this.anim.b)) this.finishAnim(false);   // a tube still pouring finishes at once
    if(this.sel < 0){
      if(!s.tubes[i].length || this.full(s.tubes[i])){ this.shakeTube(i); UL.buzz("err"); return; }
      this.sel = i; this.sync(); UL.buzz("tap"); this.draw(); return;
    }
    const a = this.sel; this.sel = -1;
    if(a === i){ this.sync(); UL.buzz("tap"); this.draw(); return; }
    const k = this.canPour(s.tubes, a, i);
    if(!k){ this.sync(); this.shakeTube(i); UL.buzz("err"); return; }
    this.move(a, i, k);
  },
  move(a, b, k){
    const s = this.st, before = s.tubes.slice();
    if(this.anim) this.finishAnim(false);
    s.undo.push(s.tubes.slice()); if(s.undo.length > 60) s.undo.shift();
    s.tubes = this.pour(s.tubes, a, b); s.moves++;
    this.sync();
    if(this.reduced()) this.draw(); else this.startPour(a, b, k, before);
    UL.buzz("tap");
    if(this.full(s.tubes[b])){
      s.done++; s.recent.push(s.moves); s.recent = s.recent.filter(m=>s.moves - m < 3);
      const el = this.els[b], when = this.anim ? this.anim.t2 + this.anim.fall - performance.now() : 0;
      setTimeout(()=>{ this.fx[b] = Object.assign(this.fx[b] || {}, {cap:performance.now()}); this.draw(); UL.buzz("act");
        if(!this.solved(s.tubes)) UL.praise(el, s.recent.length >= 2 ? 2 : 1); }, Math.max(0, when));
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
      if(expertish && s.moves <= s.par && s.undosUsed===0 && s.hintsUsed===0) UL.praise(el, 4);   // par is the shortest possible solution
      else if(s.moves <= s.par && s.hintsUsed===0) UL.praise(el, 3);
      else UL.milestone(el, "Sorted!");
    }, 260);
    UL.end({won:true, title:"Sorted", line:"Sorted in "+s.moves+" moves (par "+s.par+")"});
  },
  /* Hint: solve from the board as it stands now and show the first pour of the shortest finish */
  hint(){
    if(UL.paused()) return;
    const s = this.st;
    if(!UL.isPro() && s.hintsUsed >= this.FREE_HINTS){ UL.requirePro("Free games include "+this.FREE_HINTS+" hints. Pro is unlimited."); return; }
    const sol = this.solve(s.tubes);
    if(!sol){ UL.toast("There is no way to finish from here. Undo a few pours or restart."); UL.buzz("err"); return; }
    if(!sol.length) return;
    const [a, b] = sol[0]; s.hintsUsed++;
    this.sel = -1; this.clearHint(); this.hinted = [a, b];
    const tag = (i, t)=>{ const g = document.createElement("span"); g.className = "cs-tag"; g.innerHTML = '<b class="cs-pill">'+t+'</b>'; g.style.left = this.els[i].style.left; g.style.width = this.els[i].style.width;
      g.style.top = (this.pos[i][1] - 30)+"px"; this.box.appendChild(g); };
    tag(a, "pour this"); tag(b, "into here");
    this.sync(); UL.buzz("tap"); this.hud(); UL.save(); this.draw();
  },
  clearHint(){
    if(!this.hinted) return; this.hinted = null;
    this.box.querySelectorAll(".cs-tag").forEach(e=>e.remove()); this.draw();
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
  },
  bind(){
    this.box.addEventListener("pointerup", e=>{ const slot = e.target.closest(".cs-slot"); if(slot) this.tapTube(+slot.dataset.i); });
    if(this.bound) return; this.bound = true;
    document.addEventListener("keydown", e=>{ if(!this.st || document.activeElement.tagName === "INPUT") return;
      const d = "1234567890-=".indexOf(e.key); if(d >= 0 && d < this.st.tubes.length) this.tapTube(d); });
    window.addEventListener("resize", ()=>{ if(this.st && this.box) this.render(); });
  },
  onPause(){ this.finishAnim(true); if(this.box) this.draw(); },
  onPro(){ if(this.undoBtn) this.hud(); }
};
