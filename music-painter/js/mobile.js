// Mobile mini keyboard + drum pad (robust)
(function(MP){
  const isMobile = (MP && MP.isMobile) || ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  if (!isMobile) return;

  // Make sure the CSS hook exists
  document.documentElement.classList.add('mobile');

  // Inject styles; toggle floats above the dock (uses --dockh from ui.js)
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
  .mp-pad__grid{ display:grid; grid-template-columns:repeat(8,1fr); gap:8px; padding:8px }
  .mp-pad__btn{
    user-select:none; -webkit-user-select:none; touch-action:none;
    padding:14px 8px; border:1px solid #263142; border-radius:12px; background:#0f172a; text-align:center; color:#e8f0ff
  }
  .mp-pad__btn .lbl{ font-weight:700 }
  .mp-pad__btn .sub{ display:block; color:#9fb3d1; font-size:11px; margin-top:2px }
  `;
  const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);

  // Elements
  const toggle = document.createElement('button'); toggle.className='mp-pad__toggle'; toggle.textContent='Pad'; document.body.appendChild(toggle);
  const pad = document.createElement('div'); pad.className='mp-pad';
  pad.innerHTML = `
    <div class="mp-pad__bar">
      <button id="mpPadLayout" class="mp-pad__btn" style="padding:6px 10px">Piano 8</button>
      <div class="sp"></div>
      <button id="mpPadClose" class="mp-pad__btn" style="padding:6px 10px">▾</button>
    </div>
    <div id="mpPadGrid" class="mp-pad__grid"></div>`;
  document.body.appendChild(pad);

  const btnLayout = pad.querySelector('#mpPadLayout');
  const btnClose  = pad.querySelector('#mpPadClose');
  const grid      = pad.querySelector('#mpPadGrid');

  // Data
  const PIANO = [60,62,64,65,67,69,71,72];        // C4→C5
  const PADS  = [40,41,42,43,36,37,38,39];        // your pad mapping
  let layout  = 'piano';

  // Helpers
  function bindButton(b, on, off){
    const start = e => { e.preventDefault(); on(); };
    const end   = e => { e.preventDefault(); off(); };
    b.addEventListener('pointerdown', start, {passive:false});
    b.addEventListener('pointerup', end, {passive:false});
    b.addEventListener('pointerleave', end, {passive:false});
    b.addEventListener('pointercancel', end, {passive:false});
  }

  function build(){
    grid.innerHTML = '';
    if (layout === 'piano'){
      PIANO.forEach(n=>{
        const btn = document.createElement('button'); btn.className='mp-pad__btn';
        btn.innerHTML = `<span class="lbl">${MP.midiNoteName(n)}</span><span class="sub">${n}</span>`;
        bindButton(btn, ()=>MP.engine.noteOn(n,110), ()=>MP.engine.noteOff(n));
        grid.appendChild(btn);
      });
      btnLayout.textContent = 'Drums 8';
    } else {
      PADS.forEach(n=>{
        const t = MP.PAD_TO_TYPE[n];
        const btn = document.createElement('button'); btn.className='mp-pad__btn';
        btn.innerHTML = `<span class="lbl">${t.replace('-',' ')}</span><span class="sub">Pad ${n}</span>`;
        bindButton(btn, ()=>MP.midi.triggerPad(t,118), ()=>{});
        grid.appendChild(btn);
      });
      btnLayout.textContent = 'Piano 8';
    }
  }

  // Show/hide
  toggle.addEventListener('click', ()=> pad.classList.add('show'));
  btnClose.addEventListener('click', ()=> pad.classList.remove('show'));
  btnLayout.addEventListener('click', ()=>{ layout = (layout==='piano') ? 'drums' : 'piano'; build(); });

  // Initial
  build();

  // In case the dock height changes, keep the toggle above it
  const ro = new ResizeObserver(()=> {
    const h = (document.querySelector('.dock')?.getBoundingClientRect().height)||0;
    document.documentElement.style.setProperty('--dockh', `${h}px`);
  });
  const dock = document.querySelector('.dock'); if (dock) ro.observe(dock);
})(window.MP);
