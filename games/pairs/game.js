/* ===================== AD FREE PAIRS ===================== */
/* 24 faces: eight shapes, each shown once, twice or three times. Drawn as inline SVG in theme colours. */
const PR_SHAPES = [
  r=>'<circle cx="0" cy="0" r="'+r+'"/>',
  r=>'<rect x="'+(-r*.85)+'" y="'+(-r*.85)+'" width="'+(r*1.7)+'" height="'+(r*1.7)+'" rx="'+(r*.15)+'"/>',
  r=>'<path d="M0 '+(-r)+' L'+(r*.95)+' '+(r*.75)+' L'+(-r*.95)+' '+(r*.75)+'Z"/>',
  r=>'<path d="M0 '+(-r)+' L'+r+' 0 L0 '+r+' L'+(-r)+' 0Z"/>',
  r=>{ let d=""; for(let i=0;i<10;i++){ const a=-Math.PI/2+i*Math.PI/5, q=i%2?r*.45:r; d+=(i?"L":"M")+(q*Math.cos(a)).toFixed(2)+" "+(q*Math.sin(a)).toFixed(2); } return '<path d="'+d+'Z"/>'; },
  r=>{ let d=""; for(let i=0;i<6;i++){ const a=i*Math.PI/3; d+=(i?"L":"M")+(r*Math.cos(a)).toFixed(2)+" "+(r*Math.sin(a)).toFixed(2); } return '<path d="'+d+'Z"/>'; },
  r=>{ const t=r*.36; return '<path d="M'+(-t)+' '+(-r)+'H'+t+'V'+(-t)+'H'+r+'V'+t+'H'+t+'V'+r+'H'+(-t)+'V'+t+'H'+(-r)+'V'+(-t)+'H'+(-t)+'Z"/>'; },
  r=>'<circle cx="0" cy="0" r="'+(r*.74)+'" fill="none" stroke-width="'+(r*.42)+'"/>'
];
const PR_NAMES = ["circle","square","triangle","diamond","star","hexagon","cross","ring"];
function prFace(id){                 // id 0..23: shape = id % 8, count = 1..3
  const sh = id % 8, n = Math.floor(id/8) + 1, pos = n===1 ? [[0,0]] : n===2 ? [[-13,0],[13,0]] : [[0,-12],[-12,10],[12,10]], r = n===1 ? 20 : n===2 ? 11 : 9.5;
  return '<svg viewBox="-30 -30 60 60" aria-hidden="true">'+pos.map(([x,y])=>'<g transform="translate('+x+' '+y+')">'+PR_SHAPES[sh](r)+'</g>').join("")+'</svg>';
}

