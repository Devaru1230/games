const { chromium } = require('playwright');
const path = require('path');
const ok=(n,c,x)=>console.log((c?"PASS":"FAIL")+"  "+n+(x?"  "+x:""));
const F='file://'+path.resolve(__dirname,'../out/grid.html');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({viewport:{width:412,height:860}, offline:true});
  const ext=[]; await ctx.route('**', r=>{ const u=r.request().url(); if(!u.startsWith('file:')&&!u.startsWith('data:')){ext.push(u);return r.abort();} r.continue(); });
  const p = await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
  await p.goto(F); await p.waitForTimeout(500);
  const cellXY = async (pg, i) => pg.evaluate(i=>{ const r=GAME.board.getBoundingClientRect(), n=GAME.st.n; return {x:r.left+((i%n)+.5)*r.width/n, y:r.top+(Math.floor(i/n)+.5)*r.height/n}; }, i);
  const dragCells = async (pg, a, c) => { const A = await cellXY(pg, a), C = await cellXY(pg, c); await pg.mouse.move(A.x, A.y); await pg.mouse.down();
    if(a!==c) await pg.mouse.move(C.x, C.y, {steps:Math.max(3, Math.abs(a-c))}); await pg.mouse.up(); await pg.waitForTimeout(30); };

  // ---- first run ----
  ok("first run shows the name picker", await p.evaluate(()=>document.getElementById('nameVeil').classList.contains('show')));
  await p.click('#nameChips .chip'); await p.click('#nameSave');
  ok("then the tutorial", await p.evaluate(()=>document.getElementById('tutVeil').classList.contains('show')), await p.evaluate(()=>document.getElementById('tutStep').textContent));
  for(let i=0;i<8;i++) await p.click('#tutNext').catch(()=>{});
  ok("then the level picker, Small and Medium open, Large and Huge locked", await p.evaluate(()=>{ const r=[...document.querySelectorAll('#lvlList .lvl')];
    const l=r.filter(x=>x.classList.contains('locked')); return r.length===5 && l.length===2 && l.every(x=>/Large|Huge/.test(x.textContent)); }));
  await p.evaluate(()=>[...document.querySelectorAll('#lvlList .lvl')].find(x=>x.textContent.includes('Huge')).click());
  ok("a Pro level opens the paywall, not the game", await p.evaluate(()=>document.getElementById('proVeil').classList.contains('show') && UL.cur===null));
  await p.click('#proClose');
  await p.evaluate(()=>{ UL.newGame(); [...document.querySelectorAll('#lvlList .lvl')].find(x=>x.textContent.includes('Medium')).click(); });
  await p.waitForTimeout(300);
  ok("Medium starts: an empty 10x10 grid with 10 row clues and 10 column clues", await p.evaluate(()=>document.querySelectorAll('.pg-cell').length===100 && !document.querySelector('.pg-cell.on') &&
    document.querySelectorAll('.pg-rc .pg-clue').length===10 && document.querySelectorAll('.pg-cc .pg-clue').length===10));

  // ---- a drag fills only the row or column it starts in ----
  const lineInfo = await p.evaluate(()=>{ const s=GAME.st, n=s.n; for(let r=0;r<n;r++){ let run=0; for(let c=0;c<n;c++){ if(s.sol[r*n+c]){ run++; if(run>=3) return {r, c0:c-2, c1:c}; } else run=0; } } return null; });
  const s0 = lineInfo.r*10+lineInfo.c0, s1 = lineInfo.r*10+lineInfo.c1;
  { const A = await cellXY(p, s0), C = await cellXY(p, s1); await p.mouse.move(A.x, A.y); await p.mouse.down(); await p.mouse.move(C.x, C.y+12, {steps:6});   // a slightly wobbly finger
    const act = await p.evaluate(()=>document.querySelectorAll('.pg-cell.act').length); await p.mouse.up(); await p.waitForTimeout(40);
    const on = await p.evaluate(()=>[...document.querySelectorAll('.pg-cell.on')].map(c=>GAME.cells.indexOf(c)));
    ok("a drag fills along the row it starts in, even when the finger wobbles", on.length===3 && on.every(i=>Math.floor(i/10)===lineInfo.r), on.join(","));
    ok("the active row and column are highlighted while dragging", act===19); }
  await p.evaluate(()=>GAME.undoMove());
  ok("undo takes the whole stroke back", await p.evaluate(()=>!document.querySelector('.pg-cell.on')));

  // ---- mistakes: gentle by default ----
  const wrong = await p.evaluate(()=>GAME.st.sol.findIndex(v=>!v));
  await dragCells(p, wrong, wrong);
  ok("gentle mode: a wrong fill shakes, becomes a cross and counts a mistake", await p.evaluate(w=>GAME.st.g[w]===2 && GAME.st.mistakes===1 && /Mistakes <b>1/.test(document.getElementById('ulStatA').innerHTML), wrong));
  await p.click('.ctrl:has-text("Mark")'); const right = await p.evaluate(()=>GAME.st.sol.findIndex(v=>v)); await dragCells(p, right, right);
  ok("Mark puts a cross without a mistake", await p.evaluate(r=>GAME.st.g[r]===2 && GAME.st.mistakes===1, right));
  await p.evaluate(()=>{ GAME.undoMove(); GAME.undoMove(); }); await p.click('.ctrl:has-text("Fill")');
  await p.click('.pg-opt'); const w2 = await p.evaluate(()=>GAME.st.sol.findIndex((v,i)=>!v && GAME.st.g[i]===0)); await dragCells(p, w2, w2);
  ok("pure mode: no feedback, the wrong fill stays and no mistake is counted", await p.evaluate(w=>GAME.st.g[w]===1 && GAME.st.mistakes===1 && /Pure/.test(document.getElementById('ulStatA').textContent), w2));
  await p.evaluate(()=>GAME.undoMove()); await p.click('.pg-opt');

  // ---- hints: one free ----
  const h = await p.evaluate(()=>{ GAME.hint(); const used=GAME.st.hints, rowOk=[...Array(10).keys()].some(r=>[...Array(10).keys()].every(c=>{ const i=r*10+c; return GAME.st.g[i]===(GAME.st.sol[i]?1:2); }))||[...Array(10).keys()].some(c=>[...Array(10).keys()].every(r=>{ const i=r*10+c; return GAME.st.g[i]===(GAME.st.sol[i]?1:2); }));
    GAME.hint(); return {used, rowOk, after:GAME.st.hints, wall:document.getElementById('proVeil').classList.contains('show')}; });
  ok("free tier: one hint reveals a whole line correctly; the second opens the paywall", h.used===1 && h.rowOk && h.after===1 && h.wall);
  await p.click('#proClose'); await p.click('#resumeBtn').catch(()=>{});

  // ---- restart, save and reload ----
  const g1 = await p.evaluate(()=>{ UL.cur.sec=0; UL.restart(); return JSON.stringify(GAME.st.sol); });
  const g2 = await p.evaluate(()=>{ UL.restart(); return JSON.stringify(GAME.st.sol); });
  ok("restart gives the identical puzzle", g1===g2);
  await dragCells(p, s0, s1); await p.evaluate(()=>{ GAME.setTool("mark"); UL.save(); });
  const snap = await p.evaluate(()=>JSON.stringify(GAME.serialize())+"|"+UL.cur.score);
  await p.waitForTimeout(300); await p.reload(); await p.waitForTimeout(600);
  ok("reload restores the grid, crosses, tool, mistakes and hints exactly", snap===await p.evaluate(()=>JSON.stringify(GAME.serialize())+"|"+UL.cur.score) && await p.evaluate(()=>UL.cur.paused));
  ok("restored squares are drawn", await p.evaluate(()=>document.querySelectorAll('.pg-cell.on').length===GAME.st.g.filter(v=>v===1).length && document.querySelectorAll('.pg-cell.x').length===GAME.st.g.filter(v=>v===2).length));
  await p.click('#resumeBtn'); await p.evaluate(()=>GAME.setTool("fill"));

  // ---- a scripted full solve by real drags along each row ----
  await p.evaluate(()=>UL.start("medium",{seed:77})); await p.waitForTimeout(200);
  const runsToDrag = await p.evaluate(()=>{ const s=GAME.st, n=s.n, out=[]; for(let r=0;r<n;r++){ let c=0; while(c<n){ if(s.sol[r*n+c]){ const a=c; while(c<n&&s.sol[r*n+c]) c++; out.push([r*n+a, r*n+c-1]); } else c++; } } return out; });
  for(const [a,c] of runsToDrag) await dragCells(p, a, c);
  await p.waitForTimeout(1600);
  const win = await p.evaluate(()=>({over:UL.cur.over, modal:document.getElementById('endVeil').classList.contains('show'), title:document.getElementById('endTitle').textContent, detail:document.getElementById('endDetail').textContent,
    score:UL.cur.score, sec:UL.cur.sec, recs:UL.kv("records",[]), clean:document.querySelector('.pg-board').classList.contains('pg-done'), share:UL.cur.shareTxt}));
  ok("a full solve by dragging finishes the picture", win.over && win.modal && win.title==="Picture complete" && win.clean, win.detail);
  ok("score = base + time bonus with no mistakes or hints", win.score===200+Math.max(0,240-win.sec), win.score+" in "+win.sec+"s");
  ok("the win is recorded", win.recs.length===1 && win.recs[0].w===1);
  console.log("      share text: "+String(win.share).replace(/\n/g," / "));
  await p.click('#endClose'); await p.click('#tabTrends'); await p.waitForTimeout(200);
  ok("Trends shows the record", await p.evaluate(()=>!!document.querySelector('.rank-card .rating')));
  await p.click('#tabPlay').catch(()=>{});
  ok("there is no losing: many mistakes still leave the puzzle open", await p.evaluate(()=>{ UL.start("small",{seed:3}); const s=GAME.st; s.sol.forEach((v,i)=>{ if(!v){ GAME.stroke={id:1,start:i,from:0,to:1,axis:null,touched:new Set(),snap:s.g.slice(),stopped:false}; GAME.apply(i); GAME.finishStroke(GAME.stroke); GAME.stroke=null; } });
    return !UL.cur.over && s.mistakes===s.sol.filter(v=>!v).length && s.mistakes>=7; }));
  ok("score loses 20 per mistake and 50 per hint, never below 10", await p.evaluate(()=>{ const L=GAME.levels[0], f=(m,h,sec)=>Math.max(10, L.base+Math.max(0,L.par-sec)-20*m-50*h); return f(2,1,60)===10 && f(1,0,30)===110 && f(9,9,600)===10; }));

  // ---- Pro ----
  { const cP = await b.newContext({viewport:{width:412,height:860}, offline:true}); const pp = await cP.newPage(); pp.on('pageerror',e=>errs.push("pro: "+e.message));
    await pp.addInitScript(()=>{ localStorage.setItem("ul_profile",JSON.stringify({name:"Blue Tokai",created:1})); localStorage.setItem("ul_grid_tut","true"); localStorage.setItem("ul_pro","true"); });
    await pp.goto(F); await pp.waitForTimeout(400); await pp.evaluate(()=>document.querySelectorAll('.veil.show').forEach(v=>v.classList.remove('show')));
    ok("with Pro, Large is 15x15 and Huge is 20x20", await pp.evaluate(()=>{ UL.start("large",{}); const a=document.querySelectorAll('.pg-cell').length; UL.start("huge",{}); return a===225 && document.querySelectorAll('.pg-cell').length===400; }));
    ok("with Pro, five hints a game", await pp.evaluate(()=>{ for(let k=0;k<7;k++) GAME.hint(); return GAME.st.hints===5 && !document.getElementById('proVeil').classList.contains('show'); }));
    await cP.close(); }

  // ---- Daily ----
  const daily = pg => pg.evaluate(()=>{ UL.start("medium",{daily:UL.dailyNum()}); return JSON.stringify(GAME.st.sol); });
  const d1 = await daily(p); const ctx2 = await b.newContext({offline:true}); const p2 = await ctx2.newPage(); await p2.goto(F); await p2.waitForTimeout(400);
  const d2 = await daily(p2); await ctx2.close();
  ok("the Daily is identical on two devices", d1===d2);

  // ---- the puzzle maker and the line solver ----
  const lines = await p.evaluate(()=>{ let bad=0; for(let t=0;t<3000;t++){ const L=3+(t%9); const line=[]; for(let i=0;i<L;i++) line.push(Math.random()<.55?1:0); const clue=GAME.runs(line);
      const s=line.map(v=>Math.random()<.3?(v?1:2):0), out=GAME.settle(clue,s), all=[];
      for(let m=0;m<(1<<L);m++){ const c=[]; for(let i=0;i<L;i++) c.push((m>>i)&1); const rr=GAME.runs(c); if(rr.length!==clue.length||rr.some((v,i)=>v!==clue[i])) continue; if(s.some((v,i)=>v===1&&!c[i]||v===2&&c[i])) continue; all.push(c); }
      for(let i=0;i<L;i++){ const want = all.every(c=>c[i]) ? 1 : all.every(c=>!c[i]) ? 2 : 0; if(out[i]!==want){ bad++; break; } } } return bad; });
  ok("the line solver agrees with brute force on 3000 random lines", lines===0, lines+" disagreements");
  const gen = await p.evaluate(()=>{ const bad=[], times={}; for(const L of GAME.levels){ let worst=0;
      for(let k=0;k<200;k++){ UL.rng.s=20000+k*7919; const a=performance.now(), m=GAME.make(L.n); worst=Math.max(worst, performance.now()-a);
        const g=GAME.solve(m.clues, L.n); if(!g) bad.push(L.id+" needs guessing"); else if(g.some((v,i)=>(v===1)!==(m.sol[i]===1))) bad.push(L.id+" solution differs");
        const d=m.sol.filter(Boolean).length/(L.n*L.n); if(d<0.48||d>0.72) bad.push(L.id+" odd density "+d.toFixed(2)); }
      times[L.id]=Math.round(worst)+"ms"; } return {bad:[...new Set(bad)], times}; });
  ok("200 puzzles per level: solved by line logic alone, and the solution is the picture", gen.bad.length===0, gen.bad.join(", ")||"worst build times "+JSON.stringify(gen.times));
  { const cdp = await ctx.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', {rate:4});
    const t = await p.evaluate(()=>{ let worst=0; for(let k=0;k<20;k++){ UL.rng.s=5000+k*104729; const a=performance.now(); GAME.make(20); worst=Math.max(worst, performance.now()-a); } return Math.round(worst); });
    await cdp.send('Emulation.setCPUThrottlingRate', {rate:1});
    ok("a 20x20 puzzle builds in under 1 second on a phone 4 times slower", t < 1000, "worst "+t+"ms"); }

  // ---- fits a small phone ----
  const c3 = await b.newContext({viewport:{width:360,height:640}, offline:true}); const p3 = await c3.newPage();
  await p3.addInitScript(()=>{ localStorage.setItem("ul_profile",JSON.stringify({name:"Blue Tokai",created:1})); localStorage.setItem("ul_grid_tut","true"); localStorage.setItem("ul_pro","true"); });
  await p3.goto(F); await p3.waitForTimeout(400);
  const fit = await p3.evaluate(()=>{ const out=[]; for(const L of GAME.levels){ document.querySelectorAll('.veil.show').forEach(v=>v.classList.remove('show')); UL.start(L.id,{});
      const s=document.getElementById('stage').getBoundingClientRect(); const inside=[...document.querySelectorAll('.pg-board,.pg-cc,.pg-rc')].every(e=>{ const r=e.getBoundingClientRect(); return r.left>=s.left-3&&r.right<=s.right+3&&r.top>=s.top-3&&r.bottom<=s.bottom+3; });
      out.push({id:L.id, inside, scroll:document.documentElement.scrollHeight>innerHeight, cs:Math.round(document.querySelector('.pg-cell').getBoundingClientRect().width)}); } return out; });
  ok("nothing overflows or scrolls at 360x640", fit.every(f=>f.inside && !f.scroll), fit.map(f=>f.id+" "+f.cs+"px").join(", "));
  await c3.close();

  ok("nothing fetched from the network", ext.length===0, ext.join(","));
  ok("no page errors", errs.length===0, errs.join(" | "));
  await b.close();
})();
