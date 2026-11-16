"use strict";
/* =====================================================================
   UNDERCURRENT LABS — AD-FREE GAMES SHELL  (shared by every game)
   Do not edit per game. A game supplies a GAME object (see GAME CONTRACT
   in the game section below) and draws inside #stage. Everything else —
   player name, themes, Pro, saving, timer, trends, rewards, sharing,
   tutorial, versioning — lives here.
   ===================================================================== */
const SHELL_VERSION = "1.0";
/* Family unlock: only a SHA-256 fingerprint of the key lives here, never the key itself. */
const FAMILY_HASH = "fc0b91ea84d8294bbaacbaf19726c66b726bd75bb28d8acf3cd7e9646d3e2efc";
function ulHash(s){const K=[],H=[1779033703,-1150833019,1013904242,-1521486534,1359893119,-1694144372,528734635,1541459225];
for(let n=2,c=0;c<64;n++){let p=1;for(let d=2;d*d<=n;d++)if(n%d===0){p=0;break}if(p)K[c++]=(Math.pow(n,1/3)%1)*4294967296|0}
const b=unescape(encodeURIComponent(s)),l=b.length,w=[];for(let i=0;i<l;i++)w[i>>2]|=b.charCodeAt(i)<<(24-(i%4)*8);
w[l>>2]|=0x80<<(24-(l%4)*8);w[((l+8>>6)+1)*16-1]=l*8;
for(let j=0;j<w.length;j+=16){const W=[],a=H.slice();for(let i=0;i<64;i++){if(i<16)W[i]=w[j+i]|0;else{const x=W[i-15],y=W[i-2];
W[i]=(((x>>>7|x<<25)^(x>>>18|x<<14)^x>>>3)+W[i-7]+((y>>>17|y<<15)^(y>>>19|y<<13)^y>>>10)+W[i-16])|0}
const e=a[4],t1=a[7]+((e>>>6|e<<26)^(e>>>11|e<<21)^(e>>>25|e<<7))+((e&a[5])^(~e&a[6]))+K[i]+W[i],o=a[0],
t2=((o>>>2|o<<30)^(o>>>13|o<<19)^(o>>>22|o<<10))+((o&a[1])^(o&a[2])^(a[1]&a[2]));a.pop();a.unshift((t1+t2)|0);a[4]=(a[4]+t1)|0}
for(let i=0;i<8;i++)H[i]=(H[i]+a[i])|0}return H.map(h=>(h>>>0).toString(16).padStart(8,"0")).join("")}
const $ = id => document.getElementById(id);

const store = (() => {
  let mem = {}, ok = false;
  try { localStorage.setItem("__t","1"); localStorage.removeItem("__t"); ok = true; } catch(e){ ok = false; }
  return {
    get(k, fb){ try { if(ok){ const v = localStorage.getItem(k); return v==null ? fb : JSON.parse(v); } } catch(e){} return (k in mem) ? mem[k] : fb; },
    set(k, v){ try { if(ok){ localStorage.setItem(k, JSON.stringify(v)); return; } } catch(e){} mem[k] = v; }
  };
})();

const UL = {};
UL.store = store;
UL.kv    = (k, fb) => store.get("ul_"+GAME.id+"_"+k, fb);      // storage scoped to this game
UL.setKv = (k, v)  => store.set("ul_"+GAME.id+"_"+k, v);

/* ---------- seeded randomness: every game is replayable from its seed ---------- */
function mulberry(seed){
  return { s: seed|0, next(){ this.s = (this.s + 0x6D2B79F5)|0; let t = Math.imul(this.s ^ this.s>>>15, 1|this.s);
    t = t + Math.imul(t ^ t>>>7, 61|t) ^ t; return ((t ^ t>>>14)>>>0) / 4294967296; } };
}
UL.rng = mulberry(1);
UL.random  = () => UL.rng.next();
UL.rnd     = n => Math.floor(UL.rng.next()*n);
UL.pick    = a => a[UL.rnd(a.length)];
UL.shuffle = a => { a = a.slice(); for(let i=a.length-1;i>0;i--){ const j=UL.rnd(i+1); [a[i],a[j]]=[a[j],a[i]]; } return a; };
function strHash(s){ let h=2166136261; for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; }
UL.dailyNum = () => { const d=new Date(); return Math.floor((Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())-Date.UTC(2026,0,1))/86400000)+1; };
const dailySeed = n => ((strHash(GAME.id)%100000)*7919 + n*2654435761) % 2147483647 | 0;

