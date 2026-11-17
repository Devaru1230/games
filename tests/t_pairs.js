const { chromium } = require('playwright');
const path = require('path');
const ok=(n,c,x)=>console.log((c?"PASS":"FAIL")+"  "+n+(x?"  "+x:""));
const F='file://'+path.resolve(__dirname,'../out/pairs.html');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({viewport:{width:412,height:860}, offline:true});
  const ext=[]; await ctx.route('**', r=>{ const u=r.request().url(); if(!u.startsWith('file:')&&!u.startsWith('data:')){ext.push(u);return r.abort();} r.continue(); });
  const p = await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
  await p.goto(F); await p.waitForTimeout(500);
  const tapCard = async (pg, i) => { const r = await pg.locator('.pr-card').nth(i).boundingBox(); await pg.mouse.click(r.x+r.width/2, r.y+r.height/2); };
  const groups = pg => pg.evaluate(()=>{ const g={}; GAME.st.deck.forEach((f,i)=>(g[f]=g[f]||[]).push(i)); return Object.values(g); });

  // ---- first run ----
  ok("first run shows the name picker", await p.evaluate(()=>document.getElementById('nameVeil').classList.contains('show')));
  await p.click('#nameChips .chip'); await p.click('#nameSave');
  ok("then the tutorial", await p.evaluate(()=>document.getElementById('tutVeil').classList.contains('show')), await p.evaluate(()=>document.getElementById('tutStep').textContent));
  for(let i=0;i<8;i++) await p.click('#tutNext').catch(()=>{});
  ok("then the level picker, Small and Medium open, Large, Huge and Triples locked", await p.evaluate(()=>{ const r=[...document.querySelectorAll('#lvlList .lvl')];
    const l=r.filter(x=>x.classList.contains('locked')); return r.length===6 && l.length===3 && l.every(x=>/Large|Huge|Triples/.test(x.textContent)); }));
  await p.evaluate(()=>[...document.querySelectorAll('#lvlList .lvl')].find(x=>x.textContent.includes('Triples')).click());
  ok("a Pro level opens the paywall, not the game", await p.evaluate(()=>document.getElementById('proVeil').classList.contains('show') && UL.cur===null));
  await p.click('#proClose');
  await p.evaluate(()=>{ UL.newGame(); [...document.querySelectorAll('#lvlList .lvl')].find(x=>x.textContent.includes('Small')).click(); });
  await p.waitForTimeout(300);
  ok("Small starts with 16 face-down cards", await p.evaluate(()=>document.querySelectorAll('.pr-card').length===16 && !document.querySelector('.pr-card.up')));

  // ---- a miss, then the fast third tap ----
  let g = await groups(p);
  await tapCard(p, g[0][0]); await tapCard(p, g[1][0]); await p.waitForTimeout(60);
  const miss = await p.evaluate(()=>({up:document.querySelectorAll('.pr-card.up').length, turns:GAME.st.turns}));
  ok("a miss shows both cards and counts a turn", miss.up===2 && miss.turns===1);
  await tapCard(p, g[2][0]); await p.waitForTimeout(60);
  ok("a third tap during a miss turns the pair back at once and opens the new card", await p.evaluate(c=>document.querySelectorAll('.pr-card.up').length===1 && GAME.st.open.length===1 && GAME.st.open[0]===c, g[2][0]));
  await p.waitForTimeout(800);
  ok("nothing is left stuck face up", await p.evaluate(()=>document.querySelectorAll('.pr-card.up').length===1));
  const burst = await p.evaluate(async()=>{ const g={}; GAME.st.deck.forEach((f,i)=>(g[f]=g[f]||[]).push(i)); const v=Object.values(g);
    GAME.tap(v[3][0]); GAME.tap(v[4][0]); GAME.tap(v[5][0]); GAME.tap(v[6][0]); GAME.tap(v[7][0]);   // five fast taps over misses
    const open=GAME.st.open.length, closing=GAME.st.closing.length, up=document.querySelectorAll('.pr-card.up').length;
    await new Promise(r=>setTimeout(r,800)); return {open, closing, up, upAfter:document.querySelectorAll('.pr-card.up').length}; });
  ok("fast taps never leave three cards open or a card stuck", burst.up<=2 && burst.open+burst.closing<=2 && burst.upAfter<=1, JSON.stringify(burst));

  // ---- restore with one card open ----
  await p.evaluate(()=>{ UL.start("small",{seed:7}); const g={}; GAME.st.deck.forEach((f,i)=>(g[f]=g[f]||[]).push(i)); const v=Object.values(g);
    GAME.tap(v[0][0]); GAME.tap(v[0][1]); GAME.tap(v[1][0]); UL.save(); });
  const snap = await p.evaluate(()=>JSON.stringify(GAME.serialize())+"|"+UL.cur.score);
  await p.reload(); await p.waitForTimeout(600);
  ok("reload with one card open brings back exactly that state", snap===await p.evaluate(()=>JSON.stringify(GAME.serialize())+"|"+UL.cur.score) &&
    await p.evaluate(()=>document.querySelectorAll('.pr-card.up').length===3 && document.querySelectorAll('.pr-card.got').length===2 && UL.cur.paused));
  await p.click('#resumeBtn');

  // ---- restart replays the same deal ----
  const d1 = await p.evaluate(()=>{ UL.cur.sec=0; UL.restart(); return JSON.stringify(GAME.st.deck); });
  const d2 = await p.evaluate(()=>{ UL.restart(); return JSON.stringify(GAME.st.deck); });
  ok("restart replays the identical deal", d1===d2);

  // ---- a scripted perfect game by real taps ----
  await p.evaluate(()=>UL.start("small",{seed:11})); await p.waitForTimeout(150); g = await groups(p);
  for(const grp of g){ for(const i of grp) await tapCard(p, i); }
  await p.waitForTimeout(1600);
  const perf = await p.evaluate(()=>({over:UL.cur.over, modal:document.getElementById('endVeil').classList.contains('show'), title:document.getElementById('endTitle').textContent,
    detail:document.getElementById('endDetail').textContent, turns:GAME.st.turns, score:UL.cur.score, sec:UL.cur.sec, recs:UL.kv("records",[]), best:UL.kv("best_small",0), share:UL.cur.shareTxt}));
  ok("a perfect game takes 8 turns and wins", perf.over && perf.modal && perf.turns===8 && /8 pairs in 8 turns/.test(perf.detail), perf.title+" — "+perf.detail);
  ok("a perfect fast game scores the base plus the time bonus", perf.score===100+Math.max(0,60-perf.sec), perf.score+" in "+perf.sec+"s");
  ok("the win is recorded and the best turn count saved", perf.recs.length===1 && perf.recs[0].w===1 && perf.best===8);
  console.log("      share text: "+String(perf.share).replace(/\n/g," / "));
  await p.click('#endClose'); await p.click('#tabTrends'); await p.waitForTimeout(200);
  ok("Trends shows the record", await p.evaluate(()=>!!document.querySelector('.rank-card .rating')));
  await p.click('#tabPlay').catch(()=>{});

  // ---- a game with misses: turns and score ----
  const mis = await p.evaluate(async()=>{ UL.start("small",{seed:13}); const g={}; GAME.st.deck.forEach((f,i)=>(g[f]=g[f]||[]).push(i)); const v=Object.values(g);
    for(let k=0;k<4;k++){ GAME.tap(v[k][0]); GAME.tap(v[k+1][1]); GAME.closeNow(); }        // four misses
    for(const grp of v){ for(const i of grp) GAME.tap(i); }
    await new Promise(r=>setTimeout(r,1500));
    return {turns:GAME.st.turns, score:UL.cur.score, sec:UL.cur.sec, line:document.getElementById('endDetail').textContent}; });
  ok("four misses: 12 turns, score drops 5 per extra turn", mis.turns===12 && mis.score===Math.max(10,100-20+Math.max(0,60-mis.sec)), mis.turns+" turns, "+mis.score+" points — "+mis.line);
  await p.click('#endClose').catch(()=>{});

  // ---- Pro: Large, Huge and Triples ----
  { const cP = await b.newContext({viewport:{width:412,height:860}, offline:true}); const pp = await cP.newPage(); pp.on('pageerror',e=>errs.push("pro: "+e.message));
    await pp.addInitScript(()=>{ localStorage.setItem("ul_profile",JSON.stringify({name:"Blue Tokai",created:1})); localStorage.setItem("ul_pairs_tut","true"); localStorage.setItem("ul_pro","true"); });
    await pp.goto(F); await pp.waitForTimeout(400); await pp.evaluate(()=>document.querySelectorAll('.veil.show').forEach(v=>v.classList.remove('show')));
    ok("with Pro, Large has 36 cards and Huge 42", await pp.evaluate(()=>{ UL.start("large",{}); const a=document.querySelectorAll('.pr-card').length; UL.start("huge",{}); return a===36 && document.querySelectorAll('.pr-card').length===42; }));
    const tri = await pp.evaluate(async()=>{ UL.start("triples",{seed:3}); const g={}; GAME.st.deck.forEach((f,i)=>(g[f]=g[f]||[]).push(i)); const v=Object.values(g);
      GAME.tap(v[0][0]); GAME.tap(v[0][1]); const twoOpen=GAME.st.open.length; GAME.tap(v[0][2]); const got=document.querySelectorAll('.pr-card.got').length;
      GAME.tap(v[1][0]); GAME.tap(v[2][0]); const missAfterTwo=GAME.st.closing.length; GAME.closeNow();
      for(const grp of v) for(const i of grp) GAME.tap(i); await new Promise(r=>setTimeout(r,1500));
      return {twoOpen, got, missAfterTwo, turns:GAME.st.turns, over:UL.cur.over, line:document.getElementById('endDetail').textContent}; });
    ok("Triples: three of a kind match, a wrong second card ends the turn", tri.twoOpen===2 && tri.got===3 && tri.missAfterTwo===2 && tri.over && tri.turns===11, tri.line);
    await cP.close(); }

  // ---- Daily identical on two devices ----
  const daily = pg => pg.evaluate(()=>{ UL.start("medium",{daily:UL.dailyNum()}); return JSON.stringify(GAME.st.deck); });
  const dd1 = await daily(p); const ctx2 = await b.newContext({offline:true}); const p2 = await ctx2.newPage(); await p2.goto(F); await p2.waitForTimeout(400);
  const dd2 = await daily(p2); await ctx2.close();
  ok("the Daily is identical on two devices", dd1===dd2);

  // ---- 300 deals per level, and the faces ----
  const deals = await p.evaluate(()=>{ const bad=[]; for(const L of GAME.levels) for(let k=0;k<300;k++){ UL.rng.s = 100+k*7919; const d=GAME.deal(L), c={};
      d.forEach(f=>c[f]=(c[f]||0)+1); if(d.length!==L.c*L.r) bad.push(L.id+" size"); if(Object.values(c).some(v=>v!==L.k)) bad.push(L.id+" count"); }
    const faces=new Set([...Array(24).keys()].map(f=>prFace(f))); if(faces.size!==24) bad.push("faces not distinct");
    return [...new Set(bad)]; });
  ok("300 deals per level: every face appears exactly twice (three times in Triples); 24 distinct faces", deals.length===0, deals.join(", "));

  // ---- praise: lucky finds get no words, tier 4 stays rare for a casual player ----
  const pr = await p.evaluate(()=>{ const real=UL.praise, words={1:0,2:0,3:0,4:0}; UL.praise=(el,t)=>{ words[t]++; return true; };
    for(let g=0; g<60; g++){ UL.start("medium",{seed:500+g}); const s=GAME.st, mem={};          // a casual player: remembers what they saw, but only half the time
      let guard=0; while(UL.cur && !UL.cur.over && guard++<400){ GAME.closeNow();
        const closed=[...s.deck.keys()].filter(i=>!s.matched.includes(i));
        const a=closed[Math.floor(Math.random()*closed.length)]; GAME.tap(a); if(UL.cur.over) break;
        const known=Object.keys(mem).map(Number).find(j=>j!==a && s.deck[j]===s.deck[a] && !s.matched.includes(j) && Math.random()<0.5);
        const rest=closed.filter(j=>j!==a); const b2 = known!=null ? known : rest[Math.floor(Math.random()*rest.length)];
        mem[a]=1; mem[b2]=1; GAME.tap(b2); } }
    UL.praise=real; return Object.fromEntries(Object.entries(words).map(([k,v])=>[k,(v/60).toFixed(2)])); });
  ok("tier 4 praise is rare for a casual player (under once a game)", +pr[4] < 1, "per game: "+JSON.stringify(pr));

  // ---- fits a small phone ----
  const c3 = await b.newContext({viewport:{width:360,height:640}, offline:true}); const p3 = await c3.newPage();
  await p3.addInitScript(()=>{ localStorage.setItem("ul_profile",JSON.stringify({name:"Blue Tokai",created:1})); localStorage.setItem("ul_pairs_tut","true"); localStorage.setItem("ul_pro","true"); });
  await p3.goto(F); await p3.waitForTimeout(400);
  const fit = await p3.evaluate(()=>{ const out=[]; for(const L of GAME.levels){ document.querySelectorAll('.veil.show').forEach(v=>v.classList.remove('show')); UL.start(L.id,{});
      const s=document.getElementById('stage').getBoundingClientRect(), gr=document.querySelector('.pr-grid').getBoundingClientRect(), c=document.querySelector('.pr-card').getBoundingClientRect();
      out.push({id:L.id, inside:gr.left>=s.left-1&&gr.right<=s.right+1&&gr.top>=s.top-1&&gr.bottom<=s.bottom+1, scroll:document.documentElement.scrollHeight>innerHeight, w:Math.round(c.width)}); } return out; });
  ok("nothing overflows or scrolls at 360x640", fit.every(f=>f.inside && !f.scroll), fit.map(f=>f.id+" "+f.w+"px").join(", "));
  await c3.close();

  ok("nothing fetched from the network", ext.length===0, ext.join(","));
  ok("no page errors", errs.length===0, errs.join(" | "));
  await b.close();
})();
