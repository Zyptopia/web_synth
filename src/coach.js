// Coach: metronome, arpeggiator, scale highlight, velocity curve
// + Chord Hints (stronger visuals), Key Labels overlay, and Smart Suggestions
// Creates its own floating panel; minimal CSS injected here

export class Coach{
  constructor({noteOnRaw, noteOffRaw, getKBEl}){
    this.noteOnRaw = noteOnRaw; // (midi, vel)
    this.noteOffRaw= noteOffRaw; // (midi)
    this.getKBEl   = getKBEl;

    // Metronome
    this.metroOn=false; this.bpm=120; this.metroTimer=null; this.metroAccent=4; this.metroCount=0;
    // Arp
    this.arpOn=false; this.arpRate=8; this.arpGate=0.5; this.arpPattern='up'; this.arpTimer=null; this.held=[]; this.heldSet=new Set(); this.arpIdx=0;
    // Dynamics
    this.velCurve='linear';
    // Scale
    this.scaleOn=false; this.scaleKey=0; this.scaleType='major';
    // New: chord hints + labels + suggestions
    this.hintsOn=true;     // highlight 3rd & 5th (minor 3rd if a minor-ish scale is selected)
    this.labelsOn=false;   // key labels overlay
    this.labelMode='note'; // 'note' | 'midi' | 'both'
    this.suggestOn=true;   // chord / note suggestions from held notes
  }

  mount(){ this.injectCSS(); this.buildPanel(); this.updateScale(); this.applyLabels(); this.updateSuggest(); }

  injectCSS(){
    const css=`#coach{position:fixed; right:12px; bottom:12px; width:340px; background:#0d0f11ee; backdrop-filter:blur(6px); border:1px solid #222; border-radius:16px; box-shadow:0 10px 30px rgba(0,0,0,.45); font-family:ui-sans-serif,system-ui; color:#eaeaea; z-index:9999}
#coach header{display:flex; align-items:center; justify-content:space-between; padding:10px 12px; border-bottom:1px solid #1b1d20; font-weight:600}
#coach .sec{display:grid; grid-template-columns: 120px 1fr; gap:8px 10px; padding:10px 12px; border-bottom:1px dashed #202226}
#coach label{color:#9aa4ae; font-size:12px; align-self:center}
#coach input[type=number],#coach select{background:#14171a; color:#eaeaea; border:1px solid #25282c; border-radius:10px; padding:6px 8px}
#coach .row{display:flex; gap:8px; align-items:center; flex-wrap:wrap}
#coach button{background:#1f6feb; border:none; color:white; border-radius:10px; padding:6px 10px; cursor:pointer}
#coach .muted{opacity:.75}
#coach .pill{background:#15181c; border:1px solid #23272c; padding:4px 8px; border-radius:999px; font-size:12px}
#coach footer{display:flex; justify-content:space-between; padding:10px 12px}
#coach .small{font-size:12px; color:#a9b4bf}
/* Existing scale highlight, now beefed up */
#kb .scale-ok{box-shadow: inset 0 0 0 3px #22c55e, 0 0 14px #22c55e55}
#kb .scale-no{opacity:.55}
/* NEW: bright chord-hint borders */
#kb .hint3{box-shadow: inset 0 0 0 3px #f59e0b, 0 0 16px #f59e0b66; filter:brightness(1.02)}
#kb .hint5{box-shadow: inset 0 0 0 3px #60a5fa, 0 0 16px #60a5fa66; filter:brightness(1.02)}
#kb .black.hint3{box-shadow: inset 0 0 0 3px #f59e0b, 0 0 10px #f59e0b66}
#kb .black.hint5{box-shadow: inset 0 0 0 3px #60a5fa, 0 0 10px #60a5fa66}
/* Labels */
#kb .noteTag{position:absolute; left:50%; transform:translateX(-50%); bottom:6px; padding:2px 6px; border-radius:6px; border:1px solid #2b3242; background:#0b0f16d9; color:#e7edf8; font:600 10px/1.1 ui-monospace,Consolas,monospace; pointer-events:none}
#kb .black .noteTag{bottom:4px; background:#0f172ad9; color:#ffffff}
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
<div class="sec" id="sec-hints">
  <label>Chord Hints</label><div class="row"><button id="co-hints">On</button><span class="small">hold a note → highlights 3rd & 5th</span></div>
  <label>Key Labels</label><div class="row"><button id="co-labels">Off</button><select id="co-labelMode"><option value="note" selected>Note</option><option value="midi">MIDI</option><option value="both">Both</option></select><span class="small muted">non‑intrusive overlay</span></div>
</div>
<div class="sec" id="sec-suggest">
  <label>Suggest</label>
  <div class="row"><button id="co-suggestToggle">On</button><div id="co-suggest" class="small" style="max-height:70px; overflow:auto"></div></div>
</div>
<footer><span class="small">Hold notes → patterns · Tap tempo to set BPM.</span><button id="co-close" class="muted">Hide</button></footer>`;
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
    const N=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
    for(let i=0;i<12;i++){ const o=document.createElement('option'); o.value=i; o.textContent=N[i]; if(i===0) o.selected=true; keyEl.appendChild(o) }
    keyEl.onchange=()=>{ this.scaleKey=+keyEl.value; this.updateScale(); this.updateChordHints(); };
    scaleEl.onchange=()=>{ this.scaleType=scaleEl.value; this.updateScale(); this.updateChordHints(); };
    scaleBtn.onclick=()=>{ this.scaleOn=!this.scaleOn; scaleBtn.textContent=this.scaleOn?'Hide':'Show'; this.updateScale() };

    // Hints
    const hintBtn=$('#co-hints'); hintBtn.onclick=()=>{ this.hintsOn=!this.hintsOn; hintBtn.textContent=this.hintsOn?'On':'Off'; if(!this.hintsOn) this.clearHints(); else this.updateChordHints(); };

    // Labels
    const labelsBtn=$('#co-labels'), labelModeEl=$('#co-labelMode');
    labelsBtn.onclick=()=>{ this.labelsOn=!this.labelsOn; labelsBtn.textContent=this.labelsOn?'On':'Off'; this.applyLabels(); };
    labelModeEl.onchange=()=>{ this.labelMode=labelModeEl.value; if(this.labelsOn) this.applyLabels(); };

    // Suggest
    const sugBtn=$('#co-suggestToggle'); this.sugArea=$('#co-suggest');
    sugBtn.onclick=()=>{ this.suggestOn=!this.suggestOn; sugBtn.textContent=this.suggestOn?'On':'Off'; if(!this.suggestOn) this.setSuggestText('—'); else this.updateSuggest(); };
  }