/* ---------- small utilities ---------- */
UL.fmtTime = sec => String(Math.floor(sec/60)).padStart(2,"0")+":"+String(sec%60).padStart(2,"0");
const BZ = { tap:10, act:15, err:180, wow:[16,38,24], win:[40,60,40,60,180] };
UL.buzz = p => { const v = (typeof p==="string") ? BZ[p] : p; if(navigator.vibrate){ try{ navigator.vibrate(v); }catch(e){} } };
let toastTimer = null;
UL.toast = (msg, ms) => { const t=$("toast"); t.textContent=msg; t.classList.add("show"); clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.classList.remove("show"), ms||2600); };
const animOnce = (el, cls) => { if(!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
  el.addEventListener("animationend", ()=>el.classList.remove(cls), {once:true}); };
UL.pop   = el => animOnce(el, "ul-pop");
UL.shake = el => animOnce(el, "ul-shake");
UL.sweep = (els, stepMs) => { [...els].forEach((el,i)=>{ if(!el) return; el.style.animationDelay=(i*(stepMs==null?32:stepMs))+"ms"; animOnce(el,"ul-sweep");
  el.addEventListener("animationend", ()=>{ el.style.animationDelay=""; }, {once:true}); }); };
UL.isNative = () => !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());

/* ---------- reward beats ---------- */
const PRAISE = {
  1:{odds:0.30, icon:"",   words:["Nice","Clean","Tidy","Neat","Smooth","Crisp","Steady"]},
  2:{odds:0.60, icon:"✦",  words:["Sharp","Slick","Good eye","Well spotted","Eagle-eyed","Nicely seen","Keen"]},
  3:{odds:1,    icon:"💎", words:["Clever","Intelligent","Shrewd","Astute","Incisive","Canny","Crafty"]},
  4:{odds:1,    icon:"🔥", big:1, words:["Genius!","Brilliant!","Masterful!","Outstanding!","Remarkable!","Virtuoso!","Inspired!"]}
};
let lastWord = "", lastBadgeAt = 0;
/* target: an element inside the stage, or {x,y} in px relative to the stage wrap */
UL.badge = (target, text, big, hold) => {
  const wrap = $("stageWrap"); if(!wrap) return;
  wrap.querySelectorAll(".praise").forEach(e=>e.remove());            // one at a time, newest wins
  const el = document.createElement("div");
  el.className = "praise"+(big?" big":""); el.textContent = text;
  const wr = wrap.getBoundingClientRect();
  let x = wr.width/2, y = wr.height*0.3;
  try{
    if(target && target.getBoundingClientRect){ const r=target.getBoundingClientRect(); x=r.left-wr.left+r.width/2; y=r.top-wr.top; }
    else if(target && typeof target.x==="number"){ x=target.x; y=target.y; }
  }catch(e){}
  el.style.left = x+"px"; el.style.top = y+"px";
  wrap.appendChild(el);
  try{
    const br = el.getBoundingClientRect(), pad = 6; let shift = 0;
    if(br.left < wr.left+pad)   shift = (wr.left+pad) - br.left;
    if(br.right > wr.right-pad) shift = (wr.right-pad) - br.right;
    if(shift) el.style.left = (x+shift)+"px";
    if(y < br.height+pad) el.style.top = (br.height+pad)+"px";
  }catch(e){}
  lastBadgeAt = Date.now();
  setTimeout(()=>el.remove(), hold || (big?1250:1000));
};
/* tier 1 = routine good move … tier 4 = measurably hard. Tiers 1-2 are throttled, 3-4 always show. */
UL.praise = (target, tier) => {
  const P = PRAISE[tier]; if(!P) return false;
  const now = Date.now();
  if(P.odds < 1){ if(Math.random() > P.odds) return false; if(now-lastBadgeAt < 1600) return false; }
  let w = P.words[Math.floor(Math.random()*P.words.length)], g = 0;
  while(w===lastWord && g++<6) w = P.words[Math.floor(Math.random()*P.words.length)];
  lastWord = w;
  if(P.big) UL.buzz("wow");
  UL.badge(target, (P.icon?P.icon+" ":"")+w, P.big);
  return true;
};
/* a rare, named moment: "✨ Row and box complete", "✨ 512!" */
UL.milestone = (target, text) => { UL.buzz("wow"); UL.badge(target, "✨ "+text, true, 1300); };
UL.confetti = () => {
  const wrap = $("stageWrap"), cv = document.createElement("canvas");
  cv.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:40";
  cv.width = wrap.clientWidth||360; cv.height = wrap.clientHeight||360; wrap.appendChild(cv);
  const ctx = cv.getContext && cv.getContext("2d"); if(!ctx){ cv.remove(); return; }
  const css = getComputedStyle(document.documentElement);
  const cols = [css.getPropertyValue("--gold"), css.getPropertyValue("--err"), "#4A6B4F", "#0B5CAD", "#7C4DFF"].map(s=>s.trim()||"#B08D3E");
  const P = []; for(let i=0;i<90;i++) P.push({x:Math.random()*cv.width, y:-10-Math.random()*90, vy:2+Math.random()*3, vx:-1+Math.random()*2, s:3+Math.random()*4, c:cols[i%cols.length], r:Math.random()*6.3});
  let t = 0; const id = setInterval(()=>{ t++; ctx.clearRect(0,0,cv.width,cv.height);
    for(const p of P){ p.x+=p.vx; p.y+=p.vy; p.r+=.1; ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.r); ctx.fillStyle=p.c; ctx.fillRect(-p.s/2,-p.s/2,p.s,p.s*1.6); ctx.restore(); }
    if(t>110){ clearInterval(id); cv.remove(); } }, 16);
};

