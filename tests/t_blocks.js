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
  ok("Classic starts: empty 8x8 board and three shapes in the tray", await p.evaluate(()=>document.querySelectorAll('.bk-cell').length===64 && !document.querySelector('.bk-cell.on') && document.querySelectorAll('.bk-slot .bk-piece').length===3));

  // ---- drag and drop with real pointer events ----
  const dragTo = async (pg, slot, gx, gy) => {
    const sb = await pg.locator('.bk-slot').nth(slot).boundingBox();
    const t = await pg.evaluate(([slot,gx,gy])=>{ const sh=BK_BYKEY[GAME.st.tray[slot]], cs=GAME.cellSize(), r=GAME.board.getBoundingClientRect();
      const w=(Math.max(...sh.cells.map(c=>c[0]))+1)*cs, h=(Math.max(...sh.cells.map(c=>c[1]))+1)*cs;
      return {x:r.left+gx*cs+w/2, y:r.top+gy*cs+h+cs*0.9}; }, [slot,gx,gy]);   // where the finger must be for the shape to land at gx,gy
    await pg.mouse.move(sb.x+sb.width/2, sb.y+sb.height/2); await pg.mouse.down();
    await pg.mouse.move((sb.x+t.x)/2, (sb.y+t.y)/2, {steps:5}); await pg.mouse.move(t.x, t.y, {steps:8});
    const ghost = await pg.evaluate(()=>document.querySelectorAll('.bk-cell.ghost').length);
    await pg.mouse.up(); await pg.waitForTimeout(120); return ghost;
  };
  const before = await p.evaluate(()=>({tray:GAME.st.tray.slice(), n:BK_BYKEY[GAME.st.tray[0]].cells.length}));
  const gh = await dragTo(p, 0, 0, 0);
  ok("dragging shows a ghost where the shape will land", gh===before.n, gh+" ghost cells");
  ok("dropping places the shape and scores a point per cell", await p.evaluate(n=>document.querySelectorAll('.bk-cell.on').length===n && UL.cur.score===n && GAME.st.tray[0]===null, before.n));
  const occupied = await p.evaluate(()=>GAME.st.board.filter(Boolean).length);
  const bad = await dragTo(p, 1, 0, 0);
  ok("an invalid drop returns the shape to the tray", await p.evaluate(o=>GAME.st.board.filter(Boolean).length===o && GAME.st.tray[1]!==null && !document.querySelector('.bk-float'), occupied));

  // ---- restart replays the identical deal ----
  const deal1 = await p.evaluate(()=>{ UL.cur.sec=0; UL.restart(); return JSON.stringify(GAME.st.tray); });
  const deal2 = await p.evaluate(()=>{ UL.restart(); return JSON.stringify(GAME.st.tray); });
  ok("restart replays the identical shapes", deal1===deal2 && JSON.stringify(before.tray)===deal1);

  // ---- line clears, scoring and streaks ----
  const sc = await p.evaluate(()=>{ UL.start("classic",{seed:1}); const s=GAME.st;
    for(let c=0;c<7;c++) s.board[c]=1; for(let r=1;r<8;r++) s.board[r*8+7]=1;   // row 0 and column 7 each miss one cell: the corner
    s.tray=[BK_BYKEY["0,0"].key, s.tray[1], s.tray[2]]; s.streak=0; GAME.paintBoard(); GAME.paintTray(); UL.setScore(0);
    GAME.play("0",7,0); const two={score:UL.cur.score, row:s.board.slice(0,8).every(v=>!v), col:[...Array(8)].every((_,r)=>!s.board[r*8+7]), streak:s.streak};
    for(let c=0;c<7;c++) s.board[8+c]=1; s.tray[1]="0,0"; const sc0=UL.cur.score; GAME.play("1",7,1);
    return {two, one:UL.cur.score-sc0, streak:s.streak}; });
  ok("a row and a column clear together: 1 + 10x2x2 + streak 5 = 46", sc.two.row && sc.two.col && sc.two.score===46, "score "+sc.two.score);
  ok("a second clear in a row scores 1 + 10 + streak 2x5 = 21", sc.one===21 && sc.streak===2, "+"+sc.one);

  // ---- save and reload ----
  await p.evaluate(()=>{ UL.start("classic",{seed:99}); const s=GAME.st; for(let k=0;k<4;k++){ let d=false; for(let i=0;i<3&&!d;i++){ const key=s.tray[i]; if(!key) continue;
      for(let y=0;y<8&&!d;y++) for(let x=0;x<8&&!d;x++) if(GAME.fits(s.board,8,BK_BYKEY[key],x,y)){ GAME.play(String(i),x,y); d=true; } } } s.streak=3; UL.save(); });
  const snap = await p.evaluate(()=>JSON.stringify(GAME.serialize())+"|"+UL.cur.score);
  await p.reload(); await p.waitForTimeout(600);
  ok("reload restores the board, tray, streak and score exactly", snap===await p.evaluate(()=>JSON.stringify(GAME.serialize())+"|"+UL.cur.score) && await p.evaluate(()=>UL.cur.paused));
  ok("restored board and tray are drawn", await p.evaluate(()=>document.querySelectorAll('.bk-cell.on').length===GAME.st.board.filter(Boolean).length && document.querySelectorAll('.bk-slot .bk-piece').length===GAME.st.tray.filter(Boolean).length));
  await p.click('#resumeBtn');

  // ---- a full game to the end, then a personal best, records and Trends ----
  const end = await p.evaluate(async()=>{ UL.start("classic",{seed:2024}); const s=GAME.st; let g=0;
    while(!GAME.ending && g++<400){ let d=false; for(let i=0;i<3&&!d;i++){ const key=s.tray[i]; if(!key) continue;
      for(let y=0;y<8&&!d;y++) for(let x=0;x<8&&!d;x++) if(GAME.fits(s.board,8,BK_BYKEY[key],x,y)){ GAME.play(String(i),x,y); d=true; } } if(!d) break; }
    await new Promise(r=>setTimeout(r,1900));
    return {over:UL.cur.over, modal:document.getElementById('endVeil').classList.contains('show'), title:document.getElementById('endTitle').textContent, detail:document.getElementById('endDetail').textContent,
      recs:UL.kv("records",[]), best:UL.kv("best_classic",0), score:UL.cur.score, share:UL.cur.shareTxt, stuck:!GAME.canPlay(s)}; });
  ok("the game ends only when no waiting shape fits", end.over && end.modal && end.stuck, end.title+" — "+end.detail);
  ok("the end is a normal finish with a record and a new best", end.recs.length===1 && end.recs[0].w===1 && end.best===end.score && end.title==="New best");
  console.log("      share text: "+String(end.share).replace(/\n/g," / "));
  await p.click('#endClose'); await p.click('#tabTrends'); await p.waitForTimeout(200);
  ok("Trends shows the record", await p.evaluate(()=>!!document.querySelector('.rank-card .rating')));
  await p.click('#tabPlay').catch(()=>{});

  // ---- Quick: ends after 30 shapes ----
  const quick = await p.evaluate(async()=>{ UL.start("quick",{seed:5}); const s=GAME.st; let g=0;
    while(!GAME.ending && g++<200){ let d=false; for(let i=0;i<3&&!d;i++){ const key=s.tray[i]; if(!key) continue;
      for(let y=0;y<6&&!d;y++) for(let x=0;x<6&&!d;x++) if(GAME.fits(s.board,6,BK_BYKEY[key],x,y)){ GAME.play(String(i),x,y); d=true; } } if(!d) break; }
    await new Promise(r=>setTimeout(r,1900)); return {placed:s.placed, over:UL.cur.over, detail:document.getElementById('endDetail').textContent}; });
  ok("Quick ends after 30 shapes (or sooner if nothing fits)", quick.over && (quick.placed===30 || /No shape fits/.test(quick.detail)), quick.placed+" placed — "+quick.detail);
  await p.click('#endClose').catch(()=>{});

  // ---- Pro: Big and Master; Master can rotate and hold ----
  { const cP = await b.newContext({viewport:{width:412,height:860}, offline:true}); const pp = await cP.newPage(); pp.on('pageerror',e=>errs.push("pro: "+e.message));
    await pp.addInitScript(()=>{ localStorage.setItem("ul_profile",JSON.stringify({name:"Blue Tokai",created:1})); localStorage.setItem("ul_blocks_tut","true"); localStorage.setItem("ul_pro","true"); });
    await pp.goto(F); await pp.waitForTimeout(400); await pp.evaluate(()=>document.querySelectorAll('.veil.show').forEach(v=>v.classList.remove('show')));
    const p = pp;
  ok("with Pro, Big starts with a 10x10 board", await p.evaluate(()=>{ UL.start("big",{}); return document.querySelectorAll('.bk-cell').length===100; }));
  await p.evaluate(()=>{ UL.start("master",{seed:3}); GAME.st.tray[0]="0,0;1,0;2,0"; GAME.paintTray(); });
  ok("Master shows a Hold slot", await p.evaluate(()=>!!document.querySelector('.bk-slot.hold')));
  const sb = await p.locator('.bk-slot').nth(0).boundingBox(); await p.mouse.click(sb.x+sb.width/2, sb.y+sb.height/2); await p.waitForTimeout(80);
  ok("Master: a tap rotates a tray shape", await p.evaluate(()=>GAME.st.tray[0]==="0,0;0,1;0,2"));
  const hb = await p.locator('.bk-slot.hold').boundingBox(); await p.mouse.move(sb.x+sb.width/2, sb.y+sb.height/2); await p.mouse.down();
  await p.mouse.move(hb.x+hb.width/2, hb.y+hb.height/2, {steps:8}); await p.mouse.up(); await p.waitForTimeout(80);
  ok("Master: dragging a shape onto Hold stores it", await p.evaluate(()=>GAME.st.hold==="0,0;0,1;0,2" && GAME.st.tray[0]===null));
  ok("Master: the game over check counts rotations and the held shape", await p.evaluate(()=>{ const st={n:2, board:[0,1,1,1], tray:["0,0;1,0",null,null], hold:null, master:true};
    const a=GAME.canPlay(st); st.board=[0,1,0,1]; const b=GAME.canPlay(st); st.master=false; const c=GAME.canPlay(st); return !a && b && !c; }));
    await cP.close(); }

  // ---- Daily identical on two devices ----
  const daily = pg => pg.evaluate(()=>{ UL.start("classic",{daily:UL.dailyNum()}); return JSON.stringify(GAME.st.tray); });
  const d1 = await daily(p); const ctx2 = await b.newContext({offline:true}); const p2 = await ctx2.newPage(); await p2.goto(F); await p2.waitForTimeout(400);
  const d2 = await daily(p2); await ctx2.close();
  ok("the Daily is identical on two devices", d1===d2);

  // ---- 300 games by a random-valid bot ----
  const bot = await p.evaluate(()=>{ const bad=[]; const tiers={1:0,2:0,3:0,4:0}; let placements=0, games=0;
    for(let g=0; g<300; g++){ UL.rng.s = 4000+g*7919; const lv = GAME.levels[g%3]; const st={n:lv.n, board:new Array(lv.n*lv.n).fill(0), tray:[], hold:null, placed:0, lines:0, streak:0, master:false, limit:lv.limit||0}; let score=0; games++;
      GAME.deal(st);
      for(let step=0; step<2000; step++){
        if(st.limit && st.placed>=st.limit) break;
        const opts=[]; st.tray.forEach((k,i)=>{ if(!k) return; const sh=BK_BYKEY[k]; for(let y=0;y<st.n;y++) for(let x=0;x<st.n;x++) if(GAME.fits(st.board,st.n,sh,x,y)) opts.push([i,x,y]); });
        if(!opts.length){ if(GAME.canPlay(st)) bad.push("stopped while a shape fits"); break; }
        const [i,x,y] = opts[UL.rnd(opts.length)], before = st.board.slice(), res = GAME.place(st, st.tray[i], x, y); placements++;
        if(!res){ bad.push("valid placement refused"); break; }
        const check=before.slice(); res.placed.forEach(c=>check[c]=1);
        res.rows.forEach(r=>{ for(let c=0;c<st.n;c++) if(!check[r*st.n+c]) bad.push("cleared a row that was not full"); });
        res.cols.forEach(c=>{ for(let r=0;r<st.n;r++) if(!check[r*st.n+c]) bad.push("cleared a column that was not full"); });
        if(res.points<=0) bad.push("score did not grow"); score+=res.points;
        if(res.lines){ const t=(res.streak>=5||res.lines>=4||res.empty)?4:res.lines>=3?3:res.lines===2?2:1; tiers[t]++; }
        st.tray[i]=null; if(st.tray.every(k=>!k)) GAME.deal(st);
      } }
    return {bad:[...new Set(bad)], tiers, perGame:Object.fromEntries(Object.entries(tiers).map(([k,v])=>[k,(v/games).toFixed(2)])), placements}; });
  ok("300 bot games: no crash, scores only grow, cleared lines were full, the end comes only when nothing fits", bot.bad.length===0, bot.bad.join(", ")||bot.placements+" placements");
  ok("tier 4 praise is rare (under once a game for a random player)", +bot.perGame[4] < 1, "per game: "+JSON.stringify(bot.perGame));

  // ---- fits a small phone, and a tall one; dragging works on both ----
  for(const [w,h] of [[360,640],[412,915]]){
    const c3 = await b.newContext({viewport:{width:w,height:h}, offline:true, hasTouch:false}); const p3 = await c3.newPage();
    await p3.addInitScript(()=>{ localStorage.setItem("ul_profile",JSON.stringify({name:"Blue Tokai",created:1})); localStorage.setItem("ul_blocks_tut","true"); });
    await p3.goto(F); await p3.waitForTimeout(400);
    await p3.evaluate(()=>{ document.querySelectorAll('.veil.show').forEach(v=>v.classList.remove('show')); UL.start("classic",{seed:12}); });
    const fit = await p3.evaluate(()=>({scroll:document.documentElement.scrollHeight>innerHeight, tray:Math.round(document.querySelector('.bk-tray').getBoundingClientRect().bottom)}));
    const n = await p3.evaluate(()=>BK_BYKEY[GAME.st.tray[2]].cells.length); const g = await dragTo(p3, 2, 2, 3);
    const placed = await p3.evaluate(n=>GAME.st.board.filter(Boolean).length===n, n);
    ok("at "+w+"x"+h+": nothing scrolls, the tray is on screen, and a real drag places a shape", !fit.scroll && fit.tray<=h && placed && g===n, "tray ends at "+fit.tray+"px");
    await c3.close();
  }

  ok("nothing fetched from the network", ext.length===0, ext.join(","));
  ok("no page errors", errs.length===0, errs.join(" | "));
  await b.close();
})();
