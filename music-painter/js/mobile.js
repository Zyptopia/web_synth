// Mobile mini keyboard + pads + compact control panel (pad opens by default)
(function (MP) {
  const isMobile =
    (MP && MP.isMobile) ||
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0;
  if (!isMobile) return;

  // Hide desktop-only MIDI button just in case CSS misses it
  const midiBtn = document.getElementById('btnConnectMIDI');
  if (midiBtn) midiBtn.style.display = 'none';

  document.documentElement.classList.add("mobile");

  // ---------- styles (adds on top of app.css) ----------
  const css = `
  :root{ --padFixedH: 44svh; --padFixedW: 46vw; --padH:0px; --topH:0px; }

  .mp-pad__toggle{
    position:fixed; right:10px; bottom:12px;
    z-index:10050; background:#17233a; border:1px solid #2a3b52;
    border-radius:14px; padding:8px 10px; font-size:13px; color:#e8f0ff
  }
  .mp-pad{
    position:fixed; left:0; right:0; bottom:0; z-index:10040; background:#0e1622;
    border-top:1px solid #223049; box-shadow:0 -10px 30px rgba(0,0,0,.35);
    height:var(--padFixedH);
    transform:translateY(100%); transition:transform .22s ease
  }
  .mp-pad.show{ transform:translateY(0) }
  .mp-pad__bar{ display:flex; gap:8px; align-items:center; padding:6px 8px; border-bottom:1px solid #223049 }
  .mp-pad__bar .sp{ flex:1 }
  .mp-pad__btn{ background:#0f172a; color:#e8f0ff; border:1px solid #263142; border-radius:10px; padding:6px 10px }
  .mp-ctrls{ padding:8px; background:#0e1622; border-bottom:1px solid #223049; max-height:34svh; overflow:auto; }
  .mp-ctrls.hidden{ display:none; }
  .mp-ctrls__tabs{ display:flex; gap:6px; flex-wrap:wrap; margin-bottom:6px; }
  .mp-ctrls__tab{ padding:4px 8px; border:1px solid #263142; border-radius:999px; background:#0f172a; color:#9fb3d1; font-size:12px; }
  .mp-ctrls__tab.active{ background:#17233a; color:#e8f0ff; border-color:#2a3b52; }
  .mp-ctrls__section{ display:none; }
  .mp-ctrls__section.active{ display:block; }
  .mp-padsRow{ display:grid; grid-template-columns:repeat(8,1fr); gap:8px; padding:8px; }

  /* Piano visuals */
  .mp-piano{ position:relative; height:180px; padding:8px; -webkit-user-select:none; user-select:none; }
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

  /* Canvas sizing on mobile */
  .mobile #stageWrap{ height:calc(100svh - var(--topH,0px) - var(--padH,0px)); }
  .mobile.land #stageWrap{ height:calc(100svh - var(--topH,0px)); }
  .mobile.land .mp-pad{
    top:var(--topH,0px); bottom:auto; right:0; left:auto;
    width:min(var(--padFixedW), 420px); height:calc(100svh - var(--topH,0px));
    border-top:none; border-left:1px solid #223049;
    transform:translateX(100%);
  }
  .mobile.land .mp-pad.show{ transform:translateX(0); }
  `;
  const style = document.createElement("style"); style.textContent = css; document.head.appendChild(style);

  // ---------- shell ----------
  const toggle = document.createElement("button");
  toggle.className = "mp-pad__toggle";
  toggle.textContent = "Pad";
  document.body.appendChild(toggle);

  const pad = document.createElement("div");
  pad.className = "mp-pad";
  pad.innerHTML = `
    <div class="mp-pad__bar">
      <button id="mpToggleCtrls" class="mp-pad__btn">▸ Controls</button>
      <div class="sp"></div>
      <div style="display:flex;gap:6px;align-items:center">
        <button id="mpOctDown" class="mp-pad__btn">◀︎</button>
        <span id="mpOctLbl" style="color:#9fb3d1;font-size:12px"></span>
        <button id="mpOctUp" class="mp-pad__btn">▶︎</button>
      </div>
      <button id="mpPadsToggle" class="mp-pad__btn">Pads: On</button>
      <button id="mpPadClose" class="mp-pad__btn">▾</button>
    </div>
    <div id="mpCtrls" class="mp-ctrls hidden">
      <div class="mp-ctrls__tabs" id="mpTabs"></div>
      <div id="mpSecs"></div>
    </div>
    <div id="mpPianoArea" class="mp-piano"></div>
    <div id="mpPadsRow" class="mp-padsRow"></div>
  `;
  document.body.appendChild(pad);

  // Selectors
  const btnClose   = pad.querySelector("#mpPadClose");
  const btnCtrls   = pad.querySelector("#mpToggleCtrls");
  const btnOctDown = pad.querySelector("#mpOctDown");
  const btnOctUp   = pad.querySelector("#mpOctUp");
  const octLbl     = pad.querySelector("#mpOctLbl");
  const btnPads    = pad.querySelector("#mpPadsToggle");
  const ctrlsWrap  = pad.querySelector("#mpCtrls");
  const tabsEl     = pad.querySelector("#mpTabs");
  const secsEl     = pad.querySelector("#mpSecs");
  const pianoArea  = pad.querySelector("#mpPianoArea");
  const padsRow    = pad.querySelector("#mpPadsRow");

  // ---------- data ----------
  const PADS = [40,41,42,43,36,37,38,39];
  let padsVisible = true;
  let octave = 4; // C4

  const noteName = (n)=> ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'][n%12] + (Math.floor(n/12)-1);
  const setOctLbl = ()=> {
    const low = 12*(octave+1);
    // No labels on keys; only tiny status label here:
    octLbl.textContent = `${noteName(low).replace(/\d+/, '')}${octave}–C${octave+1}`;
  };

  // ---------- layout / sizing ----------
  const topbar = document.querySelector('.topbar');
  const isLandscape = () =>
    window.matchMedia('(orientation: landscape)').matches || (window.innerWidth > window.innerHeight);

  function updateTop(){
    const th = topbar?.getBoundingClientRect().height || 0;
    document.documentElement.style.setProperty('--topH', `${th}px`);
  }

  function applyPadSpace(){
  const land = isLandscape();
  document.documentElement.classList.toggle('land', land);
  const open = pad.classList.contains('show');
  document.documentElement.style.setProperty('--padH', (open && !land) ? 'var(--padFixedH)' : '0px');
  setPadWVar();
}


  function requestCanvasResize(){
    // Resize canvases without losing pixels (draw.js preserves)
    MP.draw?.resizeAll?.();
  }

  function showPad(open){
    if (open){
      pad.classList.add('show');
      toggle.style.display = 'none';
    } else {
      pad.classList.remove('show');
      setTimeout(()=>{ toggle.style.display = ''; }, 180);
    }
    applyPadSpace();
    requestCanvasResize();
  }

  // ---------- helpers ----------

  function setPadWVar(){
  const land = isLandscape();
  const open = pad.classList.contains('show');
  let px = '0px';
  if (land && open) {
    const w = Math.min(window.innerWidth * 0.46, 420); // match CSS min(46vw, 420px)
    px = `${Math.round(w)}px`;
  }
  document.documentElement.style.setProperty('--padW', px);
}

  const pointerToNote = new Map();
  function bindPress(el, note){
    const down = (e)=>{ e.preventDefault(); el.classList.add('pressed'); MP.engine.noteOn(note, 110); pointerToNote.set(e.pointerId || 'm', note); };
    const up   = (e)=>{ e.preventDefault(); const id=e.pointerId||'m'; const n=pointerToNote.get(id); pointerToNote.delete(id); el.classList.remove('pressed'); if(typeof n==='number') MP.engine.noteOff(n); };
    el.addEventListener('pointerdown', down, {passive:false});
    el.addEventListener('pointerup', up, {passive:false});
    el.addEventListener('pointerleave', up, {passive:false});
    el.addEventListener('pointercancel', up, {passive:false});
  }

  function buildPiano(){
    pianoArea.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.style.position='relative'; wrap.style.height='100%';
    pianoArea.appendChild(wrap);

    const whiteOffsets = [0,2,4,5,7,9,11,12];
    const blackAtIndex = { 0:1, 1:3, 3:6, 4:8, 5:10 };
    const base = 12*(octave+1);

    const whites=[];
    for (let i=0;i<whiteOffsets.length;i++){
      const n=base+whiteOffsets[i];
      const w=document.createElement('div'); w.className='mp-white';
      // (No text labels to avoid selection popups)
      bindPress(w,n); wrap.appendChild(w); whites.push({el:w,i});
    }
    whites.forEach(({el,i})=>{
      if (blackAtIndex[i]===undefined) return;
      const offset=blackAtIndex[i], n=base+offset;
      const b=document.createElement('div'); b.className='mp-black';
      const w = el.getBoundingClientRect().width || (pianoArea.clientWidth/8);
      b.style.left = `calc(${(i+1)*100/8}% - ${w*0.5}px)`;
      bindPress(b,n); wrap.appendChild(b);
    });
    setOctLbl();
  }

  function buildPads(){
    padsRow.innerHTML='';
    padsRow.style.display = padsVisible ? '' : 'none';
    PADS.forEach((padNum)=>{
      const t = MP.PAD_TO_TYPE[padNum];
      const btn = document.createElement('button');
      btn.className = 'mp-pad__btn';
      btn.innerHTML = `<span class="lbl">${t.replace('-',' ')}</span><span class="sub">Pad ${padNum}</span>`;
      btn.addEventListener('pointerdown', (e)=>{ e.preventDefault(); MP.midi.triggerPad(t,118); }, {passive:false});
      padsRow.appendChild(btn);
    });
    btnPads.textContent = `Pads: ${padsVisible?'On':'Off'}`;
  }

  // ---------- compact control panel ----------
  const SECTIONS = [
    { id:'sound',  label:'Sound'  },
    { id:'brush',  label:'Brush'  },
    { id:'colour', label:'Colour' },
    { id:'flow',   label:'Flow'   },
    { id:'fx',     label:'FX'     },
    { id:'layers', label:'Layers' },
    { id:'cap',    label:'Capture'},
  ];
  function mkTab(s){ const b=document.createElement('button'); b.className='mp-ctrls__tab'; b.textContent=s.label; b.dataset.id=s.id; return b; }
  function mkSec(s){ const d=document.createElement('div'); d.className='mp-ctrls__section'; d.id=`mpsec_${s.id}`; return d; }
  function activate(id){
    tabsEl.querySelectorAll('.mp-ctrls__tab').forEach(t=>t.classList.toggle('active', t.dataset.id===id));
    secsEl.querySelectorAll('.mp-ctrls__section').forEach(s=>s.classList.toggle('active', s.id===`mpsec_${id}`));
  }
  function proxyRange(label, srcId, min, max, step){
    const src = document.getElementById(srcId);
    const wrap = document.createElement('div'); wrap.className='rangeRow';
    const lab = document.createElement('label'); lab.className='muted'; lab.textContent=label;
    const input=document.createElement('input'); input.type='range'; input.min=min; input.max=max; input.step=step; input.value=src?.value ?? 0;
    const out=document.createElement('output'); out.className='value'; out.textContent=input.value;
    input.addEventListener('input', ()=>{ out.textContent=input.value; if(src){ src.value=input.value; src.dispatchEvent(new Event('input', {bubbles:true})); } });
    wrap.append(lab,input,out); return wrap;
  }
  function proxySelect(label, srcId, opts){
    const wrap=document.createElement('div'); wrap.className='row split';
    const lab=document.createElement('label'); lab.className='muted'; lab.textContent=label;
    const sel=document.createElement('select');

    const desktopSel = document.getElementById(srcId);
    if (opts && opts.length){
      sel.innerHTML = opts.map(o=>`<option value="${o}">${o}</option>`).join('');
    } else if (desktopSel && desktopSel.options && desktopSel.options.length){
      for (const o of desktopSel.options){
        const opt = document.createElement('option');
        opt.value = o.value; opt.textContent = o.textContent;
        sel.appendChild(opt);
      }
    } else {
      sel.innerHTML = '<option value="">—</option>';
    }

    if (desktopSel) sel.value = desktopSel.value;

    sel.addEventListener('change', ()=>{
      if (srcId==='synthPresetSel') MP.audio.setSynthPreset(sel.value);
      if (srcId==='drumKitSel')     MP.drums.setKit(sel.value);
      if (desktopSel){
        desktopSel.value = sel.value;
        desktopSel.dispatchEvent(new Event('change',{bubbles:true}));
      }
    });

    if (desktopSel){
      desktopSel.addEventListener('change', ()=>{ sel.value = desktopSel.value; }, {passive:true});
    }

    wrap.append(lab, sel); return wrap;
  }
  function proxyButton(label, onClick){
    const b=document.createElement('button'); b.className='mp-pad__btn'; b.textContent=label; b.addEventListener('click', onClick); return b;
  }
  function buildCtrls(){
    tabsEl.innerHTML=''; secsEl.innerHTML='';
    SECTIONS.forEach(s=>{ tabsEl.appendChild(mkTab(s)); secsEl.appendChild(mkSec(s)); });
    tabsEl.addEventListener('click',(e)=>{ const id=e.target?.dataset?.id; if(id) activate(id); });

    // Sound
    const ss = document.getElementById('mpsec_sound');
    const synthOpts = MP.audio.getSynthPresets ? MP.audio.getSynthPresets() : ['Classic','Soft','Square','Tri','Pluck'];
    const kitOpts   = MP.drums.getKits ? MP.drums.getKits() : ['Clean','808','LoFi','Bright'];
    ss.append(
      proxySelect('Piano Synth','synthPresetSel', synthOpts),
      proxySelect('Drum Kit','drumKitSel', kitOpts)
    );

    ss.append(
  proxyButton('Mic: Toggle', () => document.getElementById('btnMicToggle')?.click()),
  proxyRange('Mic Threshold (Quiet↔Loud)', 'micSense', 0, 1, 0.01)
);

    // Brush
    const sb = document.getElementById('mpsec_brush');
    sb.append(
      proxySelect('Type','brushType', []),
      proxyRange('Scale',   'brushScale', 0.2, 5,   0.1),
      proxyRange('Opacity', 'opacity',    0.05,1,   0.05),
      proxyRange('Scatter', 'scatter',    0,   60,  1),
      proxyButton('Eraser: Toggle', ()=> MP.engine.toggleEraser())
    );

    // Colour
    const sc = document.getElementById('mpsec_colour');
    const colorPickSrc = document.getElementById('colorPick');
    const pickRow = document.createElement('div'); pickRow.className='row split';
    const pickLab = document.createElement('label'); pickLab.className='muted'; pickLab.textContent='Pick';
    const pickInp = document.createElement('input'); pickInp.type='color'; pickInp.value = colorPickSrc?.value || '#7c3aed';
    pickInp.addEventListener('input', ()=>{ if(colorPickSrc){ colorPickSrc.value = pickInp.value; colorPickSrc.dispatchEvent(new Event('input',{bubbles:true})); } });
    pickRow.append(pickLab, pickInp);
    sc.append(
      proxySelect('Mode','colorMode', []),
      pickRow,
      proxyRange('Hue Offset','hueOffset', -180,180, 1),
      proxyRange('Saturation','sat',       0,   100, 1),
      proxyRange('Lightness', 'light',     0,   100, 1)
    );

    // Flow
    const sf = document.getElementById('mpsec_flow');
    sf.append(
      proxySelect('Mode','flowMode', []),
      proxyRange('Smoothness',    'flowSmooth', 0, 1, 0.05),
      proxyRange('Consonance Bias','consBias',  0, 1, 0.05),
      proxyButton('Reset Melodic Memory', ()=> document.getElementById('btnResetMem')?.click())
    );

    // FX
    const sfx = document.getElementById('mpsec_fx');
    sfx.append(
      proxyRange('Symmetry',     'symmetry',   1, 8, 1),
      proxyRange('Center Gravity','gravity',   0, 1, 0.01),
      proxyRange('Idle Fade',    'silenceFade',0, 0.05, 0.002)
    );

    // Layers
    const sl = document.getElementById('mpsec_layers');
    sl.append(
      proxyRange('Layer Opacity','layerOpacity', 0.05, 1, 0.05),
      proxySelect('Blend','blend', []),
      proxyRange('Trail Fade','trail', 0, 0.2, 0.005),
      proxyButton('Clear Layer', ()=> document.getElementById('btnClearLayer')?.click()),
      proxyButton('Save PNG',   ()=> document.getElementById('btnSavePNG')?.click())
    );

    // Capture
    const scp = document.getElementById('mpsec_cap');
    scp.append(
      proxyButton('Record',    ()=> document.getElementById('btnRecord')?.click()),
      proxyButton('Stop',      ()=> document.getElementById('btnStopRec')?.click()),
      proxyButton('Screenshot',()=> document.getElementById('btnScreenshot')?.click())
    );

    activate('sound');
  }

  // ---------- wire ----------
  document.addEventListener('visibilitychange', updateTop, {passive:true});
  window.addEventListener('resize', ()=>{ updateTop(); applyPadSpace(); requestCanvasResize(); });

  const topInit = ()=>{ updateTop(); applyPadSpace(); requestCanvasResize(); };

  toggle.addEventListener('click', ()=> showPad(true));
  btnClose.addEventListener('click', ()=> showPad(false));

  // Important: controls toggle does NOT request canvas resize (prevents clear)
  btnCtrls.addEventListener('pointerdown', (e)=>{
  e.preventDefault(); // kills double-tap zoom on iOS/Android
  ctrlsWrap.classList.toggle('hidden');
  btnCtrls.textContent = ctrlsWrap.classList.contains('hidden') ? '▸ Controls' : '▾ Controls';
  // No resizes here — pad space stays fixed so canvas doesn’t jump.
}, { passive:false });

  btnPads.addEventListener('click', ()=>{ padsVisible = !padsVisible; buildPads(); /* no resize needed */ });
  btnOctDown.addEventListener('click', ()=>{ octave = Math.max(1, octave-1); buildPiano(); });
  btnOctUp.addEventListener('click',   ()=>{ octave = Math.min(7, octave+1); buildPiano(); });

  // ---------- initial render ----------
  buildCtrls();
  buildPiano();
  buildPads();
  setOctLbl();

  // open pad by default and size things
  showPad(true);
  requestAnimationFrame(topInit);
})(window.MP);
