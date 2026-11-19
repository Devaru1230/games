const { chromium } = require('playwright');
const path = require('path');
const ok=(n,c,x)=>console.log((c?"PASS":"FAIL")+"  "+n+(x?"  "+x:""));
const F='file://'+path.resolve(__dirname,'../out/blocks.html');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({viewport:{width:412,height:860}, offline:true});
  const ext=[]; await ctx.route('**', r=>{ const u=r.request().url(); if(!u.startsWith('file:')&&!u.startsWith('data:')){ext.push(u);return r.abort();} r.continue(); });
  const p = await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
  await p.goto(F); await p.waitForTimeout(500);
  const fresh = (n)=>({n, board:new Array(n*n).fill(0), queue:[], hold:null, placed:0, lines:0, streak:0, master:false, limit:0});

  // ---- first run ----
  ok("first run shows the name picker", await p.evaluate(()=>document.getElementById('nameVeil').classList.contains('show')));
  await p.click('#nameChips .chip'); await p.click('#nameSave');
  ok("then the tutorial", await p.evaluate(()=>document.getElementById('tutVeil').classList.contains('show')), await p.evaluate(()=>document.getElementById('tutStep').textContent));
  for(let i=0;i<8;i++) await p.click('#tutNext').catch(()=>{});
  ok("then the level picker, Classic and Quick open, Big and Master locked", await p.evaluate(()=>{ const r=[...document.querySelectorAll('#lvlList .lvl')];
    const l=r.filter(x=>x.classList.contains('locked')); return r.length===5 && l.length===2 && l.every(x=>/Big|Master/.test(x.textContent)); }));
  await p.evaluate(()=>[...document.querySelectorAll('#lvlList .lvl')].find(x=>x.textContent.includes('Master')).click());
  ok("a Pro level opens the paywall, not the game", await p.evaluate(()=>document.getElementById('proVeil').classList.contains('show') && UL.cur===null));
  await p.click('#proClose');
  await p.evaluate(()=>{ UL.newGame(); [...document.querySelectorAll('#lvlList .lvl')].find(x=>x.textContent.includes('Classic')).click(); });
  await p.waitForTimeout(300);
  ok("Classic starts: an empty 8x8 board that fills the play area, with Now, Next and Then shown", await p.evaluate(()=>{ const s=document.getElementById('stage').getBoundingClientRect(), bd=GAME.board.getBoundingClientRect();
    return document.querySelectorAll('.bk-cell').length===64 && !document.querySelector('.bk-cell.on') && document.querySelectorAll('.bk-q .bk-piece').length===3 && Math.abs(bd.width-s.width)<2; }));

  // ---- touch, slide, let go: the shape drops straight down ----
  const colX = async (pg, col) => pg.evaluate(c=>{ const s=GAME.st, sh=BK_BYKEY[s.queue[0]], r=GAME.board.getBoundingClientRect(), cs=r.width/s.n; return {x:r.left+(c+GAME.width(sh)/2)*cs, y:r.top+r.height*0.4}; }, col);
  const before = await p.evaluate(()=>({key:GAME.st.queue[0], next:GAME.st.queue[1], n:BK_BYKEY[GAME.st.queue[0]].cells.length, h:GAME.height(BK_BYKEY[GAME.st.queue[0]])}));
  const A = await colX(p, 0), B = await colX(p, 2);
  await p.mouse.move(A.x, A.y); await p.mouse.down(); await p.waitForTimeout(40);
  const ghost0 = await p.evaluate(()=>[...document.querySelectorAll('.bk-cell.ghost')].map(c=>GAME.cells.indexOf(c)));
  await p.mouse.move(B.x, B.y, {steps:6}); await p.waitForTimeout(40);
  const ghost2 = await p.evaluate(()=>[...document.querySelectorAll('.bk-cell.ghost')].map(c=>GAME.cells.indexOf(c)));
  ok("touching the board shows where the shape will land, at the bottom", ghost0.length===before.n && ghost0.every(i=>Math.floor(i/8) >= 8-before.h), ghost0.join(","));
  ok("sliding moves the shadow to another column", ghost2.length===before.n && ghost2.every(i=>i%8>=2) && ghost0.join()!==ghost2.join());
  await p.mouse.up(); await p.waitForTimeout(320);
  const after = await p.evaluate(g=>({on:[...document.querySelectorAll('.bk-cell.on')].map(c=>GAME.cells.indexOf(c)), score:UL.cur.score, now:GAME.st.queue[0]}), ghost2);
  ok("letting go drops it where the shadow was and scores a point per cell", JSON.stringify(after.on.sort((a,c)=>a-c))===JSON.stringify(ghost2.sort((a,c)=>a-c)) && after.score===before.n, after.on.join(","));
  ok("the Next shape becomes Now", after.now===before.next);

  // ---- the drop rules ----
  const rules = await p.evaluate(()=>{ const n=4, st={n, board:new Array(16).fill(0), queue:[], hold:null, placed:0, lines:0, streak:0, master:false, limit:0};
    st.board[3*4+0]=1; st.board[2*4+0]=1;                                    // a tower of two in column 0
    st.queue=["0,0;1,0","0,0","0,0"]; const y=GAME.landing(st.board,n,BK_BYKEY["0,0;1,0"],0);       // a flat domino over it rests on top of the tower
    const blocked=GAME.landing(st.board,n,BK_BYKEY["0,0;1,0"],3);              // too wide at the edge
    st.board=new Array(16).fill(0); for(let c=0;c<3;c++) st.board[12+c]=1; st.board[8]=2; st.queue=["0,0","0,0","0,0"];
    const r=GAME.drop(st,3); return {y, blocked, lines:r.lines, fell:st.board[12]===2 && st.board[8]===0, points:r.points}; });
  ok("a shape rests on the first block it meets, and cannot hang off the edge", rules.y===1 && rules.blocked===-1);
  ok("a full row clears, the rows above fall, and it scores 1 + 10 + streak 5", rules.lines===1 && rules.fell && rules.points===16, "points "+rules.points);
  const sc2 = await p.evaluate(()=>{ const n=4, st={n, board:new Array(16).fill(0), queue:["0,0;0,1","0,0","0,0"], hold:null, placed:0, lines:0, streak:1, master:false, limit:0};
    for(let c=0;c<3;c++){ st.board[8+c]=1; st.board[12+c]=1; } const r=GAME.drop(st,3); return {lines:r.lines, points:r.points, streak:r.streak, empty:r.empty}; });
  ok("two rows at once with a streak: 2 + 10x2x2 + streak 2x5 = 52, and the board is empty", sc2.lines===2 && sc2.points===52 && sc2.empty, JSON.stringify(sc2));

  // ---- restart and save ----
  const deal1 = await p.evaluate(()=>{ UL.cur.sec=0; UL.restart(); return JSON.stringify(GAME.st.queue); });
  const deal2 = await p.evaluate(()=>{ UL.restart(); return JSON.stringify(GAME.st.queue); });
  ok("restart replays the identical shapes", deal1===deal2);
  await p.evaluate(()=>{ UL.start("classic",{seed:99}); for(let k=0;k<6;k++){ const s=GAME.st, sh=BK_BYKEY[s.queue[0]]; for(let x=0;x+GAME.width(sh)<=8;x++) if(GAME.landing(s.board,8,sh,x)>=0){ GAME.play(x); break; } } GAME.st.streak=3; UL.save(); });
  await p.waitForTimeout(400);
  const snap = await p.evaluate(()=>JSON.stringify(GAME.serialize())+"|"+UL.cur.score);
  await p.reload(); await p.waitForTimeout(600);
  ok("reload restores the board, the waiting shapes, the streak and score exactly", snap===await p.evaluate(()=>JSON.stringify(GAME.serialize())+"|"+UL.cur.score) && await p.evaluate(()=>UL.cur.paused));
  ok("restored board and shapes are drawn", await p.evaluate(()=>document.querySelectorAll('.bk-cell.on').length===GAME.st.board.filter(Boolean).length && document.querySelectorAll('.bk-q .bk-piece').length===3));
  await p.click('#resumeBtn');

  // ---- a full game to the end, a personal best, records and Trends ----
  const end = await p.evaluate(async()=>{ UL.start("classic",{seed:2024}); let g=0;
    while(!GAME.ending && g++<600){ const s=GAME.st, sh=BK_BYKEY[s.queue[0]]; let x=-1; for(let c=0;c+GAME.width(sh)<=8;c++) if(GAME.landing(s.board,8,sh,c)>=0){ x=c; break; } if(x<0) break; GAME.play(x); GAME.checkEnd(); }
    await new Promise(r=>setTimeout(r,1900));
    return {over:UL.cur.over, modal:document.getElementById('endVeil').classList.contains('show'), title:document.getElementById('endTitle').textContent, detail:document.getElementById('endDetail').textContent,
      recs:UL.kv("records",[]), best:UL.kv("best_classic",0), score:UL.cur.score, share:UL.cur.shareTxt, stuck:!GAME.canPlay(GAME.st)}; });
  ok("the game ends only when the next shape fits nowhere", end.over && end.modal && end.stuck, end.title+" — "+end.detail);
  ok("the end is a normal finish with a record and a new best", end.recs.length===1 && end.recs[0].w===1 && end.best===end.score && end.title==="New best");
  console.log("      share text: "+String(end.share).replace(/\n/g," / "));
  await p.click('#endClose'); await p.click('#tabTrends'); await p.waitForTimeout(200);
  ok("Trends shows the record", await p.evaluate(()=>!!document.querySelector('.rank-card .rating')));
  await p.click('#tabPlay').catch(()=>{});

  // ---- Quick: ends after 30 shapes ----
  const quick = await p.evaluate(async()=>{ UL.start("quick",{seed:5}); let g=0;
    while(!GAME.ending && g++<200){ const s=GAME.st, sh=BK_BYKEY[s.queue[0]]; let best=null;
      for(let x=0;x+GAME.width(sh)<=6;x++){ const y=GAME.landing(s.board,6,sh,x); if(y>=0 && (!best||y>best.y)) best={x,y}; } if(!best) break; GAME.play(best.x); GAME.checkEnd(); }
    await new Promise(r=>setTimeout(r,1900)); return {placed:GAME.st.placed, over:UL.cur.over, detail:document.getElementById('endDetail').textContent}; });
  ok("Quick ends after 30 shapes", quick.over && quick.placed===30, quick.placed+" placed — "+quick.detail);
  await p.click('#endClose').catch(()=>{});

  // ---- Pro: Big and Master ----
  { const cP = await b.newContext({viewport:{width:412,height:860}, offline:true}); const pp = await cP.newPage(); pp.on('pageerror',e=>errs.push("pro: "+e.message));
    await pp.addInitScript(()=>{ localStorage.setItem("ul_profile",JSON.stringify({name:"Blue Tokai",created:1})); localStorage.setItem("ul_blocks_tut","true"); localStorage.setItem("ul_pro","true"); });
    await pp.goto(F); await pp.waitForTimeout(400); await pp.evaluate(()=>document.querySelectorAll('.veil.show').forEach(v=>v.classList.remove('show')));
    ok("with Pro, Big starts with a 10x10 board", await pp.evaluate(()=>{ UL.start("big",{}); return document.querySelectorAll('.bk-cell').length===100; }));
    await pp.evaluate(()=>{ UL.start("master",{seed:3}); GAME.st.queue[0]="0,0;1,0;2,0"; GAME.paintQueue(); });
    ok("Master shows Rotate and Hold", await pp.evaluate(()=>[...document.querySelectorAll('.ctrl')].some(c=>/Rotate/.test(c.textContent)) && !!document.querySelector('.bk-q.hold')));
    const rb = await pp.locator('.ctrl', {hasText:'Rotate'}).boundingBox(); await pp.mouse.click(rb.x+rb.width/2, rb.y+rb.height/2); await pp.waitForTimeout(80);
    ok("Master: Rotate turns the current shape", await pp.evaluate(()=>GAME.st.queue[0]==="0,0;0,1;0,2"));
    const hb = await pp.locator('.ctrl', {hasText:'Hold'}).boundingBox(); const nx = await pp.evaluate(()=>GAME.st.queue[1]);
    await pp.mouse.click(hb.x+hb.width/2, hb.y+hb.height/2); await pp.waitForTimeout(80);
    ok("Master: Hold keeps the shape aside and the next one comes up", await pp.evaluate(nx=>GAME.st.hold==="0,0;0,1;0,2" && GAME.st.queue[0]===nx, nx));
    ok("Master: the end check counts rotations and the held shape", await pp.evaluate(()=>{ const st={n:2, board:[0,1,0,1], queue:["0,0;1,0","0,0","0,0"], hold:null, master:true};
      const a=GAME.canPlay(st); st.master=false; const c=GAME.canPlay(st); st.hold="0,0"; const d=GAME.canPlay(st); return a && !c && !d; }));
    await cP.close(); }

  // ---- Daily ----
  const daily = pg => pg.evaluate(()=>{ UL.start("classic",{daily:UL.dailyNum()}); return JSON.stringify(GAME.st.queue); });
  const d1 = await daily(p); const ctx2 = await b.newContext({offline:true}); const p2 = await ctx2.newPage(); await p2.goto(F); await p2.waitForTimeout(400);
  const d2 = await daily(p2); await ctx2.close();
  ok("the Daily is identical on two devices", d1===d2);

  // ---- 300 games by a random-valid bot ----
  const bot = await p.evaluate(()=>{ const bad=[], tiers={1:0,2:0,3:0,4:0}; let drops=0, games=0;
    for(let g=0; g<300; g++){ UL.rng.s=4000+g*7919; const L=GAME.levels[g%3]; const st={n:L.n, board:new Array(L.n*L.n).fill(0), queue:[], hold:null, placed:0, lines:0, streak:0, master:false, limit:L.limit||0}; games++;
      GAME.refill(st);
      for(let k=0;k<3000;k++){ if(st.limit && st.placed>=st.limit) break; const sh=BK_BYKEY[st.queue[0]];
        const cols=[]; for(let x=0;x+GAME.width(sh)<=st.n;x++) if(GAME.landing(st.board,st.n,sh,x)>=0) cols.push(x);
        if(!cols.length){ if(GAME.canPlay(st)) bad.push("stopped while a shape fits"); break; }
        const x=cols[UL.rnd(cols.length)], y=GAME.landing(st.board,st.n,sh,x), before=st.board.slice(), cnt=before.filter(Boolean).length;
        if(GAME.fits(before,st.n,sh,x,y+1)) bad.push("did not fall all the way");
        const r=GAME.drop(st,x); drops++; if(!r){ bad.push("valid drop refused"); break; }
        const check=before.slice(); r.placed.forEach(i=>check[i]=1); r.rows.forEach(rr=>{ for(let c=0;c<st.n;c++) if(!check[rr*st.n+c]) bad.push("cleared a row that was not full"); });
        if(st.board.filter(Boolean).length !== cnt + sh.cells.length - r.lines*st.n) bad.push("blocks lost or made up");
        if(r.points<=0) bad.push("score did not grow");
        if(r.lines){ const t=(r.streak>=5||r.lines>=4||r.empty)?4:r.lines>=3?3:r.lines===2?2:1; tiers[t]++; } } }
    return {bad:[...new Set(bad)], drops, perGame:Object.fromEntries(Object.entries(tiers).map(([k,v])=>[k,(v/games).toFixed(2)]))}; });
  ok("300 bot games: shapes fall all the way, only full rows clear, no block is lost, the end comes only when nothing fits", bot.bad.length===0, bot.bad.join(", ")||bot.drops+" drops");
  ok("tier 4 praise is rare (under once a game for a random player)", +bot.perGame[4] < 1, "per game: "+JSON.stringify(bot.perGame));

  // ---- small and tall phones: fits, and a real touch drops a shape ----
  for(const [w,h] of [[360,640],[412,915]]){
    const c3 = await b.newContext({viewport:{width:w,height:h}, offline:true}); const p3 = await c3.newPage();
    await p3.addInitScript(()=>{ localStorage.setItem("ul_profile",JSON.stringify({name:"Blue Tokai",created:1})); localStorage.setItem("ul_blocks_tut","true"); });
    await p3.goto(F); await p3.waitForTimeout(400);
    await p3.evaluate(()=>{ document.querySelectorAll('.veil.show').forEach(v=>v.classList.remove('show')); UL.start("classic",{seed:12}); });
    const fit = await p3.evaluate(()=>({scroll:document.documentElement.scrollHeight>innerHeight, q:Math.round(document.querySelector('.bk-queue').getBoundingClientRect().bottom), cell:Math.round(GAME.cells[0].getBoundingClientRect().width)}));
    const n = await p3.evaluate(()=>BK_BYKEY[GAME.st.queue[0]].cells.length), t = await colX(p3, 3);
    await p3.mouse.move(t.x, t.y); await p3.mouse.down(); await p3.mouse.up(); await p3.waitForTimeout(320);
    const placed = await p3.evaluate(n=>GAME.st.board.filter(Boolean).length===n, n);
    ok("at "+w+"x"+h+": nothing scrolls, the waiting shapes are on screen, a tap drops a shape", !fit.scroll && fit.q<=h && placed, "squares "+fit.cell+"px, queue ends at "+fit.q+"px");
    await c3.close();
  }

  ok("nothing fetched from the network", ext.length===0, ext.join(","));
  ok("no page errors", errs.length===0, errs.join(" | "));
  await b.close();
})();