/* ---------- Pro ---------- */
let PRO = store.get("ul_pro", false) || store.get("sdk_pro", false);
(function familyUnlock(){ try{ const k = new URLSearchParams(location.search).get("k");
  if(k && ulHash(k)===FAMILY_HASH){ PRO = true; store.set("ul_pro", true); history.replaceState(null, "", location.pathname); } }catch(e){} })();
UL.isPro = () => !!PRO;
function applyPro(){
  document.body.classList.toggle("pro", UL.isPro());
  $("proChip").style.display = UL.isPro() ? "" : "none";
  $("webNote").style.display = (!UL.isNative() && !UL.isPro()) ? "" : "none";
}
function grantPro(){ PRO = true; store.set("ul_pro", true); applyPro(); $("proVeil").classList.remove("show");
  UL.toast("Pro unlocked. Thank you — enjoy the full game."); if(GAME.onPro) GAME.onPro(); }
UL.paywall = reason => {
  $("proTitle").textContent = GAME.name+" Pro";
  $("proWhy").textContent = reason || "No ads in either version — Pro opens the rest of the game. One payment, no subscription.";
  $("proPerks").innerHTML = (GAME.proPerks||[]).map((p,i)=>"<div><span>✓</span>"+(i===0?"<b>"+p+"</b>":p)+"</div>").join("");
  $("proPrice").innerHTML = (GAME.price||"₹99")+"<small>one-time · includes every future update</small>";
  pauseGame(); $("proVeil").classList.add("show");
};
/* use at the top of any Pro-only action:  if(!UL.requirePro("Unlimited undo is part of Pro.")) return; */
UL.requirePro = reason => { if(UL.isPro()) return true; UL.paywall(reason); return false; };
const Billing = {
  async purchase(sku){
    if(window.PlayBilling && window.PlayBilling.purchase) return await window.PlayBilling.purchase(sku);
    if(UL.isNative()){ UL.toast("Pro isn't on sale yet — coming in the next update."); return false; }
    const localDev = ["localhost","127.0.0.1","::1"].includes(location.hostname) || location.protocol==="file:";
    if(localDev) return confirm("[Local build] Simulate a successful purchase for testing?");
    UL.toast("Pro is available in the Android app on Google Play."); return false;
  },
  async restore(){
    if(window.PlayBilling && window.PlayBilling.restore) return await window.PlayBilling.restore();
    UL.toast(UL.isNative() ? "Pro isn't on sale yet — coming in the next update." : "Purchases are restored in the Android app on Google Play."); return false;
  }
};
$("proClose").addEventListener("click", ()=>$("proVeil").classList.remove("show"));
$("proBuy").addEventListener("click", async ()=>{ try{ if(await Billing.purchase(GAME.sku||"ul_pro_unlock")) grantPro(); }catch(e){ UL.toast("Purchase could not be completed."); } });
$("proRestore").addEventListener("click", async ()=>{ try{ if(await Billing.restore()) grantPro(); }catch(e){ UL.toast("Could not reach Google Play."); } });
$("proChip").addEventListener("click", ()=>UL.toast("Pro is active on this device. Thank you."));