  // -------- Metronome ---------
  startMetro(){ if(this.metroOn) return; this.metroOn=true; const ctx=this.ctx(); const tick=()=>{ const per=60/this.bpm; const acc=(this.metroCount%this.metroAccent)===0; const f=acc?1600:1000; const g=acc?0.25:0.18; this.beep(f,g,0.04); this.metroCount++; this.metroTimer=setTimeout(tick, per*1000); }; tick(); }
  stopMetro(){ this.metroOn=false; clearTimeout(this.metroTimer); this.metroTimer=null }
  beep(freq=1000, gain=0.18, dur=0.05){ const ctx=this.ctx(); const o=ctx.createOscillator(), g=ctx.createGain(); o.type='square'; o.frequency.value=freq; g.gain.setValueAtTime(gain, ctx.currentTime); o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime+dur) }

  // -------- Arp ---------
  noteOn(m, vel=110){
    const v=this.shapeVel(vel);
    // record held
    if(!this.heldSet.has(m)){ this.heldSet.add(m); this.held=[...this.heldSet].sort((a,b)=>a-b) }
    // hints & suggestions update
    this.updateChordHints(m);
    this.updateSuggest();
    // arp or raw
    if(!this.arpOn){ this.noteOnRaw(m,v); return }
    if(!this.arpTimer) this.runArp();
  }
  noteOff(m){
    if(this.heldSet.has(m)) this.heldSet.delete(m); this.held=[...this.heldSet].sort((a,b)=>a-b);
    if(!this.arpOn){ this.noteOffRaw(m); }
    this.updateChordHints();
    this.updateSuggest();
    if(this.held.length===0) this.flushArp();
  }
  flushArp(){ clearTimeout(this.arpTimer); this.arpTimer=null; for(const n of this.held) this.noteOffRaw(n); }
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

  // -------- Key labels ---------
  applyLabels(){ const kb=this.getKBEl?.(); if(!kb) return; const keys=[...kb.querySelectorAll('[data-midi]')];
    // wipe existing
    kb.querySelectorAll('.noteTag').forEach(n=>n.remove());
    if(!this.labelsOn) return;
    for(const el of keys){ const m=+el.dataset.midi; const tag=document.createElement('div'); tag.className='noteTag'; tag.textContent=this.labelText(m); el.appendChild(tag); }
  }
  labelText(m){ const name=this.noteName(m); if(this.labelMode==='midi') return String(m); if(this.labelMode==='both') return `${name}
${m}`; return name }

  // -------- Chord hints (3rd & 5th) ---------
  updateChordHints(prefRoot=null){ const kb=this.getKBEl?.(); if(!kb) return; const keys=[...kb.querySelectorAll('[data-midi]')];
    keys.forEach(el=>{ el.classList.remove('hint3','hint5') }); if(!this.hintsOn) return;
    const root = prefRoot ?? (this.held[this.held.length-1]||null); if(root==null) return;
    const isMinor = /minor|dorian|blues|pentMinor/i.test(this.scaleType);
    const off3 = isMinor?3:4; const off5=7;
    for(const el of keys){ const m=+el.dataset.midi; const diff = (m - root) % 12; const n = (diff+12)%12; if(n===off3) el.classList.add('hint3'); if(n===off5) el.classList.add('hint5'); }
  }
  clearHints(){ const kb=this.getKBEl?.(); if(!kb) return; kb.querySelectorAll('.hint3,.hint5').forEach(el=>el.classList.remove('hint3','hint5')); }

  // -------- Suggestions ---------
  updateSuggest(){ if(!this.suggestOn){ this.setSuggestText('—'); return } const pcs=[...this.heldSet].map(n=>((n%12)+12)%12); if(pcs.length===0){ this.setSuggestText('Play a note or two…'); return }
    const uniq=[...new Set(pcs)]; const sugg=this.chordSuggest(uniq).slice(0,4);
    if(sugg.length===0){ this.setSuggestText('Try adding a 3rd or 5th.'); return }
    const out=sugg.map(s=>`${s.name} — ${s.tip}`).join('<br>'); this.setSuggestText(out);
  }
  setSuggestText(html){ if(this.sugArea) this.sugArea.innerHTML=html }

  chordSuggest(pcs){ // pcs: array of pitch classes 0..11
    const N=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
    const triads=[ {name:'maj', ints:[0,4,7], tips:['3rd','5th']}, {name:'min', ints:[0,3,7], tips:['♭3','5th']}, {name:'sus2', ints:[0,2,7], tips:['2nd','5th']}, {name:'sus4', ints:[0,5,7], tips:['4th','5th']}, {name:'dim', ints:[0,3,6], tips:['♭3','♭5']}, {name:'aug', ints:[0,4,8], tips:['3rd','♯5']} ];
    const results=[];
    for(let r=0;r<12;r++){
      for(const t of triads){ const ints=t.ints.map(i=>(i+r)%12); const match=ints.filter(i=>pcs.includes(i)).length; if(match>=2){ const miss=ints.filter(i=>!pcs.includes(i)); const need = miss.map(i=>this.prettyPC(i)); const name=`${N[r]} ${t.name}`; const tip = need.length?`try ${need.join(' / ')}`:`add color: ${this.prettyPC((r+2)%12)} or ${this.prettyPC((r+9)%12)}`; const score=match - miss.length*0.25; results.push({name, tip, score}); } }
    }
    results.sort((a,b)=>b.score-a.score); return results;
  }

  prettyPC(pc){ const N=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']; return N[(pc+12)%12] }
  noteName(m){ const N=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']; const n=N[m%12]; const o=Math.floor(m/12)-1; return `${n}${o}` }

  // -------- Velocity curve ---------
  shapeVel(vel){ const x=vel/127; if(this.velCurve==='soft') return Math.round(127*Math.pow(x,0.7)); if(this.velCurve==='hard') return Math.round(127*Math.pow(x,1.7)); return vel }

  // Utility
  ctx(){ return (window.Eng && Eng.ctx) ? Eng.ctx : new (window.AudioContext||window.webkitAudioContext)() }
}

function clamp(v,lo,hi){ return Math.max(lo,Math.min(hi,v)) }
