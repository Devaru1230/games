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
  ok("classic starts with a full box of 16 tiles and some pairs", await p.evaluate(()=>GAME.st.cells.length===16 && GAME.st.cells.every(t=>t&&t.v) && document.querySelectorAll('.tw-tile').length===16 && GAME.pairs(GAME.st.cells,4).length>=4));
  ok("first game shows the drag hint", await p.evaluate(()=>!!document.querySelector('.tw-hint')));

  // ---- a real drag onto a twin ----
  const tileBox = async i => { const r = await p.evaluate(i=>{ const b=GAME.board.getBoundingClientRect(), n=GAME.st.n, c=i%n, w=Math.floor(i/n); return {x:b.left+(c+.5)*b.width/n, y:b.top+(w+.5)*b.height/n}; }, i); return r; };
  const drag = async (a, c) => { const A = await tileBox(a), C = await tileBox(c); await p.mouse.move(A.x, A.y); await p.mouse.down(); await p.mouse.move((A.x+C.x)/2, (A.y+C.y)/2, {steps:4}); await p.mouse.move(C.x, C.y, {steps:4}); await p.mouse.up(); await p.waitForTimeout(250); };
  const pr = await p.evaluate(()=>{ const [x,y]=GAME.pairs(GAME.st.cells,4)[0]; return {x, y, v:GAME.st.cells[x].v, ty:GAME.st.cells[y].id}; });
  await drag(pr.x, pr.y);
  const after = await p.evaluate(t=>({made:GAME.st.cells.find(c=>c.id===t), full:GAME.st.cells.every(c=>c&&c.v), moves:GAME.st.moves, score:UL.cur.score, tiles:document.querySelectorAll('.tw-tile:not(.gone)').length}), pr.ty);
  ok("dragging a tile onto its twin merges them into double", after.made && after.made.v===pr.v*2 && after.moves===1 && after.score===pr.v*2, pr.v+"+"+pr.v+"="+(after.made&&after.made.v));
  ok("the box stays full: tiles fall and a new one drops in", after.full && after.tiles===16);
  ok("the first merge removes the hint for good", await p.evaluate(()=>!document.querySelector('.tw-hint') && UL.kv("merged",false)===true));
  const nope = await p.evaluate(()=>{ const c=GAME.st.cells, n=4; for(let i=0;i<16;i++) for(const j of [i+1,i+4]) if(j<16 && GAME.adjacent(i,j,n) && c[i].v!==c[j].v) return [i,j]; return null; });
  const m0 = await p.evaluate(()=>GAME.st.moves); await drag(nope[0], nope[1]);
  ok("dragging onto a different number does nothing", await p.evaluate(m=>GAME.st.moves===m && GAME.st.cells.every(t=>t.v), m0));
  const far = await p.evaluate(()=>{ const c=GAME.st.cells; for(let i=0;i<16;i++) for(let j=0;j<16;j++) if(i!==j && !GAME.adjacent(i,j,4) && c[i].v===c[j].v) return [i,j]; return null; });
  if(far){ await drag(far[0], far[1]); ok("a twin that is not a neighbour cannot be merged", await p.evaluate(m=>GAME.st.moves===m, m0)); }
  // tap, then tap the twin
  const tp = await p.evaluate(()=>{ const [x,y]=GAME.pairs(GAME.st.cells,4)[0]; return [x,y]; });
  for(const i of tp){ const t=await tileBox(i); await p.mouse.click(t.x, t.y); await p.waitForTimeout(80); }
  ok("tap a tile, then tap its twin, also merges", await p.evaluate(m=>GAME.st.moves===m+1, m0));

  // ---- restart replays the identical box and drops ----
  const playN = n => p.evaluate(n=>{ for(let k=0;k<n;k++){ const ps=GAME.pairs(GAME.st.cells,GAME.st.n); if(!ps.length) break; GAME.play(ps[0][0], ps[0][1]); } return JSON.stringify(GAME.st.cells.map(t=>t.v))+"|"+UL.cur.score; }, n);
  await p.evaluate(()=>{ UL.cur.sec=0; UL.restart(); }); const r1 = await playN(12);
  await p.evaluate(()=>{ UL.cur.sec=0; UL.restart(); }); const r2 = await playN(12);
  ok("restart replays the identical game", r1===r2, r1.split("|")[1]+" pts");

  // ---- undo limit ----
  const undo = await p.evaluate(()=>{ GAME.undoMove(); GAME.undoMove(); const used=GAME.st.undosUsed; GAME.undoMove();
    return {used, blocked: GAME.st.undosUsed===2 && document.getElementById('proVeil').classList.contains('show')}; });
  ok("free tier: two undos, third opens the paywall", undo.used===2 && undo.blocked);
  await p.click('#proClose'); await p.click('#resumeBtn');
  const und = await p.evaluate(()=>{ UL.start("classic",{seed:5}); const before=JSON.stringify(GAME.st.cells.map(t=>t.v)), rng=UL.rng.s; const [a,c]=GAME.pairs(GAME.st.cells,4)[0]; GAME.play(a,c); const once=JSON.stringify(GAME.st.cells.map(t=>t.v));
    GAME.undoMove(); const back=JSON.stringify(GAME.st.cells.map(t=>t.v))===before && UL.rng.s===rng; GAME.play(a,c); return {back, same:JSON.stringify(GAME.st.cells.map(t=>t.v))===once}; });
  ok("undo restores the box exactly, and the same merge drops the same new tile", und.back && und.same);

  // ---- save and restore ----
  await playN(5); await p.evaluate(()=>UL.save());
  const snap = await p.evaluate(()=>JSON.stringify(GAME.serialize())+"|"+UL.cur.score);
  await p.reload(); await p.waitForTimeout(600);
  ok("reload restores the exact box and score, paused", snap===await p.evaluate(()=>JSON.stringify(GAME.serialize())+"|"+UL.cur.score) && await p.evaluate(()=>UL.cur.paused));
  await p.click('#resumeBtn');
  await p.screenshot({path:require('path').resolve(__dirname,'../out')+'/twos-play.png'});

  // ---- play to the end ----
  const end = await p.evaluate(async()=>{ let g=0; while(!UL.cur.over && g++<4000){ const ps=GAME.pairs(GAME.st.cells,GAME.st.n); if(!ps.length) break; const [a,c]=ps[Math.floor(Math.random()*ps.length)]; GAME.play(a,c); if(g%40===0) await new Promise(r=>setTimeout(r,0)); }
    await new Promise(r=>setTimeout(r,1700));
    return {over:UL.cur.over, pairs:GAME.pairs(GAME.st.cells,GAME.st.n).length, modal:document.getElementById('endVeil').classList.contains('show'), title:document.getElementById('endTitle').textContent, detail:document.getElementById('endDetail').textContent,
            recs:UL.kv("records",[]).length, save:UL.kv("save",null), share:UL.cur.shareTxt}; });
  ok("the game ends only when no two neighbours match", end.over && end.modal && end.pairs===0, end.title+" — "+end.detail);
  ok("result recorded, save cleared", end.recs===1 && end.save===null);
  console.log("      share text: "+end.share.replace(/\n/g," / "));
  await p.click('#endClose'); await p.click('#tabTrends'); await p.waitForTimeout(200);
  ok("trends render with the player and best score", await p.evaluate(()=>!!document.querySelector('.rank-card .rating') && document.querySelectorAll('.tcard').length===4));
  await p.screenshot({path:require('path').resolve(__dirname,'../out')+'/twos-trends.png'});
  await p.click('#tabPlay').catch(()=>{});

  // ---- the merge rules over many seeded games ----
  const logic = await p.evaluate(()=>{ const bad=[]; let merges=0;
    for(let g=0; g<200; g++){ UL.rng.s=9000+g*7919; const L=GAME.levels[g%4]; const s={v:2,n:L.n,target:L.target,cells:[],nextId:1,moves:0}; GAME.deal(s); const n=s.n;
      if(GAME.pairs(s.cells,n).length < Math.min(2,n)) bad.push("deal without pairs");
      for(let k=0;k<3000;k++){ const ps=GAME.pairs(s.cells,n); if(!ps.length) break; const [x,y]=ps[UL.rnd(ps.length)]; const [a,c]=UL.rnd(2)?[x,y]:[y,x];
        const before=s.cells.map(t=>({id:t.id,v:t.v})), sum0=before.reduce((q,t)=>q+t.v,0), tid=before[c].id; const r=GAME.merge(s,a,c); merges++;
        if(!r){ bad.push("valid merge refused"); break; }
        if(s.cells.length!==n*n || s.cells.some(t=>!t||!t.v)) bad.push("box not full");
        const made=s.cells.find(t=>t.id===tid); if(!made || made.v!==before[c].v*2) bad.push("merge value wrong");
        const col=a%n, ra=Math.floor(a/n); for(let r2=1;r2<=ra;r2++){ const was=before[(r2-1)*n+col], now=s.cells[r2*n+col]; if(was.id!==now.id && !(was.id===tid)) { if(now.id!==was.id) bad.push("gravity wrong"); } }
        const sum1=s.cells.reduce((q,t)=>q+t.v,0); if(sum1!==sum0+s.cells[col].v) bad.push("values not conserved");
      } }
    return {bad:[...new Set(bad)], merges}; });
  ok("200 seeded games: merges only twins, the box stays full, tiles fall straight down, values add up", logic.bad.length===0, logic.bad.join(", ")||logic.merges+" merges");

  // ---- daily identical on a second device ----
  const d1 = await p.evaluate(()=>{ UL.start("classic",{daily:UL.dailyNum()}); for(let k=0;k<5;k++){ const ps=GAME.pairs(GAME.st.cells,4); if(ps.length) GAME.play(ps[0][0],ps[0][1]); } return JSON.stringify(GAME.st.cells.map(t=>t.v)); });
  const ctx2 = await b.newContext(); const p2 = await ctx2.newPage(); await p2.goto(F); await p2.waitForTimeout(400);
  const d2 = await p2.evaluate(()=>{ UL.start("classic",{daily:UL.dailyNum()}); for(let k=0;k<5;k++){ const ps=GAME.pairs(GAME.st.cells,4); if(ps.length) GAME.play(ps[0][0],ps[0][1]); } return JSON.stringify(GAME.st.cells.map(t=>t.v)); });
  ok("daily is identical on two devices", d1===d2);

  // ---- fits a small phone ----
  const c3 = await b.newContext({viewport:{width:360,height:640}, offline:true}); const p5 = await c3.newPage();
  await p5.addInitScript(()=>{ localStorage.setItem("ul_profile",JSON.stringify({name:"Blue Tokai",created:1})); localStorage.setItem("ul_twos_tut","true"); localStorage.setItem("ul_pro","true"); });
  await p5.goto(F); await p5.waitForTimeout(400);
  ok("nothing overflows or scrolls at 360x640 on any board", await p5.evaluate(()=>GAME.levels.every(L=>{ document.querySelectorAll('.veil.show').forEach(v=>v.classList.remove('show')); UL.start(L.id,{});
    const s=document.getElementById('stage').getBoundingClientRect(), bd=GAME.board.getBoundingClientRect(); return bd.left>=s.left-1&&bd.right<=s.right+1&&bd.bottom<=s.bottom+1&&document.documentElement.scrollHeight<=innerHeight; })));
  await c3.close();

  // family key: only its fingerprint is in the files; the real key comes from UL_FAMILY_KEY (never committed)
  const fs=require('fs'), path=require('path'), KEY=process.env.UL_FAMILY_KEY||"";
  const built=[F.slice(7), path.resolve(__dirname,'../out/hub.html')].map(f=>fs.readFileSync(f,'utf8'));
  ok("no family key written in the game or hub files", KEY!=="" && built.every(t=>!t.includes(KEY) && !/fam-[0-9a-f]{6,}/.test(t)), KEY?"":"set UL_FAMILY_KEY to run this check");
  const p4 = await ctx2.newPage(); await p4.goto(F+'?k=fam-wrong123'); await p4.waitForTimeout(300);
  ok("a wrong key does not unlock Pro", await p4.evaluate(()=>!UL.isPro()));
  const p3 = await ctx2.newPage(); await p3.goto(F+'?k='+encodeURIComponent(KEY)); await p3.waitForTimeout(400);
  ok("family key unlocks Pro and is hidden", await p3.evaluate(()=>UL.isPro() && location.search===""));
  const ctx3 = await b.newContext(); const h = await ctx3.newPage();
  await h.goto('file://'+path.resolve(__dirname,'../out/hub.html')+'?k='+encodeURIComponent(KEY)); await h.waitForTimeout(300);
  ok("hub accepts the family key and passes it to the games", await h.evaluate(()=>localStorage.getItem("ul_pro")==="true" && document.querySelector('a.game.new').getAttribute('href').includes('?k=')));
  await ctx3.close();
  ok("nothing fetched from the network", ext.length===0, ext.join(","));
  ok("no page errors", errs.length===0, errs.join(" | "));
  await b.close();
})();
