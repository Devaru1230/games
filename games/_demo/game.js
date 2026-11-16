/* =====================================================================
   GAME CONTRACT — replace this whole section with your game.
   Required:  id, name, title, version, levels, start(), serialize()
   The shell calls GAME.start({level, daily, restore}) for a new game AND
   to reload a saved one (restore = whatever serialize() returned).
   Use UL.rnd / UL.random / UL.shuffle for ALL randomness so Restart and
   the Daily replay the identical game.
   ===================================================================== */
const GAME = {
  id: "demo",                                  // lowercase, unique, never changes (storage key)
  name: "Ad Free Demo",                        // full name
  title: ["DE","MO"],                          // masthead: second half is tinted
  icon: "🎯",                                  // used in share text
  version: "1.0",
  changelog: [["1.0","First release."]],
  blurb: "Tap the lit tile. Ten taps wins.",   // shown in the New game picker
  timer: true,                                 // false hides the clock (score-attack games)
  daily: "normal",                             // level id used for the Daily, or omit for no Daily
  levels: [
    {id:"normal", name:"Normal", note:"10 taps"},
    {id:"long",   name:"Marathon", note:"30 taps", pro:1}
  ],
  proPerks: ["Marathon mode","Three extra themes","Score chart and level breakdown"],
  tutorial: [
    {icon:"🎯", title:"The goal", body:"One tile lights up. Tap it. A wrong tap costs a point."}
  ],
  st: null,
  start({level, restore}){
    const st = this.st = restore || {need: level.id==="long"?30:10, hits:0, lit:UL.rnd(9)};
    const grid = document.createElement("div"); grid.className = "dm-grid";
    for(let i=0;i<9;i++){
      const c = document.createElement("div"); c.className = "dm-cell";
      c.addEventListener("pointerdown", ()=>{
        if(UL.paused()) return;
        if(i !== st.lit){ UL.buzz("err"); UL.shake(c); UL.setScore(Math.max(0, UL.cur.score-1)); return; }
        st.hits++; UL.buzz("act"); UL.pop(c); UL.addScore(10);
        UL.praise(c, st.hits%5===0 ? 3 : 1);
        if(st.hits >= st.need) return UL.end({won:true, title:"Done", line:st.hits+" taps"});
        let n; do { n = UL.rnd(9); } while(n === st.lit); st.lit = n; this.draw(); UL.save();
      });
      grid.appendChild(c);
    }
    document.getElementById("stage").appendChild(grid);
    this.draw();
  },
  draw(){ document.querySelectorAll(".dm-cell").forEach((c,i)=>c.classList.toggle("lit", i===this.st.lit)); UL.setStat("Taps <b>"+this.st.hits+"/"+this.st.need+"</b>"); },
  serialize(){ return this.st; }
};
