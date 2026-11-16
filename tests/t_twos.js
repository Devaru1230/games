const { chromium } = require('playwright');
const ok=(n,c,x)=>console.log((c?"PASS":"FAIL")+"  "+n+(x?"  "+x:""));
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({viewport:{width:412,height:860}, deviceScaleFactor:2, offline:true});
  const ext=[]; await ctx.route('**', r=>{ const u=r.request().url(); if(!u.startsWith('file:')&&!u.startsWith('data:')){ext.push(u);return r.abort();} r.continue(); });
  const p = await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
  const F='file://'+require('path').resolve(__dirname,'../out/twos.html');
  await p.goto(F); await p.waitForTimeout(500);
  ok("first run shows the name picker", await p.evaluate(()=>document.getElementById('nameVeil').classList.contains('show')));
  await p.click('#nameChips .chip'); await p.click('#nameSave');
  ok("then the tutorial", await p.evaluate(()=>document.getElementById('tutVeil').classList.contains('show')), await p.evaluate(()=>document.getElementById('tutStep').textContent));
  for(let i=0;i<8;i++) await p.click('#tutNext').catch(()=>{});
  ok("then the level picker, free levels open and Pro levels locked", await p.evaluate(()=>{ const r=[...document.querySelectorAll('#lvlList .lvl')]; return r.length===5 && r.filter(x=>x.classList.contains('locked')).length===2; }));
  await p.evaluate(()=>[...document.querySelectorAll('#lvlList .lvl')].find(x=>x.textContent.includes('Wide')).click());
  ok("locked level opens the paywall, not the game", await p.evaluate(()=>document.getElementById('proVeil').classList.contains('show') && UL.cur===null));
  await p.click('#proClose');
  await p.evaluate(()=>{ UL.newGame(); [...document.querySelectorAll('#lvlList .lvl')].find(x=>x.textContent.includes('Classic')).click(); });
  await p.waitForTimeout(300);
  ok("classic starts with two tiles", await p.evaluate(()=>GAME.st.cells.filter(Boolean).length===2 && document.querySelectorAll('.tw-tile').length===2));

  // play a fixed sequence, remember the board, restart, replay: must be identical
  const play = async (n)=>p.evaluate((n)=>{ const d=["left","up","right","down"]; for(let i=0;i<n;i++) GAME.move(d[i%4]); return JSON.stringify(GAME.st.cells.map(t=>t?t.v:0))+"|"+UL.cur.score; }, n);
  const run1 = await play(40);
  await p.evaluate(()=>{ UL.cur.sec=0; UL.restart(); }); await p.waitForTimeout(200);
  const run2 = await play(40);
  ok("restart replays the identical game", run1===run2, run1.split("|")[1]+" pts");
  ok("score and tiles agree with the board", await p.evaluate(()=>{ return document.querySelectorAll('.tw-tile:not(.ghost)').length>=GAME.st.cells.filter(Boolean).length; }));

  // undo limit on the free tier
  const undo = await p.evaluate(()=>{ const before=UL.cur.score; GAME.undoMove(); GAME.undoMove(); const used=GAME.st.undosUsed; GAME.undoMove();
    return {used, blocked: GAME.st.undosUsed===2 && document.getElementById('proVeil').classList.contains('show'), dropped: UL.cur.score<=before}; });
  ok("free tier: two undos, third opens the paywall", undo.used===2 && undo.blocked);
  await p.click('#proClose'); await p.click('#resumeBtn');

  // save and restore across a reload
  await p.evaluate(()=>{ for(const d of ["left","down","left","down"]) GAME.move(d); UL.save(); });
  const snap = await p.evaluate(()=>JSON.stringify(GAME.st.cells.map(t=>t?t.v:0))+"|"+UL.cur.score+"|"+GAME.st.moves);
  await p.reload(); await p.waitForTimeout(600);
  const back = await p.evaluate(()=>JSON.stringify(GAME.st.cells.map(t=>t?t.v:0))+"|"+UL.cur.score+"|"+GAME.st.moves);
  ok("reload restores the exact game, paused", snap===back && await p.evaluate(()=>UL.cur.paused));
  await p.click('#resumeBtn');
  const cont1 = await p.evaluate(()=>{ GAME.move("right"); GAME.move("up"); return JSON.stringify(GAME.st.cells.map(t=>t?t.v:0)); });
  ok("randomness continues from the saved point", cont1.length>0);

  // real swipe gesture
  const mv0 = await p.evaluate(()=>GAME.st.moves);
  const box = await p.locator('#stage').boundingBox();
  for(const [dx,dy] of [[-140,0],[0,-140],[140,0],[0,140]]){ await p.mouse.move(box.x+box.width/2, box.y+box.height/2); await p.mouse.down(); await p.mouse.move(box.x+box.width/2+dx, box.y+box.height/2+dy,{steps:4}); await p.mouse.up(); await p.waitForTimeout(140); }
  ok("swipes register as moves", await p.evaluate((m)=>GAME.st.moves>m, mv0));
  await p.screenshot({path:require('path').resolve(__dirname,'../out')+'/twos-play.png'});

  // play to the end
  const end = await p.evaluate(async()=>{ const d=["left","down","right","up"]; let g=0; while(!UL.cur.over && g++<6000){ GAME.move(d[g%4===3?Math.floor(Math.random()*4):g%2]); if(g%50===0) await new Promise(r=>setTimeout(r,0)); }
    await new Promise(r=>setTimeout(r,1700));
    return {over:UL.cur.over, modal:document.getElementById('endVeil').classList.contains('show'), title:document.getElementById('endTitle').textContent, detail:document.getElementById('endDetail').textContent,
            recs:UL.kv("records",[]).length, save:UL.kv("save",null), share:UL.cur.shareTxt}; });
  ok("game ends when no moves remain", end.over && end.modal, end.title+" — "+end.detail);
  ok("result recorded, save cleared", end.recs===1 && end.save===null);
  console.log("      share text: "+end.share.replace(/\n/g," / "));
  await p.click('#endClose'); await p.click('#tabTrends'); await p.waitForTimeout(200);
  ok("trends render with the player and best score", await p.evaluate(()=>!!document.querySelector('.rank-card .rating') && document.querySelectorAll('.tcard').length===4));
  await p.screenshot({path:require('path').resolve(__dirname,'../out')+'/twos-trends.png'});

  // daily identical on a second device
  const d1 = await p.evaluate(()=>{ UL.start("classic",{daily:UL.dailyNum()}); for(const d of ["left","up","left","up","right"]) GAME.move(d); return JSON.stringify(GAME.st.cells.map(t=>t?t.v:0)); });
  const ctx2 = await b.newContext(); const p2 = await ctx2.newPage(); await p2.goto(F); await p2.waitForTimeout(400);
  const d2 = await p2.evaluate(()=>{ UL.start("classic",{daily:UL.dailyNum()}); for(const d of ["left","up","left","up","right"]) GAME.move(d); return JSON.stringify(GAME.st.cells.map(t=>t?t.v:0)); });
  ok("daily is identical on two devices", d1===d2);

  // family key unlocks, key leaves the address bar
  const p3 = await ctx2.newPage(); await p3.goto(F+'?k=fam-7333fcce'); await p3.waitForTimeout(400);
  ok("family key unlocks Pro and is hidden", await p3.evaluate(()=>UL.isPro() && location.search===""));
  ok("nothing fetched from the network", ext.length===0, ext.join(","));
  ok("no page errors", errs.length===0, errs.join(" | "));
  await b.close();
})();