/* ---------- themes (shared across games) ---------- */
const THEMES = [
  {id:"clear",   name:"Clear",        desc:"Big contrast, easy reading", sw:["#FFFFFF","#0B5CAD","#000000"]},
  {id:"classic", name:"Classic Gold", desc:"Warm and calm", sw:["#FCFAF6","#B08D3E","#22201A"]},
  {id:"night",   name:"Night",        desc:"Easy on the eyes after dark", sw:["#171612","#D2A94E","#F2EFE7"]},
  {id:"candy",   name:"Candy",        desc:"Bright and fun for kids", sw:["#FFF6E5","#F26B3A","#3D2B56"]},
  {id:"forest",  name:"Forest", pro:1, desc:"Deep green, low glare", sw:["#F2F6EF","#3F6B45","#1E2A20"]},
  {id:"ocean",   name:"Ocean",  pro:1, desc:"Cool blues, calm focus", sw:["#F1F6FA","#1C6E8C","#12242E"]},
  {id:"rose",    name:"Rose",   pro:1, desc:"Soft and warm", sw:["#FDF3F3","#A8455C","#2B1A1E"]},
];
function applyTheme(id){
  const t = THEMES.find(x=>x.id===id); if(!t || (t.pro && !UL.isPro())) id = "clear";
  document.documentElement.setAttribute("data-theme", id); store.set("ul_theme", id);
  document.querySelectorAll(".theme-row").forEach(r=>r.classList.toggle("picked", r.dataset.t===id));
  if(GAME.onTheme) GAME.onTheme(id);
  if($("viewTrends").classList.contains("show")) renderTrends();
}
function buildThemeList(){
  const list = $("themeList"); list.innerHTML = "";
  for(const t of THEMES){
    const locked = t.pro && !UL.isPro(), b = document.createElement("button");
    b.className = "lvl theme-row"+(locked?" locked":""); b.dataset.t = t.id;
    b.innerHTML = '<span class="tname"><b>'+t.name+(t.pro?'<span class="probadge">PRO</span>':'')+'</b><small>'+t.desc+'</small></span><span>'+
      (locked ? "🔒" : t.sw.map(c=>'<span class="sw" style="background:'+c+'"></span>').join(""))+'</span>';
    b.addEventListener("click", ()=>{ if(locked){ $("themeVeil").classList.remove("show"); UL.paywall("Forest, Ocean and Rose are Pro themes."); return; } applyTheme(t.id); });
    list.appendChild(b);
  }
}
$("themeBtn").addEventListener("click", ()=>{ buildThemeList(); applyTheme(document.documentElement.getAttribute("data-theme")||"clear"); $("themeVeil").classList.add("show"); });
$("themeDone").addEventListener("click", ()=>$("themeVeil").classList.remove("show"));

/* ---------- player name (shared across games) ---------- */
let profile = store.get("ul_profile", null) || store.get("sdk_profile", null);
UL.playerName = () => profile ? profile.name : "Player";
const ADJ = ["Blue","Crimson","Indigo","Golden","Silver","Emerald","Cobalt","Amber","Ivory","Onyx","Scarlet","Teal","Violet","Copper","Jade","Slate","Coral","Saffron","Pearl","Midnight"];
const NOUN = ["Tokai","Falcon","Panther","Lotus","Comet","Harbour","Summit","Willow","Orchid","Raven","Tiger","Heron","Cedar","Nimbus","Ember","Delta","Quartz","Mango","Monsoon","Peak"];
let chosenChip = "";
function fillChips(){
  chosenChip = ""; const wrap = $("nameChips"); wrap.innerHTML = ""; const seen = new Set();
  while(seen.size < 4) seen.add(ADJ[Math.floor(Math.random()*ADJ.length)]+" "+NOUN[Math.floor(Math.random()*NOUN.length)]);
  for(const nm of seen){ const b = document.createElement("button"); b.className = "chip"; b.textContent = nm;
    b.addEventListener("click", ()=>{ chosenChip = nm; $("nameInput").value = ""; wrap.querySelectorAll(".chip").forEach(c=>c.classList.toggle("picked", c===b)); });
    wrap.appendChild(b); }
}
$("reroll").addEventListener("click", fillChips);
$("nameInput").addEventListener("input", ()=>{ chosenChip = ""; $("nameChips").querySelectorAll(".chip").forEach(c=>c.classList.remove("picked")); });
$("nameSave").addEventListener("click", ()=>{
  const name = ($("nameInput").value.trim() || chosenChip).replace(/\s+/g," ").slice(0,20); if(name.length < 3) return;
  profile = {name, created:Date.now()}; store.set("ul_profile", profile); $("nameVeil").classList.remove("show"); afterName();
});

/* ---------- tutorial ---------- */
const COMMON_TUT = [
  {icon:"↻", title:"Start over", body:"Pause, or tap New game, and choose Restart to replay the very same game from the beginning."},
  {icon:"⏸️", title:"Leave anytime", body:"Your game saves itself. Close the app and come back whenever — it will be waiting exactly where you left it."}
];
let tutIdx = 0, tutAfter = null, tutSteps = [];
function showTutorial(after){ tutSteps = (GAME.tutorial||[]).concat(COMMON_TUT); tutIdx = 0; tutAfter = after||null; renderTut(); $("tutVeil").classList.add("show"); }
function renderTut(){ const s = tutSteps[tutIdx]; $("tutStep").textContent = (tutIdx+1)+" / "+tutSteps.length; $("tutIcon").textContent = s.icon;
  $("tutTitle").textContent = s.title; $("tutBody").textContent = s.body; $("tutNext").textContent = tutIdx===tutSteps.length-1 ? "Let's play" : "Next"; }
