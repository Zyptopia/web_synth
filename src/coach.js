// Coach: metronome, arpeggiator, scale highlight, velocity curve
// Creates its own floating panel; minimal CSS injected here

export class Coach{
  constructor({noteOnRaw, noteOffRaw, getKBEl}){
    this.noteOnRaw = noteOnRaw; // (midi, vel)
    this.noteOffRaw= noteOffRaw; // (midi)
    this.getKBEl   = getKBEl;

    this.metroOn=false; this.bpm=120; this.metroTimer=null; this.metroAccent=4; this.metroCount=0;
    this.arpOn=false; this.arpRate=8; this.arpGate=0.5; this.arpPattern='up'; this.arpTimer=null; this.held=[]; this.heldSet=new Set(); this.arpIdx=0;
    this.velCurve='linear';
    this.scaleOn=false; this.scaleKey=0; this.scaleType='major';
  }

  mount(){ this.injectCSS(); this.buildPanel(); this.updateScale(); }

  injectCSS(){
    const css=`#coach{position:fixed; right:12px; bottom:12px; width:320px; background:#0d0f11ee; backdrop-filter:blur(6px); border:1px solid #222; border-radius:16px; box-shadow:0 10px 30px rgba(0,0,0,.45); font-family:ui-sans-serif,system-ui; color:#eaeaea; z-index:9999}
#coach header{display:flex; align-items:center; justify-content:space-between; padding:10px 12px; border-bottom:1px solid #1b1d20; font-weight:600}
#coach .sec{display:grid; grid-template-columns: 120px 1fr; gap:8px 10px; padding:10px 12px; border-bottom:1px dashed #202226}
#coach label{color:#9aa4ae; font-size:12px; align-self:center}
#coach input[type=number],#coach select{background:#14171a; color:#eaeaea; border:1px solid #25282c; border-radius:10px; padding:6px 8px}
#coach .row{display:flex; gap:8px; align-items:center}
#coach button{background:#1f6feb; border:none; color:white; border-radius:10px; padding:6px 10px; cursor:pointer}
#coach .muted{opacity:.75}
#coach .pill{background:#15181c; border:1px solid #23272c; padding:4px 8px; border-radius:999px; font-size:12px}
#coach footer{display:flex; justify-content:space-between; padding:10px 12px}
#coach .small{font-size:12px; color:#a9b4bf}
#kb .scale-ok{box-shadow: inset 0 0 0 2px #2ea043aa}
#kb .scale-no{opacity:.55}
`;
    const style=document.createElement('style'); style.textContent=css; document.head.appendChild(style);
  }

  buildPanel(){
    const wrap=document.createElement('div'); wrap.id='coach'; wrap.innerHTML=`
<header>Coach <span class="pill">learn & perform</span></header>
<div class="sec" id="sec-metro">
  <label>BPM</label><div class="row"><input id="co-bpm" type="number" min="20" max="240" value="120"><button id="co-tap">Tap</button><button id="co-metro">Start</button></div>
  <label>Accent /</label><div class="row"><select id="co-accent"><option value="2">2</option><option value="3">3</option><option value="4" selected>4</option><option value="6">6</option><option value="8">8</option></select><span class="small muted">1st beat accented</span></div>
</div>
<div class="sec" id="sec-arp">
  <label>Arp</label><div class="row"><select id="co-arpPat"><option>up</option><option>down</option><option>updown</option><option>random</option><option>chord</option></select><select id="co-arpRate"><option value="4">1/4</option><option value="8" selected>1/8</option><option value="16">1/16</option><option value="12">1/8T</option></select><input id="co-arpGate" type="number" min="0.1" max="0.95" step="0.05" value="0.5"><button id="co-arp">Off</button></div>
  <label>Velocity</label><div class="row"><select id="co-vel"><option value="linear" selected>Linear</option><option value="soft">Soft</option><option value="hard">Hard</option></select><span class="small muted">shape key & pad dynamics</span></div>
</div>
<div class="sec" id="sec-scale">
  <label>Scale</label><div class="row"><select id="co-key"></select><select id="co-scale"><option value="major">Major (Ionian)</option><option value="minor">Natural Minor (Aeolian)</option><option value="pentMajor">Pentatonic Major</option><option value="pentMinor">Pentatonic Minor</option><option value="blues">Blues</option><option value="dorian">Dorian</option><option value="mixolydian">Mixolydian</option></select><button id="co-scaleToggle">Show</button></div>
</div>
<footer><span class="small">Hold notes → Arp patterns; Tap to set tempo.</span><button id="co-close" class="muted">Hide</button></footer>`;
    document.body.appendChild(wrap);

    // wire
    const $=s=>wrap.querySelector(s);
    $('#co-close').onclick=()=>{ wrap.style.display='none' };

    // BPM / Metro
    const bpmEl=$('#co-bpm'), accentEl=$('#co-accent'), tapBtn=$('#co-tap'), metroBtn=$('#co-metro');
    bpmEl.onchange=()=>{ this.bpm=clamp(+bpmEl.value,20,240); bpmEl.value=this.bpm };
    accentEl.onchange=()=>{ this.metroAccent=+accentEl.value };
    metroBtn.onclick=()=>{ this.metroOn?this.stopMetro():this.startMetro(); metroBtn.textContent=this.metroOn?'Stop':'Start' };
    // Tap tempo
    let lastTap=0; tapBtn.onclick=()=>{ const t=performance.now(); if(lastTap){ const dt=t-lastTap; const bpm=Math.round(60000/dt); if(bpm>=40&&bpm<=240){ this.bpm=bpm; bpmEl.value=bpm } } lastTap=t };

    // Arp
    const patEl=$('#co-arpPat'), rateEl=$('#co-arpRate'), gateEl=$('#co-arpGate'), arpBtn=$('#co-arp');
    patEl.onchange=()=>{ this.arpPattern=patEl.value };
    rateEl.onchange=()=>{ this.arpRate=+rateEl.value };
    gateEl.onchange=()=>{ this.arpGate=Math.max(0.1,Math.min(0.95, +gateEl.value)) };
    arpBtn.onclick=()=>{ this.arpOn=!this.arpOn; arpBtn.textContent=this.arpOn?'On':'Off'; if(!this.arpOn) this.flushArp() };

    // Velocity curve
    const velEl=$('#co-vel'); velEl.onchange=()=>{ this.velCurve=velEl.value };

    // Scale
    const keyEl=$('#co-key'), scaleEl=$('#co-scale'), scaleBtn=$('#co-scaleToggle');
    // fill keys
    const N=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
    for(let i=0;i<12;i++){ const o=document.createElement('option'); o.value=i; o.textContent=N[i]; if(i===0) o.selected=true; keyEl.appendChild(o) }
    keyEl.onchange=()=>{ this.scaleKey=+keyEl.value; this.updateScale() };
    scaleEl.onchange=()=>{ this.scaleType=scaleEl.value; this.updateScale() };
    scaleBtn.onclick=()=>{ this.scaleOn=!this.scaleOn; scaleBtn.textContent=this.scaleOn?'Hide':'Show'; this.updateScale() };
  }

