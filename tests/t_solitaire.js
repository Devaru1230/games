const { chromium } = require('playwright');
const path = require('path');
const ok=(n,c,x)=>console.log((c?"PASS":"FAIL")+"  "+n+(x?"  "+x:""));
const F='file://'+path.resolve(__dirname,'../out/solitaire.html');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({viewport:{width:412,height:860}, offline:true});
  const ext=[]; await ctx.route('**', r=>{ const u=r.request().url(); if(!u.startsWith('file:')&&!u.startsWith('data:')){ext.push(u);return r.abort();} r.continue(); });
  const p = await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
  await p.goto(F); await p.waitForTimeout(500);
  const cardXY = async (pg, c) => pg.evaluate(c=>{ const r=GAME.els[c].getBoundingClientRect(); return {x:r.left+r.width/2, y:r.top+Math.min(14, r.height/2)}; }, c);

  // ---- first run ----
  ok("first run shows the name picker", await p.evaluate(()=>document.getElementById('nameVeil').classList.contains('show')));
  await p.click('#nameChips .chip'); await p.click('#nameSave');
  ok("then the tutorial", await p.evaluate(()=>document.getElementById('tutVeil').classList.contains('show')), await p.evaluate(()=>document.getElementById('tutStep').textContent));
  for(let i=0;i<8;i++) await p.click('#tutNext').catch(()=>{});
  ok("then the level picker, Draw one open, Draw three and Winnable locked", await p.evaluate(()=>{ const r=[...document.querySelectorAll('#lvlList .lvl')];
    const l=r.filter(x=>x.classList.contains('locked')); return r.length===4 && l.length===2 && l.every(x=>/three|Winnable/.test(x.textContent)); }));
  await p.evaluate(()=>[...document.querySelectorAll('#lvlList .lvl')].find(x=>x.textContent.includes('Winnable')).click());
  ok("a Pro level opens the paywall, not the game", await p.evaluate(()=>document.getElementById('proVeil').classList.contains('show') && UL.cur===null));
  await p.click('#proClose');
  await p.evaluate(()=>{ UL.newGame(); [...document.querySelectorAll('#lvlList .lvl')].find(x=>x.textContent.includes('Draw one')).click(); });
  await p.waitForTimeout(300);
  ok("Draw one deals seven columns of 1 to 7 with the top card face up, and 24 in the deck", await p.evaluate(()=>{ const s=GAME.st;
    return s.tab.every((t,c)=>t.length===c+1 && s.down[c]===c) && s.stock.length===24 && document.querySelectorAll('.so-card.up').length===7; }));

  // ---- the rules ----
  const rules = await p.evaluate(()=>{ const R={}; const mk=()=>({draw:1, stock:[], waste:[], found:[[],[],[],[]], tab:[[],[],[],[],[],[],[]], down:[0,0,0,0,0,0,0], moves:0, passes:0});
    const C=(rank,suit)=>suit*13+rank-1;                                          // suit 0 spades,1 hearts,2 diamonds,3 clubs
    let s=mk(); s.tab[0]=[C(7,0)]; s.waste=[C(6,1)]; R.redOnBlack=!!GAME.apply(s,{t:"w2t",to:0});
    s=mk(); s.tab[0]=[C(7,0)]; s.waste=[C(6,3)]; R.blackOnBlack=!GAME.apply(s,{t:"w2t",to:0});
    s=mk(); s.tab[0]=[C(7,0)]; s.waste=[C(5,1)]; R.wrongRank=!GAME.apply(s,{t:"w2t",to:0});
    s=mk(); s.waste=[C(13,1)]; R.kingToEmpty=!!GAME.apply(s,{t:"w2t",to:0});
    s=mk(); s.waste=[C(12,1)]; R.queenToEmpty=!GAME.apply(s,{t:"w2t",to:0});
    s=mk(); s.waste=[C(1,2)]; R.aceUp=!!GAME.apply(s,{t:"w2f"}) && s.found[2].length===1;
    s=mk(); s.waste=[C(2,2)]; R.twoFirst=!GAME.apply(s,{t:"w2f"});
    s=mk(); s.tab[0]=[C(9,1),C(8,0),C(7,1)]; s.tab[1]=[C(9,2)]; R.runMove=!!GAME.apply(s,{t:"t2t",from:0,idx:1,to:1}) && s.tab[1].length===3;
    s=mk(); s.tab[0]=[C(5,0),C(4,1)]; s.down[0]=1; s.found[1]=[C(1,1),C(2,1),C(3,1)]; const r1=GAME.apply(s,{t:"t2f",from:0}); R.flipOnReveal=!!r1 && r1.flip && s.down[0]===0 && r1.points===15;
    s=mk(); s.tab[0]=[C(5,0),C(4,1)]; s.down[0]=1; R.hiddenNotMovable=!GAME.apply(s,{t:"t2t",from:0,idx:0,to:1});
    s=mk(); s.found[1]=[C(1,1),C(2,1),C(3,1),C(4,1)]; s.tab[0]=[C(5,0)]; const r2=GAME.apply(s,{t:"f2t",suit:1,to:0}); R.backFromFoundation=!!r2 && r2.points===-15;
    s=mk(); s.stock=[1,2,3]; GAME.apply(s,{t:"draw"}); GAME.apply(s,{t:"draw"}); GAME.apply(s,{t:"draw"}); R.recycleOnlyEmpty=!GAME.apply(s,{t:"draw"}) && !!GAME.apply(s,{t:"recycle"}) && s.stock.join()==="1,2,3";
    s=mk(); s.draw=3; s.stock=[1,2,3,4,5]; GAME.apply(s,{t:"draw"}); R.drawThree=s.waste.join()==="5,4,3" && s.stock.length===2;
    return R; });
  const failed = Object.entries(rules).filter(([k,v])=>!v).map(([k])=>k);
  ok("every legal and illegal move type follows the rules ("+Object.keys(rules).length+" cases)", failed.length===0, failed.join(", "));

  // ---- tap sends a card to the best place; drag moves a run ----
  const tap = await p.evaluate(()=>{ UL.start("one",{seed:1}); const s=GAME.st; for(let k=0;k<60;k++){ const ms=GAME.moves(s); const m=ms.find(m=>m.t==="t2f"||m.t==="t2t"&&m.idx===s.down[m.from]&&s.down[m.from]>0); if(m) return {m, card:m.t==="t2f"?s.tab[m.from][s.tab[m.from].length-1]:s.tab[m.from][m.idx]}; GAME.doMove({t:s.stock.length?"draw":"recycle"},true); } return null; });
  if(tap){ const before = await p.evaluate(()=>GAME.st.moves); const xy = await cardXY(p, tap.card); await p.mouse.click(xy.x, xy.y); await p.waitForTimeout(250);
    ok("a tap sends a card to where it can go", await p.evaluate(([c,m,from])=>GAME.st.moves===m+1 && GAME.where(c).kind!=="x" && !(GAME.where(c).kind==="t" && GAME.where(c).i===from), [tap.card, before, tap.m.from])); }
  const run = await p.evaluate(()=>{ UL.start("one",{seed:4}); const s=GAME.st, C=(r,su)=>su*13+r-1;
    s.tab=[[C(9,1),C(8,0),C(7,1)],[C(9,2)],[C(13,2)],[],[],[],[]]; s.down=[0,0,0,0,0,0,0]; s.stock=[]; s.waste=[]; GAME.render(true); return {c:C(8,0), to:1}; });
  { const A = await cardXY(p, run.c), T = await p.evaluate(()=>{ const r=GAME.els[GAME.st.tab[1][0]].getBoundingClientRect(); return {x:r.left+r.width/2, y:r.top+r.height*0.7}; });
    await p.mouse.move(A.x, A.y); await p.mouse.down(); await p.mouse.move(T.x, T.y, {steps:8}); await p.mouse.up(); await p.waitForTimeout(250);
    ok("dragging a run of two onto a column moves the whole run", await p.evaluate(()=>GAME.st.tab[1].length===3 && GAME.st.tab[0].length===1)); }
  { const k = await p.evaluate(()=>GAME.st.tab[2][0]), A = await cardXY(p, k), T = await p.evaluate(()=>{ const r=GAME.els[GAME.st.tab[0][0]].getBoundingClientRect(); return {x:r.left+r.width/2, y:r.top+r.height*0.7}; });
    await p.mouse.move(A.x, A.y); await p.mouse.down(); await p.mouse.move(T.x, T.y, {steps:8}); await p.mouse.up(); await p.waitForTimeout(300);
    ok("an illegal drop goes back where it came from", await p.evaluate(k=>GAME.where(k).kind==="t" && GAME.where(k).i===2, k)); }

  // ---- undo limit and exact undo ----
  const undo = await p.evaluate(()=>{ UL.start("one",{seed:9}); const s=GAME.st; for(let k=0;k<8;k++) GAME.doMove({t:"draw"},true);
    const snap=JSON.stringify([s.stock,s.waste,s.tab,s.down,s.found]); GAME.doMove({t:"draw"},true); GAME.undoMove(); const exact=JSON.stringify([s.stock,s.waste,s.tab,s.down,s.found])===snap;
    for(let k=0;k<5;k++) GAME.undoMove(); return {exact, used:s.undosUsed, wall:document.getElementById('proVeil').classList.contains('show')}; });
  ok("undo restores the exact position; five free undos, the sixth opens the paywall", undo.exact && undo.used===5 && undo.wall);
  await p.click('#proClose'); await p.click('#resumeBtn').catch(()=>{});

  // ---- restart, save and reload ----
  const d1 = await p.evaluate(()=>{ UL.cur.sec=0; UL.restart(); return JSON.stringify([GAME.st.tab,GAME.st.stock]); });
  const d2 = await p.evaluate(()=>{ UL.restart(); return JSON.stringify([GAME.st.tab,GAME.st.stock]); });
  ok("restart replays the identical deal", d1===d2);
  await p.evaluate(()=>{ const s=GAME.st; for(let k=0;k<30;k++){ const ms=GAME.moves(s).filter(m=>m.t!=="f2t"); const m=ms.find(m=>m.t!=="draw"&&m.t!=="recycle")||ms[0]; if(m) GAME.doMove(m,true); } UL.save(); });
  const snap = await p.evaluate(()=>JSON.stringify(GAME.serialize())+"|"+UL.cur.score);
  await p.waitForTimeout(300); await p.reload(); await p.waitForTimeout(600);
  ok("reload restores every pile, face-down cards and the score exactly", snap===await p.evaluate(()=>JSON.stringify(GAME.serialize())+"|"+UL.cur.score) && await p.evaluate(()=>UL.cur.paused));
  ok("restored cards are drawn face up and down as they were", await p.evaluate(()=>document.querySelectorAll('.so-card.up').length===GAME.st.waste.length+GAME.st.found.reduce((a,f)=>a+f.length,0)+GAME.st.tab.reduce((a,t,c)=>a+t.length-GAME.st.down[c],0)));
  await p.click('#resumeBtn');

  // ---- a won game through the real game functions, then auto-finish ----
  const win = await p.evaluate(async()=>{ UL.start("one",{seed:0}); let sol=null, seed=0; for(;seed<40 && !sol;seed++){ UL.start("one",{seed}); sol=GAME.solve(GAME.st, 60000); }
    let finishShown=false; for(const m of sol){ if(GAME.allOpen(GAME.st)){ finishShown=GAME.finBtn.style.display!=="none"; break; } if(!GAME.doMove(m,true)) return {bad:"move refused "+JSON.stringify(m)}; }
    if(!GAME.won(GAME.st)) GAME.autoFinish(); await new Promise(r=>setTimeout(r,8000));
    return {won:GAME.won(GAME.st), finishShown, over:UL.cur.over, title:document.getElementById('endTitle').textContent, detail:document.getElementById('endDetail').textContent, recs:UL.kv("records",[]), share:UL.cur.shareTxt}; });
  ok("a solver's winning moves replay in the game; Finish appears when every card is face up and plays it out", win.won && win.over && win.finishShown && win.title==="Solved", (win.bad||"")+" "+win.detail);
  ok("the win is recorded", win.recs && win.recs.length===1 && win.recs[0].w===1);
  console.log("      share text: "+String(win.share).replace(/\n/g," / "));
  await p.waitForTimeout(600); await p.click('#endClose').catch(()=>{}); await p.click('#tabTrends'); await p.waitForTimeout(200);
  ok("Trends shows the record", await p.evaluate(()=>!!document.querySelector('.rank-card .rating')));
  await p.click('#tabPlay').catch(()=>{});

  // ---- stuck: a toast, and End game records a loss only when the player chooses it ----
  const stuck = await p.evaluate(async()=>{ UL.start("one",{seed:2}); const s=GAME.st, C=(r,su)=>su*13+r-1;
    const all=[...Array(52).keys()]; s.found=[[],[],[],[]]; s.tab=[[C(2,0)],[C(2,1)],[C(2,2)],[C(2,3)],[],[],[]]; s.down=[0,0,0,0,0,0,0]; s.waste=[]; s.stock=[C(5,0)];
    GAME.render(true); GAME.doMove({t:"draw"}); const toast=document.getElementById('toast').textContent, over1=UL.cur.over, endShown=GAME.endBtn.style.display!=="none";
    window.confirm=()=>true; GAME.giveUp(); await new Promise(r=>setTimeout(r,300)); return {toast, over1, endShown, over2:UL.cur.over, recs:UL.kv("records",[])}; });
  ok("when nothing can move, a toast says so and the game stays open", /No moves left/.test(stuck.toast) && !stuck.over1 && stuck.endShown, stuck.toast);
  ok("End game records a loss", stuck.over2 && stuck.recs.length===2 && stuck.recs[1].w===0);
  await p.click('#endClose').catch(()=>{});

  // ---- Pro ----
  { const cP = await b.newContext({viewport:{width:412,height:860}, offline:true}); const pp = await cP.newPage(); pp.on('pageerror',e=>errs.push("pro: "+e.message));
    await pp.addInitScript(()=>{ localStorage.setItem("ul_profile",JSON.stringify({name:"Blue Tokai",created:1})); localStorage.setItem("ul_solitaire_tut","true"); localStorage.setItem("ul_pro","true"); });
    await pp.goto(F); await pp.waitForTimeout(400); await pp.evaluate(()=>document.querySelectorAll('.veil.show').forEach(v=>v.classList.remove('show')));
    ok("with Pro, Draw three turns three cards", await pp.evaluate(()=>{ UL.start("three",{seed:3}); GAME.doMove({t:"draw"}); return GAME.st.waste.length===3 && GAME.st.stock.length===21; }));
    const wd = await pp.evaluate(async()=>{ UL.start("winnable",{seed:8}); const shown=!!document.querySelector('.so-dealing'); const t0=performance.now();
      while(!GAME.st && performance.now()-t0<20000) await new Promise(r=>setTimeout(r,50)); return {shown, ready:!!GAME.st, solvable:!!GAME.st && !!GAME.solve(GAME.st, 60000), cards:GAME.st ? GAME.els.length : 0}; });
    ok("with Pro, a winnable deal shows Dealing, then deals a game the solver can win", wd.shown && wd.ready && wd.solvable && wd.cards===52);
    ok("with Pro, undo is unlimited", await pp.evaluate(()=>{ UL.start("one",{seed:5}); for(let k=0;k<8;k++) GAME.doMove({t:"draw"},true); for(let k=0;k<8;k++) GAME.undoMove(); return GAME.st.undosUsed===8 && !document.getElementById('proVeil').classList.contains('show'); }));
    await cP.close(); }

  // ---- Daily ----
  const daily = pg => pg.evaluate(()=>{ UL.start("one",{daily:UL.dailyNum()}); return JSON.stringify([GAME.st.tab, GAME.st.stock]); });
  const dd1 = await daily(p); const ctx2 = await b.newContext({offline:true}); const p2 = await ctx2.newPage(); await p2.goto(F); await p2.waitForTimeout(400);
  const dd2 = await daily(p2); await ctx2.close();
  ok("the Daily deal is identical on two devices", dd1===dd2);

  // ---- many deals and games ----
  const deals = await p.evaluate(()=>{ const bad=[]; for(let k=0;k<500;k++){ UL.rng.s=100+k*7919; const st=GAME.deal(1+2*(k%2), UL.shuffle([...Array(52).keys()]));
      const all=[...st.stock, ...st.tab.flat()]; if(new Set(all).size!==52 || all.length!==52) bad.push("not 52 unique cards");
      if(!st.tab.every((t,c)=>t.length===c+1 && st.down[c]===c) || st.stock.length!==24) bad.push("layout"); } return [...new Set(bad)]; });
  ok("500 seeded deals: 52 unique cards in the right layout", deals.length===0, deals.join(", "));
  const bot = await p.evaluate(()=>{ const bad=[]; let moves=0;
    for(let g=0; g<300; g++){ UL.rng.s=7000+g*7919; const st=GAME.deal(1+2*(g%2), UL.shuffle([...Array(52).keys()]));
      for(let k=0;k<400;k++){ const ms=GAME.moves(st); if(!ms.length) break; const m=ms[UL.rnd(ms.length)], before=JSON.stringify(st), r=GAME.apply(st, m); moves++;
        if(!r){ bad.push("legal move refused"); break; }
        const all=[...st.stock, ...st.waste, ...st.found.flat(), ...st.tab.flat()]; if(all.length!==52 || new Set(all).size!==52){ bad.push("card count"); break; }
        if(st.tab.some((t,c)=>st.down[c] > Math.max(0, t.length-1))) { bad.push("a face-down card on top"); break; }
        if(k%25===0){ const back=JSON.parse(before); if(JSON.stringify(back)!==before) bad.push("snapshot"); } } }
    return {bad:[...new Set(bad)], moves}; });
  ok("300 random-play games: no crash, always 52 cards, no hidden card left on top", bot.bad.length===0, bot.bad.join(", ")||bot.moves+" moves");
  const solved = await p.evaluate(()=>{ let won=0, tried=0, bad=0; for(let k=0;k<200 && won<30;k++){ UL.rng.s=30000+k*104729; const st=GAME.deal(1, UL.shuffle([...Array(52).keys()])); tried++;
      const sol=GAME.solve(st, GAME.WIN_CAP); if(!sol) continue; const g=GAME.clone(st); for(const m of sol) if(!GAME.apply(g,m)){ bad++; break; } if(GAME.won(g)) won++; else bad++; }
    return {won, tried, bad}; });
  ok("30 winnable deals are each won by replaying the solver's moves", solved.won===30 && solved.bad===0, solved.won+" won from "+solved.tried+" deals tried");

  // ---- fits a small phone, even with long columns ----
  const c3 = await b.newContext({viewport:{width:360,height:640}, offline:true}); const p3 = await c3.newPage();
  await p3.addInitScript(()=>{ localStorage.setItem("ul_profile",JSON.stringify({name:"Blue Tokai",created:1})); localStorage.setItem("ul_solitaire_tut","true"); });
  await p3.goto(F); await p3.waitForTimeout(400);
  const fit = await p3.evaluate(()=>{ document.querySelectorAll('.veil.show').forEach(v=>v.classList.remove('show')); UL.start("one",{seed:6}); const s=GAME.st, C=(r,su)=>su*13+r-1;
    const col=[]; for(let r=13;r>=1;r--) col.push(C(r, r%2 ? 0 : 1)); s.tab[6]=s.tab[6].concat(col.filter(c=>!s.tab.flat().includes(c)&&!s.stock.includes(c))); GAME.render(true);
    const st=document.getElementById('stage').getBoundingClientRect(); const out=GAME.els.filter(e=>{ const r=e.getBoundingClientRect(); return r.bottom>st.bottom+2||r.right>st.right+2||r.left<st.left-2; }).length;
    return {out, scroll:document.documentElement.scrollHeight>innerHeight, cw:Math.round(GAME.els[0].getBoundingClientRect().width)}; });
  ok("nothing overflows or scrolls at 360x640, even with a long column", fit.out===0 && !fit.scroll, "cards "+fit.cw+"px wide");
  await c3.close();

  ok("nothing fetched from the network", ext.length===0, ext.join(","));
  ok("no page errors", errs.length===0, errs.join(" | "));
  await b.close();
})();
