// Mobile mini keyboard + drum pad with real piano layout
(function (MP) {
  const isMobile =
    (MP && MP.isMobile) ||
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0;
  if (!isMobile) return;

  // Make sure the CSS hook exists so other styles (e.g., hiding Connect MIDI) work
  document.documentElement.classList.add("mobile");

  // ---- styles (self-contained) ----
  const css = `
  .mp-pad__toggle{
    position:fixed; right:10px; bottom:calc(var(--dockh, 0px) + 12px);
    z-index:10050; background:#17233a; border:1px solid #2a3b52;
    border-radius:14px; padding:8px 10px; font-size:13px; color:#e8f0ff
  }
  .mp-pad{
    position:fixed; left:0; right:0; bottom:0; z-index:10040; background:#0e1622;
    border-top:1px solid #223049; box-shadow:0 -10px 30px rgba(0,0,0,.35);
    transform:translateY(100%); transition:transform .22s ease
  }
  .mp-pad.show{ transform:translateY(0) }
  .mp-pad__bar{ display:flex; gap:8px; align-items:center; padding:6px 8px; border-bottom:1px solid #223049 }
  .mp-pad__bar .sp{ flex:1 }
  .mp-pad__btn{ background:#0f172a; color:#e8f0ff; border:1px solid #263142; border-radius:10px; padding:6px 10px }
  .mp-pad__grid{ display:grid; grid-template-columns:repeat(8,1fr); gap:8px; padding:8px } /* used for Drums */

  /* Piano */
  .mp-piano{ position:relative; height:180px; padding:8px }
  .mp-white{
    position:relative; display:inline-block; height:100%; width:calc(100% / 8);
    border:1px solid #2a3b52; border-bottom-color:#1c2a44;
    background:linear-gradient(#f4f7ff,#d7e2ff); border-radius:6px 6px 4px 4px;
    box-shadow:inset 0 -6px 0 rgba(0,0,0,.08)
  }
  .mp-white.pressed{ background:linear-gradient(#e0e8ff,#c4d3ff); box-shadow:inset 0 6px 0 rgba(0,0,0,.08) }
  .mp-black{
    position:absolute; top:8px; height:60%; width:calc(100% / 8 * .62);
    transform:translateX(-50%); z-index:2;
    background:linear-gradient(#222,#050505); border:1px solid #000; border-radius:0 0 4px 4px
  }
  .mp-black.pressed{ background:linear-gradient(#111,#000) }
  .mp-keylbl{ position:absolute; bottom:6px; left:50%; transform:translateX(-50%); font-size:12px; color:#1b2440 }
  `;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  // ---- DOM shell ----
  const toggle = document.createElement("button");
  toggle.className = "mp-pad__toggle";
  toggle.textContent = "Pad";
  document.body.appendChild(toggle);

  const pad = document.createElement("div");
  pad.className = "mp-pad";
  pad.innerHTML = `
    <div class="mp-pad__bar">
      <button id="mpPadLayout" class="mp-pad__btn">Piano</button>
      <div class="sp"></div>
      <div style="display:flex;gap:6px;align-items:center">
        <button id="mpOctDown" class="mp-pad__btn">◀︎</button>
        <span id="mpOctLbl" style="color:#9fb3d1;font-size:12px">C4–C5</span>
        <button id="mpOctUp" class="mp-pad__btn">▶︎</button>
      </div>
      <button id="mpPadClose" class="mp-pad__btn">▾</button>
    </div>
    <div id="mpPadArea"></div>`;
  document.body.appendChild(pad);

  const btnLayout = pad.querySelector("#mpPadLayout");
  const btnClose = pad.querySelector("#mpPadClose");
  const btnOctDown = pad.querySelector("#mpOctDown");
  const btnOctUp = pad.querySelector("#mpOctUp");
  const octLbl = pad.querySelector("#mpOctLbl");
  const area = pad.querySelector("#mpPadArea");

  // ---- data ----
  let layout = "piano"; // 'piano' | 'drums'
  let octave = 4;       // C4 default (60..72 inclusive)
  const PADS = [40,41,42,43,36,37,38,39];

  // Helpers
  function noteName(n){
    return ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'][n%12] + (Math.floor(n/12)-1);
  }
  function setOctLbl(){
    const low = 60 + (octave-4)*12; // C4 is 60
    octLbl.textContent = `${noteName(low).replace(/\d+/,'')}${octave}–C${octave+1}`;
  }

  // Multitouch safety
  const pointerToNote = new Map();
  function bindPress(el, note, isBlack){
    const down = (e)=>{
      e.preventDefault();
      el.classList.add('pressed');
      MP.engine.noteOn(note, 110);
      pointerToNote.set(e.pointerId || 'm', note);
    };
    const up = (e)=>{
      e.preventDefault();
      const id = e.pointerId || 'm';
      const n = pointerToNote.get(id);
      pointerToNote.delete(id);
      el.classList.remove('pressed');
      if (typeof n === 'number') MP.engine.noteOff(n);
    };
    el.addEventListener('pointerdown', down, {passive:false});
    el.addEventListener('pointerup', up, {passive:false});
    el.addEventListener('pointerleave', up, {passive:false});
    el.addEventListener('pointercancel', up, {passive:false});
  }

  function buildPiano(){
    area.innerHTML = '';
    area.className = 'mp-piano';

    const wrap = document.createElement('div');
    wrap.style.position = 'relative';
    wrap.style.height = '100%';
    area.appendChild(wrap);

    // White keys: C D E F G A B + high C (8 whites)
    const whiteOffsets = [0,2,4,5,7,9,11,12];  // semitone offsets from base C
    const blackAtIndex = { 0:1, 1:3, 3:6, 4:8, 5:10 }; // above C,D,F,G,A (E & B have none)

    // base MIDI note for C<octave>
    const base = 12 * (octave + 1); // C4=60

    // Create whites first (so blacks can overlay)
    const whites = [];
    for (let i=0;i<whiteOffsets.length;i++){
      const n = base + whiteOffsets[i];
      const w = document.createElement('div');
      w.className = 'mp-white';
      // label C and F to help orientation
      const pc = n % 12;
      if (pc === 0 || pc === 5) {
        const lab = document.createElement('div');
        lab.className = 'mp-keylbl';
        lab.textContent = noteName(n);
        w.appendChild(lab);
      }
      bindPress(w, n, false);
      wrap.appendChild(w);
      whites.push({el:w, leftIndex:i});
    }

    // Place blacks positioned between whites
    whites.forEach(({el, leftIndex})=>{
      if (blackAtIndex[leftIndex] === undefined) return;
      const offset = blackAtIndex[leftIndex];
      const n = base + offset;
      const b = document.createElement('div');
      b.className = 'mp-black';
      // horizontally center over the gap between this white and the next
      const w = el.getBoundingClientRect().width || (100/8);
      b.style.left = `calc(${(leftIndex+1)*100/8}% - ${w*0.5}px)`; // translateX(-50%) applied in CSS
      bindPress(b, n, true);
      wrap.appendChild(b);
    });

    setOctLbl();
  }

  function buildDrums(){
    area.innerHTML = '';
    area.className = 'mp-pad__grid';
    PADS.forEach((padNum)=>{
      const t = MP.PAD_TO_TYPE[padNum];
      const btn = document.createElement('button');
      btn.className = 'mp-pad__btn';
      btn.innerHTML = `<span class="lbl">${t.replace('-',' ')}</span><span class="sub">Pad ${padNum}</span>`;
      const start = (e)=>{ e.preventDefault(); MP.midi.triggerPad(t,118); };
      btn.addEventListener('pointerdown', start, {passive:false});
      btn.addEventListener('pointerup', (e)=>e.preventDefault(), {passive:false});
      area.appendChild(btn);
    });
  }

  function build(){
    if (layout === 'piano'){
      btnLayout.textContent = 'Drums';
      btnOctDown.style.display = '';
      btnOctUp.style.display = '';
      octLbl.style.display = '';
      buildPiano();
    } else {
      btnLayout.textContent = 'Piano';
      btnOctDown.style.display = 'none';
      btnOctUp.style.display = 'none';
      octLbl.style.display = 'none';
      buildDrums();
    }
  }

  // Show/hide + controls
  toggle.addEventListener('click', ()=> pad.classList.add('show'));
  btnClose.addEventListener('click', ()=> pad.classList.remove('show'));
  btnLayout.addEventListener('click', ()=>{ layout = (layout==='piano') ? 'drums' : 'piano'; build(); });

  btnOctDown.addEventListener('click', ()=>{ octave = Math.max(1, octave-1); buildPiano(); });
  btnOctUp.addEventListener('click', ()=>{ octave = Math.min(7, octave+1); buildPiano(); });

  // Keep toggle above dock if its height changes
  const dock = document.querySelector('.dock');
  if (dock) {
    const ro = new ResizeObserver(()=>{
      const h = dock.getBoundingClientRect().height || 0;
      document.documentElement.style.setProperty('--dockh', `${h}px`);
    });
    ro.observe(dock);
  }

  // Initial render
  build();
})(window.MP);