  // -------- Metronome ---------
  startMetro(){ if(this.metroOn) return; this.metroOn=true; const ctx=this.ctx(); const tick=()=>{ const t=ctx.currentTime; const per=60/this.bpm; const acc=(this.metroCount%this.metroAccent)===0; const f=acc?1600:1000; const g=acc?0.25:0.18; this.beep(f,g,0.04); this.metroCount++; this.metroTimer=setTimeout(tick, per*1000); }; tick(); }
  stopMetro(){ this.metroOn=false; clearTimeout(this.metroTimer); this.metroTimer=null }
  beep(freq=1000, gain=0.18, dur=0.05){ const ctx=this.ctx(); const o=ctx.createOscillator(), g=ctx.createGain(); o.type='square'; o.frequency.value=freq; g.gain.setValueAtTime(gain, ctx.currentTime); o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime+dur) }

  // -------- Arp ---------
  noteOn(m, vel=110){
    const v=this.shapeVel(vel);
    if(!this.arpOn){ this.noteOnRaw(m,v); return }
    if(!this.heldSet.has(m)){ this.heldSet.add(m); this.held=[...this.heldSet].sort((a,b)=>a-b) }
    if(!this.arpTimer) this.runArp();
  }
  noteOff(m){ if(!this.arpOn){ this.noteOffRaw(m); return } this.heldSet.delete(m); this.held=[...this.heldSet].sort((a,b)=>a-b); if(this.held.length===0) this.flushArp() }
  flushArp(){ clearTimeout(this.arpTimer); this.arpTimer=null; // all notes off
    for(const n of this.held) this.noteOffRaw(n);
  }
  runArp(){ if(this.arpTimer) return; const step=()=>{ if(this.held.length===0){ this.arpTimer=null; return }
      const notes=this.patternOrder(this.held);
      const idx=this.arpIdx%notes.length; const n=notes[idx]; this.arpIdx++;
      this.noteOnRaw(n,110);
      const perMS=(60/this.bpm)*1000*(4/this.arpRate); const gateMS=perMS*this.arpGate;
      setTimeout(()=>this.noteOffRaw(n), gateMS);
      this.arpTimer=setTimeout(step, perMS);
    }; step(); }
  patternOrder(list){ switch(this.arpPattern){ case 'down': return [...list].reverse(); case 'updown': { const up=[...list]; const dn=[...list].reverse().slice(1,-1); return up.concat(dn) } case 'random': return [list[Math.floor(Math.random()*list.length)]]; case 'chord': default: return list; } }

  // -------- Scale highlight ---------
  updateScale(){ const kb=this.getKBEl?.(); if(!kb) return; const keys=[...kb.querySelectorAll('[data-midi]')]; keys.forEach(el=>{ el.classList.remove('scale-ok','scale-no') }); if(!this.scaleOn) return; const allow=this.scaleSet(this.scaleKey,this.scaleType); keys.forEach(el=>{ const m=+el.dataset.midi; const ok=allow.has(m%12); el.classList.add(ok?'scale-ok':'scale-no') }); }
  scaleSet(key, type){ const S={ major:[0,2,4,5,7,9,11], minor:[0,2,3,5,7,8,10], pentMajor:[0,2,4,7,9], pentMinor:[0,3,5,7,10], blues:[0,3,5,6,7,10], dorian:[0,2,3,5,7,9,10], mixolydian:[0,2,4,5,7,9,10] }; const ints=S[type]||S.major; const set=new Set(); for(const i of ints){ set.add((i+key)%12) } return set }

  // -------- Velocity curve ---------
  shapeVel(vel){ const x=vel/127; if(this.velCurve==='soft') return Math.round(127*Math.pow(x,0.7)); if(this.velCurve==='hard') return Math.round(127*Math.pow(x,1.7)); return vel }

  // Utility
  ctx(){ return (window.Eng && Eng.ctx) ? Eng.ctx : new (window.AudioContext||window.webkitAudioContext)() }
}

function clamp(v,lo,hi){ return Math.max(lo,Math.min(hi,v)) }