function endTut(){ $("tutVeil").classList.remove("show"); UL.setKv("tut", true); if(tutAfter){ const f = tutAfter; tutAfter = null; f(); } }
$("tutNext").addEventListener("click", ()=>{ tutIdx++; if(tutIdx >= tutSteps.length) endTut(); else renderTut(); });
$("tutSkip").addEventListener("click", endTut);
$("helpBtn").addEventListener("click", ()=>{ pauseGame(); showTutorial(null); });

/* ---------- the running game ---------- */
UL.cur = null;                    // {level, daily, seed, sec, score, over, paused}
let wakeLock = null;
async function keepAwake(){ try{ if(navigator.wakeLock && !wakeLock){ wakeLock = await navigator.wakeLock.request("screen"); wakeLock.addEventListener("release", ()=>{ wakeLock = null; }); } }catch(e){ wakeLock = null; } }
function releaseWake(){ try{ if(wakeLock){ wakeLock.release(); wakeLock = null; } }catch(e){} }
const levelOf = id => GAME.levels.find(l=>l.id===id) || GAME.levels[0];
UL.setScore = n => { if(UL.cur) UL.cur.score = n; $("ulStatB").innerHTML = "Score <b>"+n+"</b>"; };
UL.addScore = n => UL.setScore((UL.cur?UL.cur.score:0)+n);
UL.setStat  = html => { $("ulStatA").innerHTML = html||""; };             // the game's own status slot
function tickLabel(){ $("ulTimer").textContent = UL.fmtTime(UL.cur ? UL.cur.sec : 0); }

const ICONS = {
  undo:'<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
  erase:'<path d="M20 20H8L3 15a2 2 0 0 1 0-3l8-8a2 2 0 0 1 3 0l6 6a2 2 0 0 1 0 3l-6 7"/>',
  pencil:'<path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
  bolt:'<path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z"/>',
  hint:'<path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 1 4.9 12 5 5 0 0 0-1.4 2.5V18h-7v-1.5A5 5 0 0 0 7.1 14 7 7 0 0 1 12 2z"/>',
  fresh:'<path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/>',
  flag:'<path d="M5 22V4"/><path d="M5 4h12l-2 4 2 4H5"/>',
  shuffle:'<path d="M16 3h5v5"/><path d="M4 20L21 3"/><path d="M21 16v5h-5"/><path d="M15 15l6 6"/><path d="M4 4l5 5"/>'
};
/* add a button to the control row. Returns the element; el.setLabel("Undo 2") updates its caption. */
UL.ctrl = ({icon, label, onTap}) => {
  const b = document.createElement("button"); b.className = "ctrl";
  b.innerHTML = '<svg viewBox="0 0 24 24">'+(ICONS[icon]||ICONS.fresh)+'</svg><small></small>';
  b.setLabel = t => { b.querySelector("small").textContent = t; }; b.setLabel(label);
  b.addEventListener("pointerdown", e=>{ e.preventDefault(); UL.buzz("tap"); if(UL.cur && UL.cur.paused) return; onTap(b); });
  $("controls").appendChild(b); return b;
};