const GAME = {
  id: "pairs",
  name: "Ad Free Pairs",
  title: ["PA","IRS"],
  icon: "🧠",
  version: "1.0",
  changelog: [["1.0","First release: Small, Medium, Large, Huge and Triples, a Daily, turn bests."]],
  blurb: "Turn two cards. Find every pair in as few turns as you can.",
  timer: true,
  daily: "medium",
  levels: [
    {id:"small",   name:"Small 4×4",  note:"8 pairs",                     c:4, r:4, k:2, base:100, par:60},
    {id:"medium",  name:"Medium 4×5", note:"10 pairs",                    c:4, r:5, k:2, base:150, par:90},
    {id:"large",   name:"Large 6×6",  note:"18 pairs",          pro:1,    c:6, r:6, k:2, base:250, par:180},
    {id:"huge",    name:"Huge 6×7",   note:"21 pairs",          pro:1,    c:6, r:7, k:2, base:300, par:240},
    {id:"triples", name:"Triples 5×6",note:"10 sets of three",  pro:1,    c:5, r:6, k:3, base:300, par:200}
  ],
  proPerks: ["Large and Huge boards","Triples mode","Three extra themes","Score chart and level breakdown"],
  tutorial: [
    {icon:"🃏", title:"Find the pairs", body:"Tap two cards to turn them over. If they match they stay up. If not, they turn back, so remember where they were."},
    {icon:"🎯", title:"Fewer turns, higher score", body:"Every two cards is one turn. Finish in as few turns as you can, and fast, for a higher score."}
  ],
  st: null, lvl: null, els: [], grid: null, closeTimer: null,

  /* ---------- pure logic ---------- */
  deal(level){ const sets = level.c*level.r/level.k, faces = UL.shuffle([...Array(24).keys()]).slice(0, sets), deck = [];
    faces.forEach(f=>{ for(let j=0;j<level.k;j++) deck.push(f); }); return UL.shuffle(deck); },

  /* ---------- game ---------- */
  start({level, restore}){
    this.lvl = level; clearTimeout(this.closeTimer); this.closeTimer = null;
    const st = this.st = restore ? JSON.parse(JSON.stringify(restore))
      : {deck:this.deal(level), k:level.k, matched:[], open:[], openSeen:[], closing:[], seen:[], turns:0, found:0, streak:0, misses:0};
    if(!st.openSeen) st.openSeen = st.open.map(()=>true);
    if(st.closing.length){ st.closing = []; }           // a mismatch shown when the game was saved is turned back on reload
    const stage = document.getElementById("stage"), g = this.grid = document.createElement("div"); g.className = "pr-grid";
    const S = Math.min(stage.clientWidth, stage.clientHeight) || 340, cs = Math.floor(Math.min(S/level.c, S/level.r));
    g.style.setProperty("--c", level.c); g.style.setProperty("--r", level.r);
    g.style.width = (cs*level.c)+"px"; g.style.height = (cs*level.r)+"px"; g.style.left = ((S - cs*level.c)/2)+"px"; g.style.top = ((S - cs*level.r)/2)+"px";
    this.els = st.deck.map((f, i)=>{
      const card = document.createElement("button"); card.className = "pr-card"; card.dataset.i = i; card.setAttribute("aria-label", "Card "+(i+1));
      card.innerHTML = '<span class="pr-in"><span class="pr-back"></span><span class="pr-front">'+prFace(f)+'</span></span>';
      card.addEventListener("pointerdown", e=>{ e.preventDefault(); this.tap(i); });
      g.appendChild(card); return card;
    });
    stage.appendChild(g); this.paint(); this.hud();
  },
  serialize(){ return JSON.parse(JSON.stringify(this.st)); },
  sets(){ return this.st.deck.length / this.st.k; },
  hud(){ const s = this.st; UL.setStat("Turns <b>"+s.turns+"</b> · "+(this.sets() - s.found)+(s.k===3 ? " sets" : " pairs")+" left"); },
  paint(){ const s = this.st; this.els.forEach((e, i)=>{ const up = s.matched.includes(i) || s.open.includes(i) || s.closing.includes(i);
    e.classList.toggle("up", up); e.classList.toggle("got", s.matched.includes(i));
    e.setAttribute("aria-label", up ? PR_NAMES[s.deck[i]%8]+" × "+(Math.floor(s.deck[i]/8)+1) : "Card "+(i+1)+", face down"); }); },
  closeNow(){ clearTimeout(this.closeTimer); this.closeTimer = null; this.st.closing = []; this.paint(); },
  tap(i){
    if(UL.paused()) return;
    const s = this.st;
    if(s.closing.length) this.closeNow();                     // a third tap turns a missed pair back at once
    if(s.matched.includes(i) || s.open.includes(i)) return;
    const wasSeen = s.seen.includes(i); if(!wasSeen) s.seen.push(i);
    s.open.push(i); s.openSeen.push(wasSeen); UL.buzz("tap"); this.paint();
    const f = s.deck[s.open[0]], same = s.open.every(j=>s.deck[j]===f);
    if(!same){                                                // a miss: the turn ends, the cards stay up for a moment
      s.turns++; s.streak = 0; s.misses++; s.closing = s.open; s.open = []; s.openSeen = [];
      this.closeTimer = setTimeout(()=>this.closeNow(), 700);
      this.hud(); UL.save(); return;
    }
    if(s.open.length < s.k){ UL.save(); return; }
    // a match
    const got = s.open, seenBefore = s.openSeen; s.open = []; s.openSeen = []; s.turns++; s.found++; s.streak++; s.matched.push(...got);
    this.paint(); got.forEach(j=>UL.pop(this.els[j])); UL.buzz("act");
    const allSeen = seenBefore.every(Boolean);            // every card of this match had been seen before this turn
    const lastCard = this.els[i];
    if(s.found === this.sets()){ this.hud(); UL.save(); return this.win(lastCard); }
    if(!wasSeen && got.length===2 && s.streak < 3){ /* the second card was new: a lucky find, the pop says enough */ }
    else if(s.streak >= 5) UL.praise(lastCard, 4);
    else if(s.streak >= 3) UL.praise(lastCard, 3);
    else if(allSeen) UL.praise(lastCard, 2);
    else UL.praise(lastCard, 1);
    this.hud(); UL.save();
  },
  win(el){
    const s = this.st, lvl = this.lvl, perfect = this.sets(), over = Math.max(0, s.turns - perfect), sec = UL.cur.sec;
    const score = Math.max(10, lvl.base - 5*over + Math.max(0, lvl.par - sec));
    UL.setScore(score);
    const best = UL.kv("best_"+lvl.id, 0), better = !best || s.turns < best; if(better) UL.setKv("best_"+lvl.id, s.turns);
    const unit = s.k===3 ? "sets" : "pairs";
    if(s.turns - perfect <= 2) UL.praise(el, 4); else UL.milestone(el, "All found!");
    UL.end({won:true, title:"All "+unit+" found", line:perfect+" "+unit+" in "+s.turns+" turns"+(better && best ? " · your best yet" : "")});
  },
  onPause(){ if(this.st && this.st.closing.length) this.closeNow(); }
};
