(function(MP){
  const el = MP.el;
  const audioStatus = el('audioStatus');
  const midiStatus  = el('midiStatus');
  const fpsEl       = el('fps');
  const btnStartAudio = el('btnStartAudio');
  const btnConnectMIDI = el('btnConnectMIDI');
  const btnEraser = el('btnEraser');
  const btnMicTop = el('btnMicTop');
  const tabsEl = el('tabs'); const dockEl = el('dock');

  const stageWrap = MP.el('stageWrap');

  // --- topbar height -> CSS var so mobile can size canvas around pad/topbar
  const topbar = document.querySelector('.topbar');
  function updateTopVar(){
    const th = topbar?.getBoundingClientRect().height || 0;
    document.documentElement.style.setProperty('--topH', `${th}px`);
  }
  updateTopVar();
  window.addEventListener('resize', updateTopVar);

  // Hide Connect MIDI on mobile at runtime (in case CSS misses some engines)
  if (MP.isMobile && btnConnectMIDI) btnConnectMIDI.style.display = 'none';

  function updateDockPadding(){
    const h = dockEl?.getBoundingClientRect().height || 0;
    document.documentElement.style.setProperty('--dockh', MP.isMobile ? '0px' : `${h}px`);
  }
  updateDockPadding();
  window.addEventListener('resize', updateDockPadding);

  // sections
  const ids = ['secBrush','secColour','secFlow','secFX','secLayers','secNotes','secCapture'];
  function activateSection(id,btn){
    document.querySelectorAll('.sections .section').forEach(s=>s.classList.remove('active'));
    tabsEl.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
    const sec=document.getElementById(id); if(sec) sec.classList.add('active');
    if (btn) btn.classList.add('active');
    updateDockPadding();
  }
  ids.forEach((id,i)=>{ const b=document.createElement('button'); b.className='tab'; b.textContent=id.replace('sec',''); b.addEventListener('click',()=>activateSection(id,b)); tabsEl.appendChild(b); if(i===0) activateSection(id,b); });
  const spacer=document.createElement('div'); spacer.className='spacer'; tabsEl.appendChild(spacer);
  const btnToggleDock=document.createElement('button'); btnToggleDock.className='tiny'; btnToggleDock.textContent='▾ Collapse';
  btnToggleDock.addEventListener('click',()=>{ dockEl.classList.toggle('collapsed'); btnToggleDock.textContent=dockEl.classList.contains('collapsed')?'▴ Expand':'▾ Collapse'; });
  tabsEl.appendChild(btnToggleDock);

  // --- desktop "Sound" section (adds synth/drums + mic controls) ---
  (function(){
    const sectionsWrap = document.querySelector('.sections');
    const sec = document.createElement('div');
    sec.className = 'section'; sec.id = 'secSound';
    sec.innerHTML = `
      <h2>Sound <span class="hint">Instruments</span></h2>
      <div class="row split">
        <label class="muted">Piano Synth</label>
        <select id="synthPresetSel"></select>
      </div>
      <div class="row split">
        <label class="muted">Drum Kit</label>
        <select id="drumKitSel"></select>
      </div>
    `;
    sectionsWrap.insertBefore(sec, sectionsWrap.firstChild);

    const b=document.createElement('button'); b.className='tab'; b.textContent='Sound';
    b.addEventListener('click',()=>activateSection('secSound', b));
    tabsEl.insertBefore(b, tabsEl.firstChild);

    const synthSel = sec.querySelector('#synthPresetSel');
    const kitSel   = sec.querySelector('#drumKitSel');
    (MP.audio.getSynthPresets?.() || ['Classic','Soft','Square','Tri','Pluck']).forEach(n=>{
      const o=document.createElement('option'); o.value=n; o.textContent=n; synthSel.appendChild(o);
    });
    (MP.drums.getKits?.() || ['Clean','808','LoFi','Bright']).forEach(n=>{
      const o=document.createElement('option'); o.value=n; o.textContent=n; kitSel.appendChild(o);
    });

    synthSel.addEventListener('change', ()=>MP.audio.setSynthPreset(synthSel.value));
    kitSel.addEventListener('change',   ()=>MP.drums.setKit(kitSel.value));

    // --- Mic controls (desktop panel) ---
    const micRow = document.createElement('div');
    micRow.className = 'row';
    micRow.innerHTML = `
      <button id="btnMicToggle">Mic: Off</button>
      <label class="muted" style="margin-left:8px">Mic Sensitivity</label>
      <input type="range" id="micSense" min="0" max="1" step="0.01" value="0.50" style="width:180px">
      <label class="muted" style="margin-left:8px">Drum Accents</label>
      <input type="checkbox" id="micDrums">
      <label class="muted" style="margin-left:8px">Monitor</label>
      <input type="checkbox" id="micMon">
    `;
    sec.appendChild(micRow);

    const micBtn   = sec.querySelector('#btnMicToggle');
    const micSense = sec.querySelector('#micSense');
    const micMon   = sec.querySelector('#micMon');
    const micDrums = sec.querySelector('#micDrums');

    const micStatus = MP.el('micStatus');
    const setMicIndicator = (on)=>{
      if (!micStatus) return;
      micStatus.textContent = 'Mic: ' + (on ? 'on' : 'off');
      micStatus.classList.toggle('on',  !!on);
      micStatus.classList.toggle('off', !on);
    };
    const mapMicThreshold = v => 0.005 + v * (0.08 - 0.005); // left=quiet (more sensitive), right=loud

    async function doMicToggle(btn){
      try { await MP.audio.unlock(); } catch {}
      if (!btn) return;
      btn.disabled = true;
      btn.textContent = 'Mic: Starting…';
      const on = await MP.mic.toggle();
      btn.textContent = on ? 'Mic: On' : 'Mic: Off';
      btn.disabled = false;
      setMicIndicator(on);
      MP.ui?.setAudioState?.(MP.audio.ctx?.state || 'running');
      // reflect to the other mic button if present
      if (btn === micBtn && btnMicTop){ btnMicTop.textContent = btn.textContent; }
      if (btn === btnMicTop && micBtn){ micBtn.textContent = btn.textContent; }
    }

    micBtn.addEventListener('click', ()=>doMicToggle(micBtn));
    MP.mic.setSensitivity(mapMicThreshold(parseFloat(micSense.value)));
    micSense.addEventListener('input', () => {
      MP.mic.setSensitivity(mapMicThreshold(parseFloat(micSense.value)));
    });
    micMon.addEventListener('change', ()=> MP.mic.setMonitor(!!micMon.checked));
    micDrums.addEventListener('change', ()=> MP.mic.setDrums(!!micDrums.checked));

    // Hook up topbar mic button too
    if (btnMicTop){
      btnMicTop.addEventListener('click', ()=>doMicToggle(btnMicTop));
    }
  })();

  // controls
  const brushTypeSel = el('brushType');
  const brushScale   = el('brushScale'); const brushScaleVal = el('brushScaleVal');
  const opacityRange = el('opacity');    const opacityVal    = el('opacityVal');
  const scatterRange = el('scatter');    const scatterVal    = el('scatterVal');
  const colorModeSel = el('colorMode');  const colorPick     = el('colorPick');
  const hueOffset    = el('hueOffset');  const hueOffsetVal  = el('hueOffsetVal');
  const satRange     = el('sat');        const satVal        = el('satVal');
  const lightRange   = el('light');      const lightVal      = el('lightVal');
  const paletteSel   = el('palette');

  const flowModeSel  = el('flowMode');   const flowSmooth    = el('flowSmooth'); const flowSmoothVal=el('flowSmoothVal');
  const consBias     = el('consBias');   const consBiasVal   = el('consBiasVal');
  const btnResetMem  = el('btnResetMem');
  const flowPop      = el('flowPop');
  const btnFlowHelp  = el('btnFlowHelp');

  const symmetry     = el('symmetry');   const gravity       = el('gravity');
  const symmetryVal  = el('symmetryVal'); const gravityVal   = el('gravityVal');
  const silenceFade  = el('silenceFade'); const silenceFadeVal=el('silenceFadeVal');

  const noteList     = el('noteList');

  const layerSelect  = el('layerSelect');
  const layerOpacity = el('layerOpacity'); const layerOpacityVal=el('layerOpacityVal');
  const blendSel     = el('blend');
  const trailRange   = el('trail'); const trailVal = el('trailVal');

  // live labels
  function bindRange(range, out, fmt=(v)=>v){ const update=()=>out.textContent=fmt(range.value); range.addEventListener('input',update); update(); }
  bindRange(brushScale, brushScaleVal, v=>Number(v).toFixed(1));
  bindRange(opacityRange, opacityVal, v=>Number(v).toFixed(2));
  bindRange(scatterRange, scatterVal, v=>String(Math.round(Number(v))));
  bindRange(hueOffset, hueOffsetVal, v=>String(Math.round(Number(v))));
  bindRange(satRange, satVal, v=>String(Math.round(Number(v))));
  bindRange(lightRange, lightVal, v=>String(Math.round(Number(v))));
  bindRange(flowSmooth, flowSmoothVal, v=>Number(v).toFixed(2));
  bindRange(consBias, consBiasVal, v=>Number(v).toFixed(2));
  bindRange(symmetry, symmetryVal, v=>String(Math.round(Number(v))));
  bindRange(gravity, gravityVal, v=>Number(v).toFixed(2));
  bindRange(silenceFade, silenceFadeVal, v=>Number(v).toFixed(3));
  bindRange(trailRange, trailVal, v=>Number(v).toFixed(3));

  // freeze old art when fade settings change
  let lastTrail=parseFloat(trailRange.value), lastSilence=parseFloat(silenceFade.value);
  trailRange.addEventListener('input',()=>{ const v=parseFloat(trailRange.value); if(v!==lastTrail){ MP.draw.freezeArtwork(); lastTrail=v; }});
  silenceFade.addEventListener('input',()=>{ const v=parseFloat(silenceFade.value); if(v!==lastSilence){ MP.draw.freezeArtwork(); lastSilence=v; }});

  // --- notes list ---
  function refreshNoteList(){
    noteList.innerHTML='';
    const s=MP.state;
    if (!s || !s.activeNotes || s.activeNotes.size===0){
      noteList.innerHTML='<div class="item"><span class="muted">No active notes</span><span class="pill">—</span></div>';
      return;
    }
    s.activeNotes.forEach((n, note)=>{
      const div=document.createElement('div');
      const held=s.held && s.held.has(note) ? 1 : 0;
      div.innerHTML=`<span>${MP.midiNoteName(note)}</span><span class="pill">vel ${n.velocity} • held ${held}${n.sustained?' • sus':''}</span>`;
      noteList.appendChild(div);
    });
  }

  // public getters used by draw
  MP.ui = {
    setFps: n => fpsEl.textContent = `${n} fps`,
    setAudioState: s => audioStatus.textContent = `Audio: ${s}`,
    colorMode:()=>colorModeSel.value,
    colorPick:()=>colorPick.value,
    hueOffset:()=>parseFloat(hueOffset.value),
    sat:()=>parseInt(satRange.value,10),
    light:()=>parseInt(lightRange.value,10),
    paletteMono:()=> paletteSel.value==='mono',
    flowMode:()=>flowModeSel.value,
    flowSmooth:()=>parseFloat(flowSmooth.value),
    consBias:()=>parseFloat(consBias.value),
    symmetry:()=>parseInt(symmetry.value,10),
    gravity:()=>parseFloat(gravity.value),
    silenceFade:()=>parseFloat(silenceFade.value),
    trail:()=>parseFloat(trailRange.value),
    brushType:()=>brushTypeSel.value,
    brushScale:()=>parseFloat(brushScale.value),
    opacity:()=>parseFloat(opacityRange.value),
    scatter:()=>parseFloat(scatterRange.value),
    setOpacity(v){ opacityRange.value=String(v.toFixed(2)); opacityVal.textContent=opacityRange.value; },
    reflectScatterExtra(extra){ scatterVal.textContent = String(Math.round(scatterRange.valueAsNumber + extra)); },
    layerOpacity: i => MP.draw.layers[i]?.opacity ?? 1,
    layerBlend: i => MP.draw.layers[i]?.blend ?? 'source-over',
    setFlowPhase(rad){ _flowPhase = rad; },
    flowPhase:()=> _flowPhase,
    isErasing:()=> _erasing,
    setEraser(on){ _erasing = !!on; btnEraser.textContent='Eraser: ' + (_erasing?'On':'Off'); },
    refreshNoteList,
    updateLayerSelect(layers,active){ layerSelect.innerHTML=''; layers.forEach((_,i)=>{ const o=document.createElement('option'); o.value=String(i); o.textContent=`Layer ${i+1}`; layerSelect.appendChild(o); }); layerSelect.value=String(active); },
    onSelectLayer(layers,active){ layerSelect.value=String(active); layerOpacity.value=String(layers[active].opacity); layerOpacityVal.textContent=Number(layerOpacity.value).toFixed(2); blendSel.value=layers[active].blend; }
  };
  let _erasing=false, _flowPhase=0;

  // ---- AUDIO START / UNLOCK ----
  async function tryUnlock(){
    const st = await MP.audio.unlock();
    MP.ui.setAudioState(st);
    return st;
  }
  btnStartAudio.addEventListener('click', async ()=>{
    const st = await tryUnlock();
    if (st !== 'running') alert('Could not start audio. Click anywhere on the canvas then press Start Audio again.');
  });
  let unlocked=false;
  const oneShot = async ()=>{
    if (unlocked) return;
    const st = await tryUnlock();
    if (st === 'running'){ unlocked=true; window.removeEventListener('pointerdown', oneShot); window.removeEventListener('keydown', oneShot); }
  };
  window.addEventListener('pointerdown', oneShot, { passive:true });
  window.addEventListener('keydown', oneShot);

  // MIDI / Eraser
  btnConnectMIDI?.addEventListener('click', MP.midi.connect);
  btnEraser.addEventListener('click', ()=>MP.engine.toggleEraser());

  // layers ui
  el('btnAddLayer').addEventListener('click', MP.draw.createLayer);
  el('btnDeleteLayer').addEventListener('click', MP.draw.deleteLayer);
  el('btnClearLayer').addEventListener('click', MP.draw.clearLayer);
  layerSelect.addEventListener('change', ()=>MP.draw.selectLayer(parseInt(layerSelect.value,10)));
  layerOpacity.addEventListener('input', ()=>{ MP.draw.layerSetOpacity(parseInt(layerSelect.value,10), parseFloat(layerOpacity.value)); layerOpacityVal.textContent=Number(layerOpacity.value).toFixed(2); });
  blendSel.addEventListener('change', ()=>MP.draw.layerSetBlend(parseInt(layerSelect.value,10), blendSel.value));
  el('btnSavePNG').addEventListener('click', ()=>{
    const tmp=document.createElement('canvas'); const w=MP.draw.layers[0].canvas.width,h=MP.draw.layers[0].canvas.height; tmp.width=w; tmp.height=h;
    const tctx=tmp.getContext('2d'); MP.draw.compositeTo(tctx);
    const a=document.createElement('a'); a.download='music-painter.png'; a.href=tmp.toDataURL('image/png'); a.click();
  });

  // palettes
  function paletteDefaults(){ colorPick.value='#7c3aed'; colorModeSel.value='auto'; hueOffset.value='0'; satRange.value='85'; lightRange.value='60'; }
  paletteSel.addEventListener('change', ()=>{
    const p=paletteSel.value;
    if (p==='ocean'){ colorPick.value='#1de2ff'; satRange.value='90'; lightRange.value='60'; colorModeSel.value='offset'; hueOffset.value='-40'; brushTypeSel.value='line'; }
    else if (p==='sunset'){ colorPick.value='#ff7a18'; satRange.value='95'; lightRange.value='58'; colorModeSel.value='offset'; hueOffset.value='20'; brushTypeSel.value='line'; }
    else if (p==='neon'){ colorPick.value='#00fff0'; satRange.value='100'; lightRange.value='65'; colorModeSel.value='vel'; brushTypeSel.value='glow'; }
    else if (p==='mono'){ colorPick.value='#9ca3af'; satRange.value='0'; lightRange.value='60'; colorModeSel.value='fixed'; brushTypeSel.value='line'; }
    else { paletteDefaults(); }
    satVal.textContent=satRange.value; lightVal.textContent=lightRange.value; hueOffsetVal.textContent=hueOffset.value;
  });

  // flow help (single declaration + wiring)
  btnFlowHelp.addEventListener('click', (e)=>{
    e.stopPropagation();
    flowPop.innerHTML = `<div style='margin-bottom:6px'><strong>Flow modes</strong></div>
    <div><b>Balanced</b>: mix of melodic path + harmonic pull.</div>
    <div><b>Harmonic</b>: follows chord shapes; consonant intervals steer straighter.</div>
    <div><b>Melodic Memory</b>: continues the direction of your phrase.</div>
    <hr style='border-color:#263142'>
    <div><b>Smoothness</b>: higher = longer arcs.</div>
    <div><b>Consonance Bias</b>: higher = less jitter when notes fit together.</div>`;
    flowPop.style.display = flowPop.style.display==='block' ? 'none' : 'block';
  });
  document.addEventListener('click',(e)=>{ if (flowPop.style.display==='block' && !flowPop.contains(e.target) && e.target!==btnFlowHelp) flowPop.style.display='none'; });

  // --- KEYS POPOVER ---
  const keysBtn = el('btnKeys');
  const keysPop = el('keysPop');

  function renderKeysPop(){
    const KB_ROWS=[
      ['1','2','3','4','5','6','7','8','9','0'],
      ['Q','W','E','R','T','Y','U','I','O','P'],
      ['A','S','D','F','G','H','J','K','L'],
      ['Z','X','C','V','B','N','M']
    ];
    const html = KB_ROWS.map(row=>{
      return `<div class="kb-row">` + row.map(k=>{
        const kl=k.toLowerCase();
        const n=MP.KEY_LAYOUT[kl];
        const pad=MP.KEY_DRUMS_NOTE[k];
        const mapped=(n!==undefined)||(pad!==undefined);
        const title= pad!==undefined? `${k} → Pad ${pad}` : (n!==undefined ? `${MP.midiNoteName(n)}` : `${k} (not mapped)`);
        const line2= pad!==undefined? `<span class="note">Pad ${pad}</span>` : (n!==undefined? `<span class="note">${MP.midiNoteName(n)}</span>` :'');
        return `<div class="keycap${mapped?' mapped':''}" title="${title}"><span class="label">${k}</span>${line2}</div>`;
      }).join('') + `</div>`;
    }).join('');
    keysPop.innerHTML = `<div style="margin-bottom:6px"><strong>Computer keyboard</strong></div>
      <div class="keys-grid">${html}</div>
      <div class="muted" style="margin-top:6px">Shortcuts:
        <span class="kbd">Shift</span> hold eraser •
        <span class="kbd">N</span> new layer •
        <span class="kbd">C</span> clear layer
      </div>`;
  }

  if (keysBtn && keysPop){
    keysBtn.addEventListener('click',(e)=>{
      e.stopPropagation();
      if (keysPop.style.display==='block'){ keysPop.style.display='none'; return; }
      renderKeysPop();

      const rect = keysBtn.getBoundingClientRect();
      keysPop.style.position = 'fixed';
      keysPop.style.left = Math.round(rect.left) + 'px';
      keysPop.style.top  = Math.round(rect.bottom + 6) + 'px';
      keysPop.style.zIndex = '10070';
      keysPop.style.display = 'block';
    });

    document.addEventListener('click',(e)=>{
      if (!keysPop.contains(e.target) && e.target!==keysBtn){
        keysPop.style.display='none';
      }
    });
  }

  // keyboard (desktop)
  const downKeys = new Set();
  window.addEventListener('keydown',(e)=>{
    const raw=e.key; const k=raw.length===1? raw.toLowerCase() : raw;
    if (raw==='Shift'){ _erasing=true; btnEraser.textContent='Eraser: On'; e.preventDefault(); return; }
    if (k==='n'){ MP.draw.createLayer(); e.preventDefault(); return; }
    if (k==='c'){ MP.draw.clearLayer(); e.preventDefault(); return; }
    const drum = MP.KEY_DRUMS_NOTE[k]; if (drum!==undefined && !downKeys.has(k)){ downKeys.add(k); MP.midi.triggerPad(MP.PAD_TO_TYPE[drum],115); return; }
    const note = MP.KEY_LAYOUT[k]; if (note!==undefined && !downKeys.has(k)){ downKeys.add(k); MP.engine.noteOn(note,110); }
  });
  window.addEventListener('keyup',(e)=>{
    const raw=e.key; const k=raw.length===1? raw.toLowerCase() : raw;
    if (raw==='Shift'){ _erasing=false; btnEraser.textContent='Eraser: Off'; return; }
    const drum = MP.KEY_DRUMS_NOTE[k]; if (drum!==undefined){ downKeys.delete(k); return; }
    const note = MP.KEY_LAYOUT[k]; if (note!==undefined){ downKeys.delete(k); MP.engine.noteOff(note); }
  });
  el('stageWrap').addEventListener('pointerdown', ()=>{ tryUnlock(); }, { passive:true });
})(window.MP);