UL.start = (levelId, opts) => {
  opts = opts||{};
  const lvl = levelOf(levelId), sv = opts.restore||null;
  const seed = sv ? sv.seed : (opts.seed!=null ? opts.seed : (opts.daily ? dailySeed(opts.daily) : (Math.random()*2147483647)|0));
  UL.cur = {level:lvl.id, daily:opts.daily||null, seed, sec:0, score:0, over:false, paused:false};
  UL.rng = mulberry(seed); lastBadgeAt = 0;
  $("stage").innerHTML = ""; $("controls").innerHTML = ""; $("below").innerHTML = "";
  $("stageWrap").querySelectorAll(".praise,canvas").forEach(e=>e.remove());
  $("ulLevel").innerHTML = "<b>"+(UL.cur.daily ? "Daily #"+UL.cur.daily : lvl.name)+"</b>";
  $("ulTimer").style.visibility = (GAME.timer===false || lvl.timer===false) ? "hidden" : "";
  UL.setScore(0); UL.setStat("");
  $("pauseVeil").classList.remove("show"); $("endVeil").classList.remove("show");
  GAME.start({level:lvl, daily:UL.cur.daily, restore: sv ? sv.state : null});
  UL.ctrl({icon:"fresh", label:"New game", onTap:()=>showLevelPicker()});
  if(sv){ UL.cur.sec = sv.sec||0; UL.setScore(sv.score||0); UL.rng.s = sv.rng|0; UL.cur.paused = true; $("pauseVeil").classList.add("show"); }
  else { keepAwake(); UL.save(); }
  tickLabel();
};
UL.save = () => {
  if(!UL.cur || UL.cur.over){ UL.setKv("save", null); return; }
  let state = null; try{ state = GAME.serialize(); }catch(e){ return; }
  UL.setKv("save", {level:UL.cur.level, daily:UL.cur.daily, seed:UL.cur.seed, sec:UL.cur.sec, score:UL.cur.score, rng:UL.rng.s, state});
};
UL.restart = () => {
  if(!UL.cur) return;
  if(!UL.cur.over && UL.cur.sec > 20 && !confirm("Restart this game?\n\nThe same game starts over — your progress, score and timer all reset.")) return;
  $("lvlVeil").classList.remove("show");
  UL.start(UL.cur.level, {daily:UL.cur.daily, seed:UL.cur.seed});
  UL.toast("Same game, fresh start.");
};
setInterval(()=>{ const c = UL.cur; if(c && !c.paused && !c.over){ c.sec++; tickLabel(); if(c.sec%5===0) UL.save(); } }, 1000);

function pauseGame(){ const c = UL.cur; if(!c || c.over || c.paused) return; c.paused = true; $("pauseVeil").classList.add("show"); releaseWake(); UL.save(); if(GAME.onPause) GAME.onPause(); }
function resumeGame(){ const c = UL.cur; if(!c || !c.paused) return; c.paused = false; $("pauseVeil").classList.remove("show"); keepAwake(); if(GAME.onResume) GAME.onResume(); }
UL.paused = () => !UL.cur || UL.cur.paused || UL.cur.over;       // games check this before accepting input
$("pauseBtn").addEventListener("click", pauseGame);
$("resumeBtn").addEventListener("click", resumeGame);
$("pauseRestart").addEventListener("click", ()=>UL.restart());
document.addEventListener("visibilitychange", ()=>{ if(document.hidden) pauseGame(); });
window.addEventListener("pagehide", ()=>UL.save());

/* the game calls this exactly once when a game finishes.
   won: did the player reach the goal · title: heading · line: one factual sentence for the end card and the share text */
UL.end = ({won, title, line}) => {
  const c = UL.cur; if(!c || c.over) return;
  c.over = true; UL.setKv("save", null); releaseWake();
  const recs = UL.kv("records", []);
  recs.push({t:Date.now(), lvl:c.level, sec:c.sec, sc:c.score, w:won?1:0, dl:c.daily||0});
  if(recs.length > 500) recs.splice(0, recs.length-500);
  UL.setKv("records", recs);
  const best = Math.max(...recs.filter(r=>r.lvl===c.level).map(r=>r.sc));
  const isBest = c.score > 0 && c.score >= best && recs.filter(r=>r.lvl===c.level).length > 1;
  const head = c.daily ? "⭐ "+GAME.name+" Daily #"+c.daily : (GAME.icon||"🎮")+" "+GAME.name+" · "+levelOf(c.level).name;
  c.shareTxt = head+" — "+UL.playerName()+"\n"+(line?line+" · ":"")+"Score "+c.score+(GAME.timer===false?"":" · "+UL.fmtTime(c.sec))+"\n"+(won?"Beat that 😎":"Can you do better?");
  $("endTitle").textContent = title || (won ? "Solved" : "Game over");
  $("endScore").textContent = c.score;
  $("endDetail").innerHTML = (line||"")+(isBest ? "<br><b>New personal best.</b>" : "");
  if(won){ UL.buzz("win"); UL.confetti(); setTimeout(()=>$("endVeil").classList.add("show"), 1200); }
  else $("endVeil").classList.add("show");
};
$("waShare").addEventListener("click", ()=>{ if(UL.cur) window.open("https://wa.me/?text="+encodeURIComponent(UL.cur.shareTxt||""), "_blank"); });
$("endNew").addEventListener("click", ()=>{ $("endVeil").classList.remove("show"); showLevelPicker(); });
$("endClose").addEventListener("click", ()=>$("endVeil").classList.remove("show"));

