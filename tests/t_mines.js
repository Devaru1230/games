const { chromium } = require('playwright');
const path = require('path');
const ok=(n,c,x)=>console.log((c?"PASS":"FAIL")+"  "+n+(x?"  "+x:""));
const F='file://'+path.resolve(__dirname,'../out/mines.html');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({viewport:{width:412,height:860}, deviceScaleFactor:1, offline:true});
  const ext=[]; await ctx.route('**', r=>{ const u=r.request().url(); if(!u.startsWith('file:')&&!u.startsWith('data:')){ext.push(u);return r.abort();} r.continue(); });
  const p = await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
  await p.goto(F); await p.waitForTimeout(500);

  // ---- first run: name, tutorial, level picker ----
  ok("first run shows the name picker", await p.evaluate(()=>document.getElementById('nameVeil').classList.contains('show')));
  await p.click('#nameChips .chip'); await p.click('#nameSave');
  ok("then the tutorial", await p.evaluate(()=>document.getElementById('tutVeil').classList.contains('show')), await p.evaluate(()=>document.getElementById('tutStep').textContent));
  for(let i=0;i<8;i++) await p.click('#tutNext').catch(()=>{});
  ok("then the level picker, Small and Medium open, Large and Expert locked", await p.evaluate(()=>{ const r=[...document.querySelectorAll('#lvlList .lvl')];
    return r.length===5 && r.filter(x=>x.classList.contains('locked')).length===2 && r.filter(x=>x.classList.contains('locked')).every(x=>/Large|Expert/.test(x.textContent)); }));
  await p.evaluate(()=>[...document.querySelectorAll('#lvlList .lvl')].find(x=>x.textContent.includes('Expert')).click());
  ok("a Pro level opens the paywall, not the game", await p.evaluate(()=>document.getElementById('proVeil').classList.contains('show') && UL.cur===null));
  await p.click('#proClose');
  await p.evaluate(()=>{ UL.newGame(); [...document.querySelectorAll('#lvlList .lvl')].find(x=>x.textContent.includes('Small')).click(); });
  await p.waitForTimeout(300);
  ok("Small starts: 64 closed squares, no mines placed yet", await p.evaluate(()=>document.querySelectorAll('.mn-cell.mn-c').length===64 && GAME.st.mines===null));

  // ---- the first tap through a real pointer tap is safe and opens an area ----
  const cellBox = async i => { const r = await p.locator('.mn-cell').nth(i).boundingBox(); return {x:r.x+r.width/2, y:r.y+r.height/2, w:r.width}; };
  let c27 = await cellBox(27); await p.mouse.click(c27.x, c27.y); await p.waitForTimeout(400);
  const first = await p.evaluate(()=>({mines:GAME.st.mines.length, open:GAME.st.opened, zero:GAME.num[27]===0, over:UL.cur.over, score:UL.cur.score}));
  ok("first tap is safe, opens a zero and its area", first.mines===10 && first.zero && first.open>=9 && !first.over, first.open+" squares opened, score "+first.score);
  ok("squares are at least 40px on Small", c27.w>=40, Math.round(c27.w)+"px");

  // ---- restart: the same seed and the same first tap give the same board ----
  const m1 = await p.evaluate(()=>JSON.stringify(GAME.st.mines));
  await p.evaluate(()=>{ UL.cur.sec=0; UL.restart(); }); await p.waitForTimeout(200);
  ok("restart shows the untouched board", await p.evaluate(()=>GAME.st.mines===null && document.querySelectorAll('.mn-cell.mn-c').length===64));
  await p.mouse.click(c27.x, c27.y); await p.waitForTimeout(300);
  ok("restart replays the identical mines", m1===await p.evaluate(()=>JSON.stringify(GAME.st.mines)));

  // ---- flags: the toggle, long-press, and the mines-left count ----
  const mineIdx = await p.evaluate(()=>GAME.st.mines.find(i=>!GAME.st.open[i]));
  const fb = await p.locator('.ctrl', {hasText:'Flag'}).boundingBox();
  await p.mouse.click(fb.x+fb.width/2, fb.y+fb.height/2); await p.waitForTimeout(80);
  ok("Flag control switches flag mode on and shows it", await p.evaluate(()=>GAME.st.flagMode && [...document.querySelectorAll('.ctrl')].some(b=>b.classList.contains('on')&&/Flag: on/.test(b.textContent))));
  let mb = await cellBox(mineIdx); await p.mouse.click(mb.x, mb.y); await p.waitForTimeout(80);
  ok("in flag mode a tap plants a flag and mines left drops", await p.evaluate((i)=>GAME.st.flag[i]===1 && /Mines left <b>9</.test(document.getElementById('ulStatA').innerHTML), mineIdx));
  await p.mouse.click(mb.x, mb.y); await p.waitForTimeout(80);
  await p.mouse.click(fb.x+fb.width/2, fb.y+fb.height/2); await p.waitForTimeout(80);
  await p.mouse.move(mb.x, mb.y); await p.mouse.down(); await p.waitForTimeout(600); await p.mouse.up(); await p.waitForTimeout(80);
  ok("press and hold also plants a flag, without opening", await p.evaluate((i)=>GAME.st.flag[i]===1 && !GAME.st.open[i] && !UL.cur.over && !GAME.st.flagMode, mineIdx));
  await p.mouse.click(mb.x, mb.y); await p.waitForTimeout(80);
  ok("a plain tap on a flagged square does nothing", await p.evaluate((i)=>!GAME.st.open[i] && !UL.cur.over, mineIdx));

  // ---- chord ----
  const chord = await p.evaluate(()=>{ const s=GAME.st, c=s.c, r=s.r;
    for(let i=0;i<c*r;i++){ if(!s.open[i] || GAME.num[i]<=0) continue; const nb=GAME.nbrs(i,c,r);
      const mines=nb.filter(j=>GAME.num[j]<0), closed=nb.filter(j=>!s.open[j]&&GAME.num[j]>=0&&!s.flag[j]);
      if(closed.length){ mines.forEach(j=>{ if(!s.flag[j]) GAME.toggleFlag(j); }); const before=s.opened; GAME.tap(i); return {opened:s.opened-before, closed:closed.length, over:UL.cur.over}; } }
    return null; });
  ok("tapping a fully flagged number opens the rest around it", chord && chord.opened>=chord.closed && !chord.over, chord ? chord.opened+" opened" : "no chord spot");

  // ---- save and reload ----
  await p.evaluate(()=>UL.save());
  const snap = await p.evaluate(()=>JSON.stringify(GAME.serialize())+"|"+UL.cur.score);
  await p.reload(); await p.waitForTimeout(600);
  const back = await p.evaluate(()=>JSON.stringify(GAME.serialize())+"|"+UL.cur.score);
  ok("reload restores the exact board, flags and score, paused", snap===back && await p.evaluate(()=>UL.cur.paused), snap.split("|")[1]+" pts");
  ok("restored squares are drawn as they were", await p.evaluate(()=>{ const s=GAME.st; return GAME.els.every((e,i)=>e.classList.contains(s.open[i]?'mn-o':'mn-c') && (!!s.flag[i])===!!e.querySelector('.mn-flag')); }));
  await p.click('#resumeBtn');

  // ---- a scripted full win through real taps ----
  const safe = await p.evaluate(()=>{ const s=GAME.st; const out=[]; for(let i=0;i<s.c*s.r;i++) if(!s.open[i] && GAME.num[i]>=0) out.push(i); return out; });
  for(const i of safe){ if(await p.evaluate(j=>GAME.st.open[j]||UL.cur.over, i)) continue; const cb=await cellBox(i); await p.mouse.click(cb.x, cb.y); }
  await p.waitForTimeout(1600);
  const win = await p.evaluate(()=>({over:UL.cur.over, modal:document.getElementById('endVeil').classList.contains('show'), title:document.getElementById('endTitle').textContent,
    detail:document.getElementById('endDetail').textContent, recs:UL.kv("records",[]), save:UL.kv("save",null), share:UL.cur.shareTxt, allFlagged:GAME.st.mines.every(i=>GAME.st.flag[i])}));
  ok("a full win reaches the end card", win.over && win.modal && win.title==="Board cleared", win.title+" — "+win.detail);
  ok("the win is recorded and the save cleared", win.recs.length===1 && win.recs[0].w===1 && win.save===null);
  ok("on a win every mine is shown flagged", win.allFlagged);
  console.log("      share text: "+win.share.replace(/\n/g," / "));
  await p.click('#endClose');

  // ---- a scripted loss ----
  await p.evaluate(()=>UL.start("small",{seed:777})); await p.waitForTimeout(150);
  let c0 = await cellBox(0); await p.mouse.click(c0.x, c0.y); await p.waitForTimeout(200);
  const wrongFlag = await p.evaluate(()=>{ const s=GAME.st; const j=[...Array(64).keys()].find(i=>!s.open[i]&&GAME.num[i]>=0); GAME.toggleFlag(j); return j; });
  const boom = await p.evaluate(()=>GAME.st.mines.find(i=>!GAME.st.flag[i]));
  const bb = await cellBox(boom); await p.mouse.click(bb.x, bb.y); await p.waitForTimeout(400);
  const loss = await p.evaluate((wf)=>({over:UL.cur.over, modal:document.getElementById('endVeil').classList.contains('show'), title:document.getElementById('endTitle').textContent,
    mines:GAME.st.mines.filter(i=>!GAME.st.flag[i]).every(i=>!!GAME.els[i].querySelector('.mn-mine')), boom:document.querySelectorAll('.mn-boom').length,
    wrong:!!GAME.els[wf].querySelector('.mn-wrong'), recs:UL.kv("records",[])}), wrongFlag);
  ok("a loss reaches the end card", loss.over && loss.modal && loss.title==="Mine hit");
  ok("a loss shows every mine, the one hit, and the wrong flag", loss.mines && loss.boom===1 && loss.wrong);
  ok("the loss is recorded", loss.recs.length===2 && loss.recs[1].w===0);
  await p.click('#endClose'); await p.click('#tabTrends'); await p.waitForTimeout(200);
  ok("Trends shows the records", await p.evaluate(()=>!!document.querySelector('.rank-card .rating') && document.querySelectorAll('.tcard').length>=1));
  await p.click('#tabPlay').catch(()=>{});

  // ---- free limits: no-guess is Pro, Pro levels unlock with Pro ----
  await p.evaluate(()=>UL.start("small",{})); await p.waitForTimeout(150);
  const ngb = await p.locator('.ctrl', {hasText:'No-guess'}).boundingBox();
  await p.mouse.click(ngb.x+ngb.width/2, ngb.y+ngb.height/2); await p.waitForTimeout(150);
  ok("free tier: No-guess opens the paywall and stays off", await p.evaluate(()=>document.getElementById('proVeil').classList.contains('show') && !UL.kv("noguess",false)));
  await p.click('#proClose');
  const pp = await ctx.newPage(); await pp.goto(F+'?k='+encodeURIComponent(process.env.UL_FAMILY_KEY||"")); await pp.waitForTimeout(400);
  const proOn = await pp.evaluate(()=>UL.isPro());
  if(!proOn) await p.evaluate(()=>UL.store.set("ul_pro", true));
  await pp.close(); await p.reload(); await p.waitForTimeout(500); await p.click('#resumeBtn').catch(()=>{});
  ok("with Pro, Expert starts", await p.evaluate(()=>{ UL.start("expert",{}); return UL.cur.level==="expert" && document.querySelectorAll('.mn-cell').length===180; }));
  const ngb2 = await p.locator('.ctrl', {hasText:'No-guess'}).boundingBox();
  await p.mouse.click(ngb2.x+ngb2.width/2, ngb2.y+ngb2.height/2); await p.waitForTimeout(150);
  ok("with Pro, No-guess turns on", await p.evaluate(()=>UL.kv("noguess",false)===true && !document.getElementById('proVeil').classList.contains('show')));
  const ng = await p.evaluate(()=>{ const t=performance.now(); GAME.tap(130); return {ms:Math.round(performance.now()-t), ng:GAME.st.ng, solved:GAME.solve(GAME.st.c,GAME.st.r,GAME.st.mines,130)}; });
  ok("an Expert no-guess board is built and passes the solver", ng.ng && ng.solved, ng.ms+" ms");
  ok("the Daily never uses no-guess", await p.evaluate(()=>{ UL.start("medium",{daily:UL.dailyNum()}); GAME.tap(55); return GAME.st.ng===false; }));

  // ---- Daily identical on two devices ----
  const dailyBoard = async pg => pg.evaluate(()=>{ UL.start("medium",{daily:UL.dailyNum()}); GAME.tap(55); return JSON.stringify(GAME.st.mines); });
  const d1 = await dailyBoard(p);
  const ctx2 = await b.newContext({offline:true}); const p2 = await ctx2.newPage(); await p2.goto(F); await p2.waitForTimeout(400);
  const d2 = await dailyBoard(p2);
  ok("the Daily is identical on two devices", d1===d2);
  await ctx2.close();

  // ---- game logic over many seeded boards ----
  const logic = await p.evaluate(()=>{
    const res = {boards:0, bad:[]};
    for(const L of GAME.levels){ for(let k=0;k<125;k++){
      UL.rng.s = 1000+k*7919; const first = UL.rnd(L.c*L.r);
      const mines = GAME.layout(L.c, L.r, L.m, first), set = new Set(mines), num = GAME.counts(L.c, L.r, mines); res.boards++;
      if(mines.length!==L.m || set.size!==L.m) res.bad.push(L.id+" count");
      if(set.has(first) || num[first]!==0) res.bad.push(L.id+" first tap");
      for(let i=0;i<L.c*L.r;i++){ const x=i%L.c, y=Math.floor(i/L.c); let n=0;
        for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){ if(!dx&&!dy) continue; const X=x+dx, Y=y+dy; if(X>=0&&Y>=0&&X<L.c&&Y<L.r&&set.has(Y*L.c+X)) n++; }
        if(set.has(i) ? num[i]!==-1 : num[i]!==n){ res.bad.push(L.id+" number at "+i); break; } }
    } }
    return res; });
  ok("500 seeded boards: right mine count, first tap safe and zero, numbers right", logic.boards===500 && logic.bad.length===0, logic.bad.slice(0,3).join(", "));

  const ngRun = await p.evaluate(()=>{
    const out = {};
    for(const id of ["small","medium","large","expert"]){ const L = GAME.levels.find(l=>l.id===id); let pass=0, tries=0, worst=0, t=performance.now();
      for(let k=0;k<25;k++){ UL.rng.s = 50000+k*104729; const first = UL.rnd(L.c*L.r);
        let a=0, okb=false; for(; a<200; a++){ const m = GAME.layout(L.c,L.r,L.m,first); if(GAME.solve(L.c,L.r,m,first)){ okb=true; break; } }
        tries += a+1; worst = Math.max(worst, a+1); if(okb) pass++; }
      out[id] = {pass, avg:(tries/25).toFixed(1), worst, ms:Math.round((performance.now()-t)/25)}; }
    return out; });
  const allPass = Object.values(ngRun).every(v=>v.pass===25);
  ok("No-guess: 100 boards (25 per level) all built within 200 tries and solved by logic", allPass && await p.evaluate(()=>GAME.unsound===0),
     Object.entries(ngRun).map(([k,v])=>k+" avg "+v.avg+" tries, worst "+v.worst+", "+v.ms+"ms").join("; "));
  const sound = await p.evaluate(()=>{ GAME.unsound = 0; let solved = 0, n = 0;
    for(const L of GAME.levels) for(let k=0;k<1500;k++){ UL.rng.s = 9000+k*31337; const f = UL.rnd(L.c*L.r); const m = GAME.layout(L.c,L.r,L.m,f); n++; if(GAME.solve(L.c,L.r,m,f)) solved++; }
    return {n, solved, unsound:GAME.unsound}; });
  ok("the solver never makes a wrong deduction (6000 boards)", sound.unsound===0, sound.solved+" of "+sound.n+" solvable without guessing");
  ok("the solver refuses a board that needs a guess", await p.evaluate(()=>GAME.solve(5,2,[4],0)===false && GAME.solve(5,2,[],0)===true));

  // ---- layout: nothing overflows at 360x640 on every level ----
  const ctx3 = await b.newContext({viewport:{width:360,height:640}, offline:true}); const p3 = await ctx3.newPage();
  await p3.addInitScript(()=>{ localStorage.setItem("ul_profile",JSON.stringify({name:"Blue Tokai",created:1})); localStorage.setItem("ul_pro","true"); localStorage.setItem("ul_mines_tut","true"); });
  await p3.goto(F); await p3.waitForTimeout(400);
  const fit = await p3.evaluate(()=>{ const out=[]; for(const id of ["small","medium","large","expert"]){ document.querySelectorAll('.veil.show').forEach(v=>v.classList.remove('show'));
    UL.start(id,{}); const s=document.getElementById('stage').getBoundingClientRect(), bd=document.querySelector('.mn-board').getBoundingClientRect(), cell=document.querySelector('.mn-cell').getBoundingClientRect();
    out.push({id, inside: bd.left>=s.left-1 && bd.right<=s.right+1 && bd.top>=s.top-1 && bd.bottom<=s.bottom+1, scroll: document.documentElement.scrollHeight>innerHeight, cell:Math.round(cell.width)}); } return out; });
  ok("nothing overflows the stage or scrolls at 360x640", fit.every(f=>f.inside && !f.scroll), fit.map(f=>f.id+" "+f.cell+"px").join(", "));
  await ctx3.close();

  ok("nothing fetched from the network", ext.length===0, ext.join(","));
  ok("no page errors", errs.length===0, errs.join(" | "));
  await b.close();
})();
