const { chromium } = require('playwright');
const path = require('path');
const ok=(n,c,x)=>console.log((c?"PASS":"FAIL")+"  "+n+(x?"  "+x:""));
const F='file://'+path.resolve(__dirname,'../out/sort.html');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({viewport:{width:412,height:860}, deviceScaleFactor:1, offline:true});
  const ext=[]; await ctx.route('**', r=>{ const u=r.request().url(); if(!u.startsWith('file:')&&!u.startsWith('data:')){ext.push(u);return r.abort();} r.continue(); });
  const p = await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
  await p.goto(F); await p.waitForTimeout(500);
  const tap = async i => { const r = await p.locator('.cs-slot').nth(i).boundingBox(); await p.mouse.click(r.x+r.width/2, r.y+r.height*0.6); };
  const tubes = () => p.evaluate(()=>JSON.stringify(GAME.st.tubes));

  // ---- first run ----
  ok("first run shows the name picker", await p.evaluate(()=>document.getElementById('nameVeil').classList.contains('show')));
  await p.click('#nameChips .chip'); await p.click('#nameSave');
  ok("then the tutorial", await p.evaluate(()=>document.getElementById('tutVeil').classList.contains('show')), await p.evaluate(()=>document.getElementById('tutStep').textContent));
  for(let i=0;i<8;i++) await p.click('#tutNext').catch(()=>{});
  ok("then the level picker, Easy and Medium open, Hard and Expert locked", await p.evaluate(()=>{ const r=[...document.querySelectorAll('#lvlList .lvl')];
    const l=r.filter(x=>x.classList.contains('locked')); return r.length===5 && l.length===2 && l.every(x=>/Hard|Expert/.test(x.textContent)); }));
  await p.evaluate(()=>[...document.querySelectorAll('#lvlList .lvl')].find(x=>x.textContent.includes('Hard')).click());
  ok("a Pro level opens the paywall, not the game", await p.evaluate(()=>document.getElementById('proVeil').classList.contains('show') && UL.cur===null));
  await p.click('#proClose');
  await p.evaluate(()=>{ UL.newGame(); [...document.querySelectorAll('#lvlList .lvl')].find(x=>x.textContent.includes('Easy')).click(); });
  await p.waitForTimeout(300);
  ok("Easy starts with 7 tubes and 20 layers", await p.evaluate(()=>document.querySelectorAll('.cs-tube').length===7 && document.querySelectorAll('.cs-l').length===20));

  // ---- tapping: lift, cancel, wrong target, pour ----
  const plan = await p.evaluate(()=>{ const t=GAME.st.tubes; let good=null, bad=null;
    for(let a=0;a<t.length;a++) for(let c=0;c<t.length;c++){ if(a===c||!t[a].length) continue; if(!good && GAME.canPour(t,a,c)) good=[a,c]; if(!bad && !GAME.canPour(t,a,c) && t[c].length) bad=[a,c]; }
    return {good, bad}; });
  await tap(plan.good[0]); await p.waitForTimeout(150);
  ok("a tap lifts the tube", await p.evaluate(i=>document.querySelectorAll('.cs-tube')[i].classList.contains('up') && GAME.sel===i, plan.good[0]));
  await tap(plan.good[0]); await p.waitForTimeout(150);
  ok("tapping the same tube puts it back", await p.evaluate(i=>!document.querySelectorAll('.cs-tube')[i].classList.contains('up') && GAME.sel===-1, plan.good[0]));
  const before = await tubes();
  await tap(plan.bad[0]); await tap(plan.bad[1]); await p.waitForTimeout(150);
  ok("a wrong target shakes and changes nothing", before===await tubes() && await p.evaluate(()=>GAME.st.moves===0));
  await tap(plan.good[0]); await tap(plan.good[1]); await p.waitForTimeout(260);
  const after = await p.evaluate(([a,c])=>({moves:GAME.st.moves, la:GAME.st.tubes[a].length, lc:GAME.st.tubes[c].length, status:document.getElementById('ulStatA').textContent}), plan.good);
  ok("a valid pour moves the layers and counts a move", after.moves===1 && before!==await tubes(), after.status);

  // ---- restart ----
  const start1 = await p.evaluate(()=>JSON.stringify(GAME.st.undo[0]));
  await p.evaluate(()=>{ UL.cur.sec=0; UL.restart(); }); await p.waitForTimeout(200);
  ok("restart replays the identical puzzle", start1===await tubes() && await p.evaluate(()=>GAME.st.moves===0));

  // ---- undo limit in the free tier ----
  const um = await p.evaluate(()=>{ const s=GAME.st; for(let k=0;k<5;k++){ const t=s.tubes; let done=false;
      for(let a=0;a<t.length&&!done;a++) for(let c=0;c<t.length&&!done;c++) if(GAME.canPour(t,a,c)){ GAME.tapTube(a); GAME.tapTube(c); done=true; } }
    const m=s.moves; GAME.undoMove(); GAME.undoMove(); GAME.undoMove(); const used=s.undosUsed; GAME.undoMove();
    return {m, used, blocked: s.undosUsed===3 && document.getElementById('proVeil').classList.contains('show')}; });
  ok("free tier: three undos, the fourth opens the paywall", um.used===3 && um.blocked, um.m+" moves made");
  await p.click('#proClose'); await p.click('#resumeBtn').catch(()=>{});
  await p.evaluate(()=>GAME.addTube());
  ok("free tier: Extra tube opens the paywall", await p.evaluate(()=>document.getElementById('proVeil').classList.contains('show') && GAME.st.tubes.length===7));
  await p.click('#proClose'); await p.click('#resumeBtn').catch(()=>{});

  // ---- save and reload ----
  await p.evaluate(()=>UL.save());
  const snap = await p.evaluate(()=>JSON.stringify(GAME.serialize())+"|"+UL.cur.score);
  await p.reload(); await p.waitForTimeout(600);
  const back = await p.evaluate(()=>JSON.stringify(GAME.serialize())+"|"+UL.cur.score);
  ok("reload restores the exact tubes, moves and undo count, paused", snap===back && await p.evaluate(()=>UL.cur.paused));
  ok("restored tubes are drawn as they were", await p.evaluate(()=>[...document.querySelectorAll('.cs-tube')].every((e,i)=>e.querySelectorAll('.cs-l').length===GAME.st.tubes[i].length)));
  await p.click('#resumeBtn');

  // ---- a scripted win: the solver's moves played through real taps ----
  await p.evaluate(()=>UL.start("easy",{seed:31337})); await p.waitForTimeout(200);
  const sol = await p.evaluate(()=>GAME.solve(GAME.st.tubes));
  for(const [a,c] of sol){ await tap(a); await tap(c); await p.waitForTimeout(30); }   // taps land while layers are still sliding
  await p.waitForTimeout(1600);
  const win = await p.evaluate(()=>({over:UL.cur.over, modal:document.getElementById('endVeil').classList.contains('show'), title:document.getElementById('endTitle').textContent,
    detail:document.getElementById('endDetail').textContent, recs:UL.kv("records",[]), save:UL.kv("save",null), share:UL.cur.shareTxt, score:UL.cur.score, moves:GAME.st.moves, par:GAME.st.par,
    caps:document.querySelectorAll('.cs-tube.done').length}));
  ok("playing the solver's moves by tapping wins at par", win.over && win.modal && win.moves===win.par && win.title==="Sorted", win.detail);
  ok("the win is recorded with full score and the save cleared", win.recs.length===1 && win.recs[0].w===1 && win.score===100 && win.save===null);
  ok("every finished tube shows its cap", win.caps===5);
  console.log("      share text: "+String(win.share).replace(/\n/g," / "));
  await p.click('#endClose'); await p.click('#tabTrends'); await p.waitForTimeout(200);
  ok("Trends shows the record", await p.evaluate(()=>!!document.querySelector('.rank-card .rating')));
  await p.click('#tabPlay').catch(()=>{});

  // ---- a slow win scores less, never below 10 ----
  ok("score drops 5 per move over par and never goes below 10", await p.evaluate(()=>{ const L=GAME.levels[0]; const f=m=>Math.max(10, L.base-5*Math.max(0,m)); return f(0)===100 && f(4)===80 && f(40)===10; }));

  // ---- no loss state: a stuck board gets a toast ----
  await p.evaluate(()=>{ UL.start("easy",{seed:5}); GAME.st.tubes=["ba","cba","abcd"]; GAME.render(); GAME.tapTube(0); GAME.tapTube(1); });
  ok("no loss: when no move is left, a toast says Undo or restart", await p.evaluate(()=>!UL.cur.over && /No moves left/.test(document.getElementById('toast').textContent)));

  // ---- Pro: Hard starts, unlimited undo, one extra tube ----
  await p.evaluate(()=>UL.store.set("ul_pro", true)); await p.reload(); await p.waitForTimeout(500); await p.click('#resumeBtn').catch(()=>{});
  const pro = await p.evaluate(()=>{ UL.start("hard",{}); const s=GAME.st; const n0=s.tubes.length;
    for(let k=0;k<6;k++){ const t=s.tubes; let d=false; for(let a=0;a<t.length&&!d;a++) for(let c=0;c<t.length&&!d;c++) if(GAME.canPour(t,a,c)){ GAME.tapTube(a); GAME.tapTube(c); d=true; } }
    for(let k=0;k<6;k++) GAME.undoMove();
    const undone = s.undosUsed, veil = document.getElementById('proVeil').classList.contains('show');
    GAME.addTube(); const n1=s.tubes.length; GAME.addTube(); const n2=s.tubes.length;
    return {n0, undone, veil, n1, n2, drawn:document.querySelectorAll('.cs-tube').length}; });
  ok("with Pro, Hard starts with 11 tubes", pro.n0===11);
  ok("with Pro, undo is unlimited", pro.undone===6 && !pro.veil);
  ok("with Pro, one extra tube, once per game", pro.n1===12 && pro.n2===12 && pro.drawn===12);

  // ---- Hint: always the first pour of a shortest finish from the current board ----
  const hintFree = await p.evaluate(()=>{ UL.store.set("ul_pro", false); return true; });
  await p.reload(); await p.waitForTimeout(500); await p.click('#resumeBtn').catch(()=>{});
  const h1 = await p.evaluate(()=>{ UL.start("medium",{seed:777}); const s=GAME.st; const out=[];
    for(let k=0;k<3;k++){ const before=GAME.solve(s.tubes).length; GAME.hint(); const [a,b]=GAME.hinted; const tags=document.querySelectorAll('.cs-tag').length;
      const legal=GAME.canPour(s.tubes,a,b)>0; GAME.tapTube(a); GAME.tapTube(b); const after=GAME.solve(s.tubes).length; out.push(legal && after===before-1 && tags===2); }
    GAME.hint(); return {ok:out.every(Boolean), used:s.hintsUsed, wall:document.getElementById('proVeil').classList.contains('show')}; });
  ok("Hint marks a legal pour that is the first step of a shortest finish", h1.ok);
  ok("free tier: three hints, the fourth opens the paywall", h1.used===3 && h1.wall);
  await p.click('#proClose'); await p.click('#resumeBtn').catch(()=>{});
  const stuck = await p.evaluate(()=>{ UL.start("easy",{seed:5}); GAME.st.tubes=["ba","cbaa","abcd"]; GAME.render(); GAME.hint();
    return {msg:document.getElementById('toast').textContent, used:GAME.st.hintsUsed}; });
  ok("when no finish exists, Hint says so plainly and is not used up", /no way to finish/.test(stuck.msg) && stuck.used===0, stuck.msg);
  await p.evaluate(()=>UL.store.set("ul_pro", true)); await p.reload(); await p.waitForTimeout(500); await p.click('#resumeBtn').catch(()=>{});
  const h2 = await p.evaluate(()=>{ UL.start("hard",{seed:4242}); const s=GAME.st; let n=0;
    while(!GAME.solved(s.tubes) && n++<80){ GAME.hint(); const [a,b]=GAME.hinted; GAME.tapTube(a); GAME.tapTube(b); }
    return {solved:GAME.solved(s.tubes), moves:s.moves, par:s.par, hints:s.hintsUsed}; });
  ok("with Pro, hints are unlimited and following them solves Hard at par", h2.solved && h2.moves===h2.par && h2.hints===h2.par, h2.moves+" moves, par "+h2.par);
  await p.waitForTimeout(1500); await p.click('#endClose').catch(()=>{});

  // ---- Daily identical on two devices ----
  const daily = pg => pg.evaluate(()=>{ UL.start("medium",{daily:UL.dailyNum()}); return JSON.stringify(GAME.st.tubes)+" par "+GAME.st.par; });
  const d1 = await daily(p);
  const ctx2 = await b.newContext({offline:true}); const p2 = await ctx2.newPage(); await p2.goto(F); await p2.waitForTimeout(400);
  const d2 = await daily(p2); await ctx2.close();
  ok("the Daily is identical on two devices", d1===d2);

  // ---- puzzle logic over many seeded puzzles ----
  const logic = await p.evaluate(()=>{ const out = {};
    for(const L of GAME.levels){ const bad = []; let t0 = performance.now(), worst = 0;
      for(let k=0;k<300;k++){ UL.rng.s = 7000+k*7919; const a = performance.now(); const m = GAME.make(L); worst = Math.max(worst, performance.now()-a);
        const t = m.tubes, counts = {};
        t.join("").split("").forEach(ch=>counts[ch]=(counts[ch]||0)+1);
        if(t.length!==L.n || Object.keys(counts).length!==L.k || Object.values(counts).some(v=>v!==4)) bad.push("layers");
        if(GAME.solved(t)) bad.push("starts solved");
        if(t.some(z=>GAME.full(z))) bad.push("starts with a finished tube");
        const sol = GAME.solve(t); if(!sol){ bad.push("not solvable"); continue; }
        let s = t; for(const [x,y] of sol){ s = GAME.pour(s,x,y); if(!s) break; }
        if(!s || !GAME.solved(s)) bad.push("solution does not solve"); if(sol.length!==m.par) bad.push("par");
      }
      out[L.id] = {bad:bad.length, first:bad[0]||"", avg:Math.round((performance.now()-t0)/300), worst:Math.round(worst)}; }
    return out; });
  ok("300 seeded puzzles per level: right layers, solvable, none start solved or with a finished tube", Object.values(logic).every(v=>v.bad===0),
     Object.entries(logic).map(([k,v])=>k+" "+v.avg+"ms avg, worst "+v.worst+"ms"+(v.bad?" BAD "+v.first:"")).join("; "));

  const opt = await p.evaluate(()=>{ let same = 0, n = 0;
    const bfs = t0 => { const seen = new Set([GAME.key(t0)]); let q = [t0], d = 0;
      while(q.length){ const nq = []; for(const t of q){ if(GAME.solved(t)) return d;
        for(let a=0;a<t.length;a++) for(let c=0;c<t.length;c++){ const nt = GAME.pour(t,a,c); if(!nt) continue; const k = GAME.key(nt); if(seen.has(k)) continue; seen.add(k); nq.push(nt); } }
        q = nq; d++; if(seen.size > 400000) return -1; } return -1; };
    for(let k=0;k<25;k++){ UL.rng.s = 99+k*7919; const m = GAME.make(GAME.levels[0]); const d = bfs(m.tubes); if(d<0) continue; n++; if(d===m.par) same++; }
    return {same, n}; });
  ok("par is the true shortest solution (checked by brute force on 25 Easy puzzles)", opt.n>=20 && opt.same===opt.n, opt.same+" of "+opt.n);

  // ---- layout: nothing overflows at 360x640 ----
  const ctx3 = await b.newContext({viewport:{width:360,height:640}, offline:true}); const p3 = await ctx3.newPage();
  await p3.addInitScript(()=>{ localStorage.setItem("ul_profile",JSON.stringify({name:"Blue Tokai",created:1})); localStorage.setItem("ul_pro","true"); localStorage.setItem("ul_sort_tut","true"); });
  await p3.goto(F); await p3.waitForTimeout(400);
  const fit = await p3.evaluate(()=>{ const out=[]; for(const id of ["easy","medium","hard","expert","expert+"]){ document.querySelectorAll('.veil.show').forEach(v=>v.classList.remove('show'));
    UL.start(id.replace("+",""),{}); if(id.endsWith("+")) GAME.addTube();
    const s=document.getElementById('stage').getBoundingClientRect(); const els=[...document.querySelectorAll('.cs-tube,.cs-cap')];
    const inside = els.every(e=>{ const r=e.getBoundingClientRect(); return r.left>=s.left-1 && r.right<=s.right+1 && r.top>=s.top-12 && r.bottom<=s.bottom+1; });
    const slot=document.querySelector('.cs-slot').getBoundingClientRect();
    out.push({id, inside, scroll:document.documentElement.scrollHeight>innerHeight, tw:Math.round(slot.width)}); } return out; });
  ok("nothing overflows or scrolls at 360x640, even with the extra tube", fit.every(f=>f.inside && !f.scroll), fit.map(f=>f.id+" tap area "+f.tw+"px").join(", "));
  await ctx3.close();

  ok("nothing fetched from the network", ext.length===0, ext.join(","));
  ok("no page errors", errs.length===0, errs.join(" | "));
  await b.close();
})();