/* ---------- level picker ---------- */
function showLevelPicker(){
  const list = $("lvlList"); list.innerHTML = "";
  $("lvlBlurb").textContent = GAME.blurb || "Pick a level.";
  const row = (html, onClick, cls) => { const b = document.createElement("button"); b.className = "lvl"+(cls?" "+cls:""); b.innerHTML = html; b.addEventListener("click", onClick); list.appendChild(b); return b; };
  if(UL.cur && !UL.cur.over) row("<b>↻ Restart this game</b><small>same game, fresh start</small>", ()=>UL.restart());
  if(GAME.daily){
    const n = UL.dailyNum(), done = UL.kv("records", []).some(r=>r.dl===n && r.w);
    const b = row("<b>⭐ Daily #"+n+"</b><small>"+(done?"✓ done — play again anytime":"same game for everyone today")+"</small>",
      ()=>{ $("lvlVeil").classList.remove("show"); switchTab(true); UL.start(GAME.daily, {daily:n}); });
    b.style.borderWidth = "2px";
  }
  for(const l of GAME.levels){
    const locked = l.pro && !UL.isPro();
    row("<b>"+l.name+"</b><small>"+(locked?"🔒 Pro":(l.note||""))+"</small>", ()=>{
      $("lvlVeil").classList.remove("show");
      if(locked){ UL.paywall(l.name+" is part of Pro."); return; }
      switchTab(true); UL.start(l.id);
    }, locked?"locked":"");
  }
  $("lvlCancel").style.display = UL.cur ? "" : "none";
  pauseGame(); $("lvlVeil").classList.add("show");
}
UL.newGame = showLevelPicker;
$("lvlCancel").addEventListener("click", ()=>{ $("lvlVeil").classList.remove("show"); });

/* ---------- trends ---------- */
function switchTab(play){
  $("tabPlay").classList.toggle("active", play); $("tabTrends").classList.toggle("active", !play);
  $("viewPlay").classList.toggle("show", play); $("viewTrends").classList.toggle("show", !play);
  if(!play){ pauseGame(); renderTrends(); }
}
$("tabPlay").addEventListener("click", ()=>switchTab(true));
$("tabTrends").addEventListener("click", ()=>switchTab(false));
function renderTrends(){
  const recs = UL.kv("records", []), body = $("trendsBody");
  const best = recs.length ? Math.max(...recs.map(r=>r.sc)) : 0, wins = recs.filter(r=>r.w).length;
  let streak = 0; for(let i=recs.length-1;i>=0;i--){ if(recs[i].w) streak++; else break; }
  const rank = '<div class="rank-card"><div class="pname">'+UL.playerName()+'</div><div class="rating">'+(best||"—")+'</div>'+
    '<div class="sub">best score in '+GAME.name+'</div><button class="btn" id="shareRank">Share my stats</button></div>';
  if(!recs.length){ body.innerHTML = rank+'<div class="empty-note">No games finished yet.<br>Your scores and streaks will build up here.</div>'; wireRank(recs, best); return; }
  const avg = Math.round(recs.reduce((a,r)=>a+r.sc,0)/recs.length);
  let rows = "";
  for(const l of GAME.levels){ const g = recs.filter(r=>r.lvl===l.id); if(!g.length) continue; const gw = g.filter(r=>r.w);
    rows += "<tr><td>"+l.name+"</td><td>"+g.length+"</td><td>"+Math.max(...g.map(r=>r.sc))+"</td><td>"+(gw.length&&GAME.timer!==false?UL.fmtTime(Math.min(...gw.map(r=>r.sec))):"—")+"</td><td>"+Math.round(100*gw.length/g.length)+"%</td></tr>"; }
  body.innerHTML = rank+
    '<div class="trend-grid"><div class="tcard"><small>Games played</small><b>'+recs.length+'</b> <span>'+Math.round(100*wins/recs.length)+'% won</span></div>'+
    '<div class="tcard"><small>Average score</small><b>'+avg+'</b></div>'+
    '<div class="tcard"><small>Win streak</small><b>'+streak+'</b></div>'+
    '<div class="tcard"><small>Dailies done</small><b>'+new Set(recs.filter(r=>r.dl&&r.w).map(r=>r.dl)).size+'</b></div></div>'+
    (UL.isPro()
      ? '<div class="chart-card"><h3>Score trend — last 20 games</h3><canvas id="chScore" width="640" height="220"></canvas></div>'+
        '<div class="chart-card"><h3>By level</h3><table class="diff-table"><tr><th>Level</th><th>Games</th><th>Best</th><th>Fastest</th><th>Won</th></tr>'+rows+'</table></div>'
      : '<div class="chart-card"><h3>Trends &amp; charts</h3><div class="note">The score chart and per-level breakdown are part of Pro.</div><button class="btn" id="trendPro" style="width:100%">See Pro</button></div>');
  wireRank(recs, best);
  const tp = $("trendPro"); if(tp) tp.onclick = ()=>UL.paywall("Full trends and charts are part of Pro.");
  if(UL.isPro()) drawLine($("chScore"), recs.slice(-20).map(r=>r.sc), recs.slice(-20).map(r=>r.w));
}
function wireRank(recs, best){ const b = $("shareRank"); if(!b) return; b.onclick = ()=>{
  const txt = (GAME.icon||"🎮")+" "+GAME.name+" — "+UL.playerName()+"\nBest score "+best+" · "+recs.filter(r=>r.w).length+"/"+recs.length+" won";
  window.open("https://wa.me/?text="+encodeURIComponent(txt), "_blank"); }; }
function drawLine(cv, data, flags){
  const ctx = cv && cv.getContext && cv.getContext("2d"); if(!ctx || !data.length) return;
  const css = getComputedStyle(document.documentElement), g = k => css.getPropertyValue(k).trim();
  const W = cv.width, H = cv.height, P = 30, min = Math.min(...data), max = Math.max(...data), span = (max-min)||1;
  const x = i => P+(W-2*P)*(data.length===1?0.5:i/(data.length-1)), y = v => H-P-(H-2*P)*((v-min)/span);
  ctx.clearRect(0,0,W,H); ctx.strokeStyle = g("--line"); ctx.lineWidth = 1;
  for(let k=0;k<4;k++){ const gy = P+(H-2*P)*k/3; ctx.beginPath(); ctx.moveTo(P,gy); ctx.lineTo(W-P,gy); ctx.stroke(); }
  ctx.strokeStyle = g("--gold"); ctx.lineWidth = 2.5; ctx.beginPath(); data.forEach((v,i)=>{ i?ctx.lineTo(x(i),y(v)):ctx.moveTo(x(i),y(v)); }); ctx.stroke();
  data.forEach((v,i)=>{ ctx.beginPath(); ctx.arc(x(i),y(v),4,0,7); ctx.fillStyle = flags[i]?g("--gold"):g("--err"); ctx.fill(); });
  ctx.font = "11px JetBrains Mono, monospace"; ctx.fillStyle = g("--muted"); ctx.fillText(max, 4, y(max)+4); ctx.fillText(min, 4, y(min)+4);
}

/* ---------- version card ---------- */
$("verChip").addEventListener("click", ()=>{
  $("verTitle").textContent = GAME.name+" v"+GAME.version+(UL.isPro()?" Pro":"");
  $("verNotes").innerHTML = (GAME.changelog||[]).map(c=>"<b>v"+c[0]+"</b>"+c[1]).join("");
  $("verGoPro").style.display = UL.isPro() ? "none" : ""; pauseGame(); $("verVeil").classList.add("show");
});
$("verClose").addEventListener("click", ()=>$("verVeil").classList.remove("show"));
$("verGoPro").addEventListener("click", ()=>{ $("verVeil").classList.remove("show"); UL.paywall(); });
$("verReset").addEventListener("click", ()=>{
  if(!confirm("Clear all scores, trends and the saved game for "+GAME.name+"? Your player name and theme stay.")) return;
  UL.setKv("records", []); UL.setKv("save", null); if(GAME.onReset) GAME.onReset();
  $("verVeil").classList.remove("show"); UL.toast("Scores cleared. Fresh start.");
  if($("viewTrends").classList.contains("show")) renderTrends();
});

/* ---------- boot ---------- */
function afterName(){ if(!UL.kv("tut", false)) showTutorial(()=>showLevelPicker()); else showLevelPicker(); }
UL.boot = () => {
  document.title = GAME.name+" — Undercurrent Labs";
  const t = GAME.title || [GAME.name, ""]; $("ulTitle").innerHTML = t[0]+"<span>"+(t[1]||"")+"</span>";
  $("verChip").textContent = "v"+GAME.version;
  $("footNote").textContent = "v"+GAME.version+" · No ads, ever. No tracking. Your stats stay on this device.";
  applyPro(); applyTheme(store.get("ul_theme", null) || store.get("sdk_theme2", "clear"));
  const seen = UL.kv("seen", null); if(seen !== GAME.version){ UL.setKv("seen", GAME.version); if(seen) setTimeout(()=>UL.toast("Updated to v"+GAME.version+"."), 600); }
  if(GAME.mount) GAME.mount($("stage"));
  const sv = UL.kv("save", null);
  if(!profile){ fillChips(); $("nameVeil").classList.add("show"); }
  else if(sv && sv.state){ try{ UL.start(sv.level, {daily:sv.daily, restore:sv}); }catch(e){ UL.setKv("save", null); afterName(); } }
  else afterName();
};
