import {SynthEngine} from './synth.js';
import {MidiManager} from './midi.js';
import {PRESETS} from './presets.js';
import {MapState, PARAM_RANGES, DRUM_CHOICES, midiName} from './mapping.js';

const $ = (s)=>document.querySelector(s);
const $$ = (s)=>Array.from(document.querySelectorAll(s));
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const fmtMs=v=>`${Math.round(v)}ms`, fmtHz=v=>v>=1000?(v/1000).toFixed(1)+'k':Math.round(v);

// ---- UX helpers ----
function say(msg, tone=''){
  const st=$('#status'); if(!st) return; st.className='status '+(tone||''); st.innerHTML=msg;
}

// Build keys (25) and pads
function buildKeyboard(state){ const kb=$('#kb'); kb.innerHTML=''; const W=[0,2,4,5,7,9,11], B={1:1,3:1,6:1,8:1,10:1}; for(let i=0;i<25;i++){ const n=state.base+i, s=n%12; if(W.includes(s)){ const w=document.createElement('div'); w.className='white'; w.dataset.midi=n; kb.appendChild(w); const next=(s+1)%12; if(B[next]){ const b=document.createElement('div'); b.className='black'; b.dataset.midi=n+1; w.appendChild(b)} } } }
function flashKey(state,m,on){ if(m<state.base-1||m>=state.base+32) return; const el=$(`#kb [data-midi="${m}"]`); if(!el) return; el.classList.toggle('active',!!on) }

function buildPads(){ const root=$('#pads'); root.innerHTML=''; for(let i=0;i<8;i++){ const d=document.createElement('div'); d.className='pad'; d.innerHTML=`<small>Pad ${i+1}</small><button class="mapBtn" title="Map this pad">●</button>`; d.onmousedown=async(e)=>{ if(e.target.classList.contains('mapBtn')) return; await Eng.start(); Eng.setPreset('drum'); Eng.noteOn(MapState.padNotes[i],0.9); d.classList.add('active'); setTimeout(()=>d.classList.remove('active'),120) }; d.querySelector('.mapBtn').onclick=(e)=>{ e.stopPropagation(); startPadLearn(i, d.querySelector('.mapBtn')) }; root.appendChild(d) } }

// Inline mapping buttons for each control
function injectInlineMap(){ const params = MapState.ccParams(); for(const p of params){ const el=$('#'+p); if(!el) continue; const row=el.closest('.control'); if(!row) continue; const b=document.createElement('button'); b.className='miniMap'; b.title='Map this control (Learn)'; b.textContent='●'; b.onclick=()=>startCCLearn(p,b); row.appendChild(b) } updateInlineBadges(); }

function updateInlineBadges(){
  // params
  for(const p of MapState.ccParams()){
    const el=$('#'+p); if(!el) continue; const row=el.closest('.control'); if(!row) continue; const b=row.querySelector('.miniMap'); if(!b) continue;
    const cc = MapState.ccMap[p]; const mode = (cc!=null && MapState.ccMode[cc])?MapState.ccMode[cc]:null;
    b.textContent = cc!=null? `●CC${cc}` : '●';
    b.title = cc!=null? `Mapped to CC${cc}${mode?` (${mode})`:''}. Click to re-map or press Esc to cancel.` : 'Map this control (Learn)';
  }
  // pads
  $$('#pads .pad').forEach((d,i)=>{ const b=d.querySelector('.mapBtn'); const m=MapState.padNotes[i]; if(b){ b.textContent = '●'+m; b.title = `Pad ${i+1} → MIDI ${m} (${midiName(m)}) — click to re-map (Esc to cancel)` }});
}

// Diagnostics grid
function diag(extra={}){ const cells=[ ['Secure',String(window.isSecureContext)], ['Host',location.hostname||'(file)'], ['Protocol',location.protocol], ['Engine', Eng?.mode||'—'], ['AudioState', Eng?.ctx?.state||'—'], ['WebMIDI', ('requestMIDIAccess'in navigator)?'yes':'no'], ['Buttons','yes'], ['LastErr', window.__lastErr||'—'] ]; for(const [k,v] of Object.entries(extra)) cells.push([k,v]); const root=$('#diag'); if(root) root.innerHTML=cells.map(([k,v])=>`<div class=di><b>${k}</b>${v}</div>`).join('') }

window.__lastErr='—'; window.addEventListener('error',e=>{window.__lastErr=e.message; diag()}); window.addEventListener('unhandledrejection',e=>{window.__lastErr=String(e.reason?.message||e.reason||'Promise'); diag()});

// Engine + MIDI + Mapping
const Eng = new SynthEngine();
const MIDI = new MidiManager();
window.Eng = Eng; // for quick inspection

// App State
const state = { base:60, held:new Set(), transpose:0, octave:0, ch:1 };

function eff(m){ return m + state.transpose + state.octave*12 }

// Note handling
function playOn(m,vel=100){ const mv=eff(m); if($('#preset').value==='drum'){ Eng.setPreset('drum',PRESETS.find(p=>p.id==='drum')); Eng.noteOn(mv,vel/127); flashKey(state,mv,true); lcd('PAD',`m${mv} v${vel}`); return } Eng.noteOn(mv,vel/127); state.held.add(mv); flashKey(state,mv,true); lcd('NOTE',`m${mv} v${vel}`) }
function playOff(m){ const mv=eff(m); if(!state.held.has(mv)){flashKey(state,mv,false); return} if(Eng.sustain){flashKey(state,mv,false); return} Eng.noteOff(mv); state.held.delete(mv); flashKey(state,mv,false) }
function allOff(){ Eng.releaseAll(); state.held.clear(); document.querySelectorAll('.white,.black,.pad').forEach(el=>el.classList.remove('active')) }

// LCD helper
function lcd(a,b){ $('#lcd').innerHTML=`<small>ZONE 1 • CH ${state.ch}</small>${a}${b?' — '+b:''}` }

// Sliders → engine + remember normalized param (for relative CCs)
function hookSlider(param,fmt,on){ const el=$('#'+param), lab=$('#'+param+'Val'); const apply=()=>{ const v=+el.value; lab.textContent=fmt(v); // store normalized
    const r=PARAM_RANGES[param]; const x=(v-r.min)/(r.max-r.min); MapState.setParamNorm(param,x); on(v); updateInlineBadges(); }; el.addEventListener('input',apply); apply() }

// Presets
function loadPresets(){ const sel=$('#preset'); if(!sel) return; sel.innerHTML=''; for(const p of PRESETS){ const o=document.createElement('option'); o.value=p.id; o.textContent=p.name; sel.appendChild(o) } sel.value='piano'; applyPreset('piano'); sel.onchange=()=>applyPreset(sel.value) }
function ensurePresets(){ const sel=$('#preset'); if(sel && sel.options.length===0) loadPresets(); }
function applyPreset(id){ const p=PRESETS.find(x=>x.id===id)||PRESETS[0]; Eng.setPreset(p.id,p) }

// Typing
function bindTyping(){ const keyW='asdfghjkl;'.split(''), keyB='wetyuop'.split(''), offW=[0,2,4,5,7,9,11,12,14,16], offB=[1,3,6,8,10,13,15];
  window.addEventListener('keydown', async e=>{ if(e.repeat) return; const k=e.key.toLowerCase(); const iw=keyW.indexOf(k), ib=keyB.indexOf(k); let m=null; if(iw>-1)m=state.base+offW[iw]; else if(ib>-1)m=state.base+offB[ib]; if(m!=null){ await Eng.start(); playOn(m,110) } });
  window.addEventListener('keyup', e=>{ const k=e.key.toLowerCase(); const iw=keyW.indexOf(k), ib=keyB.indexOf(k); let m=null; if(iw>-1)m=state.base+offW[iw]; else if(ib>-1)m=state.base+offB[ib]; if(m!=null) playOff(m) });
}

// Learn state
let ccLearnParam=null; let ccLearnBtn=null; let padLearnIndex=null; let padLearnBtn=null; let learnTimer=null;
function startCCLearn(param,btn){ if(ccLearnParam===param){ endLearns(); say('CC learn cancelled.','warn'); return } ccLearnParam=param; ccLearnBtn?.classList.remove('active'); ccLearnBtn=btn; btn?.classList.add('active'); say(`Twist a knob to map → ${param} (Esc to cancel)`,'warn'); clearTimeout(learnTimer); learnTimer=setTimeout(()=>{ endLearns(); say('CC learn timed out.','warn') },15000); }
function startPadLearn(idx,btn){ if(padLearnIndex===idx){ endLearns(); say('Pad learn cancelled.','warn'); return } padLearnIndex=idx; padLearnBtn?.classList.remove('active'); padLearnBtn=btn; btn?.classList.add('active'); say(`Hit a pad to map → Pad ${idx+1} (Esc to cancel)`,'warn'); clearTimeout(learnTimer); learnTimer=setTimeout(()=>{ endLearns(); say('Pad learn timed out.','warn') },15000); }
function endLearns(){ if(ccLearnBtn) ccLearnBtn.classList.remove('active'); if(padLearnBtn) padLearnBtn.classList.remove('active'); ccLearnParam=null; padLearnIndex=null; clearTimeout(learnTimer); learnTimer=null; updateInlineBadges(); }
window.addEventListener('keydown',e=>{ if(e.key==='Escape') endLearns() });

// MIDI wiring with mapping + relative encoders support
function bindMIDI(){
  MIDI.onNoteOn=(d1,d2)=>{
    if(padLearnIndex!=null){ MapState.padNotes[padLearnIndex]=d1; renderPadTable(); saveAll(); say(`Pad ${padLearnIndex+1} → MIDI ${d1} (${midiName(d1)})`,'ok'); endLearns(); return }
    if($('#preset').value==='drum') Eng.setPreset('drum', PRESETS.find(p=>p.id==='drum'));
    playOn(d1,d2);
  };
  MIDI.onNoteOff=(d1)=>playOff(d1);
  MIDI.onBend=(bend)=>{ const cents=(bend/8192)*Eng.bendRange; Eng.bendTo(cents) };
  MIDI.onChChange=(ch)=>{ state.ch=ch };
  MIDI.onCC=(cc,val)=>{
    if(ccLearnParam){ MapState.setCC(ccLearnParam, cc); renderCCTable(); saveAll(); say(`Mapped CC${cc} → ${ccLearnParam}`,'ok'); endLearns(); return }

    // Detect rel/abs once
    MapState.markCCMode(cc,val);

    // Special pedals
    if(cc===64){ Eng.setSustain(val>=64); lcd('Sustain',val>=64?'On':'Off'); return }
    if(cc===1){ // mod wheel works even if unmapped
      if(!MapState.paramByCC(1) && !MapState.paramByCC(cc)) Eng.setModDepth(val/127);
    }

    const target = MapState.paramByCC(cc);
    if(!target){ return }

    const mode = MapState.ccMode[cc]||'absolute';
    if(mode==='absolute'){
      const x = val/127;
      setParamByNorm(target, x);
    } else {
      // relative (two's complement around 64) → accumulate into stored normalized value
      const delta = MapState.relDelta(val)/64; // -1..+1 step ≈ ±0.0156
      const prev = MapState.getParamNorm(target);
      const next = clamp(prev + delta, 0, 1);
      setParamByNorm(target, next);
    }
  };
}

function setParamByNorm(param, x){
  MapState.setParamNorm(param, x);
  const r = PARAM_RANGES[param];
  const val = r.min + x*(r.max-r.min);
  const el = $('#'+param);
  if(el){ el.value = String(val); el.dispatchEvent(new Event('input')) }
}

// Mapping UI tables (overview)
function renderCCTable(){
  const params = MapState.ccParams();
  const table = $('#ccTable');
  if(!table) return;
  table.innerHTML = `<tr><th>Parameter</th><th>CC#</th><th>Mode</th><th>Learn</th></tr>` +
    params.map(p=>{
      const cc = MapState.ccMap[p] ?? '';
      const mode = cc!=='' && MapState.ccMode[cc] ? MapState.ccMode[cc] : '';
      return `<tr>
        <td>${p}</td>
        <td><input data-cc-param="${p}" class="ccNum" type="number" min="0" max="127" value="${cc}"></td>
        <td>${mode}</td>
        <td><button class="learnCC" data-param="${p}">●</button></td>
      </tr>`
    }).join('');
  table.querySelectorAll('.ccNum').forEach(inp=>{
    inp.onchange=()=>{ MapState.setCC(inp.dataset.ccParam, clamp(parseInt(inp.value,10)||0,0,127)); saveAll(); updateInlineBadges(); };
  });
  table.querySelectorAll('.learnCC').forEach(btn=>{
    btn.onclick=()=>{ startCCLearn(btn.dataset.param, btn); };
  });
}
function renderPadTable(){
  const table=$('#padTable'); if(!table) return;
  table.innerHTML = `<tr><th>Pad</th><th>MIDI Note</th><th>Name</th><th>Learn</th></tr>`+
    MapState.padNotes.map((m,i)=>{
      const opts = DRUM_CHOICES.map(([name,n])=>`<option value="${n}" ${n===m?'selected':''}>${n} — ${name}</option>`).join('');
      return `<tr>
        <td>Pad ${i+1}</td>
        <td><select data-pad-idx="${i}" class="padSel">${opts}</select></td>
        <td>${m} (${midiName(m)})</td>
        <td><button class="learnPad" data-idx="${i}">●</button></td>
      </tr>`
    }).join('');
  table.querySelectorAll('.padSel').forEach(sel=>{
    sel.onchange=()=>{ const idx=+sel.dataset.padIdx; MapState.padNotes[idx]=parseInt(sel.value,10); saveAll(); updateInlineBadges(); };
  });
  table.querySelectorAll('.learnPad').forEach(btn=>{
    btn.onclick=()=>{ startPadLearn(parseInt(btn.dataset.idx,10), btn); };
  });
}

// Export/Import
function saveAll(){ localStorage.setItem('axiom.map.v2', JSON.stringify({ccMap:MapState.ccMap, ccMode:MapState.ccMode, padNotes:MapState.padNotes})) }
function loadAll(){ try{ const s=localStorage.getItem('axiom.map.v2'); if(s){ const o=JSON.parse(s); if(o.ccMap) MapState.ccMap=o.ccMap; if(o.ccMode) MapState.ccMode=o.ccMode; if(o.padNotes) MapState.padNotes=o.padNotes } }catch(_){} }

function bindConfig(){
  $('#exportBtn').onclick=()=>{ const obj={ ccMap:MapState.ccMap, ccMode:MapState.ccMode, padNotes:MapState.padNotes }; const txt=JSON.stringify(obj,null,2); navigator.clipboard?.writeText(txt); const pb=$('#pastebox'); pb.value = (pb.value ? pb.value + '' : '') + txt; };
  $('#importBtn').onclick=()=>{ const txt=prompt('Paste exported JSON'); if(!txt) return; try{ const obj=JSON.parse(txt); if(obj.ccMap) MapState.ccMap=obj.ccMap; if(obj.ccMode) MapState.ccMode=obj.ccMode; if(obj.padNotes) MapState.padNotes=obj.padNotes; saveAll(); renderCCTable(); renderPadTable(); updateInlineBadges(); say('Imported.','ok') }catch(e){ say('Import failed: '+e.message,'bad') } };
  $('#clearBtn').onclick=()=>{ localStorage.removeItem('axiom.map.v2'); loadAll(); renderCCTable(); renderPadTable(); updateInlineBadges(); say('Local settings cleared.','ok') };
}

// UI binders, base note, transpose/octave
function bindUI(){
  $('#startBtn').onclick = async()=>{ try{ const ok=await Eng.start(); if(ok){ say('Audio started.','ok'); Eng.test() } else say('Audio context not running. Click again.','warn'); diag(); ensurePresets(); }catch(e){ window.__lastErr=e.message; say('Could not start audio: '+e.message,'bad'); diag() } };
  $('#testBtn').onclick = async()=>{ try{ await Eng.start(); Eng.test(); say('Test beep sent.','ok'); diag(); ensurePresets(); }catch(e){ window.__lastErr=e.message; say('Test failed: '+e.message,'bad'); diag() } };
  $('#midiBtn').onclick = async()=>{ try{ const {list,selected} = await MIDI.connect(); const sel=$('#midiIn'); sel.innerHTML=''; for(const i of list){ const o=document.createElement('option'); o.value=i.id; o.textContent=i.name; sel.appendChild(o) } if(selected) sel.value=selected.id; say(selected?`Connected to <b>${selected.name}</b>.`:'MIDI ready. Select device.','ok'); diag({MIDIInputs:list.length}); ensurePresets(); }catch(e){ window.__lastErr=e.message; say(e.message,'bad'); diag() } };
  $('#resetBtn').onclick = ()=>{ location.reload() };

  // transpose/octave
  $('#tDown').onclick = ()=>{ state.transpose=clamp(state.transpose-1,-6,6); updLCD() };
  $('#tUp').onclick   = ()=>{ state.transpose=clamp(state.transpose+1,-6,6); updLCD() };
  $('#oDown').onclick = ()=>{ state.octave=clamp(state.octave-1,-3,3); updLCD() };
  $('#oUp').onclick   = ()=>{ state.octave=clamp(state.octave+1,-3,3); updLCD() };
  function updLCD(){ $('#lcd').innerHTML=`<small>ZONE 1 • CH ${state.ch}</small>Tr ${state.transpose} / Oct ${state.octave}` }

  // base note picker
  const baseSel=$('#baseNote'); for(let m=36;m<=72;m++){ const o=document.createElement('option'); o.value=m; o.textContent=`MIDI ${m}`; baseSel.appendChild(o) } baseSel.value=String(state.base); baseSel.onchange=()=>{ state.base=parseInt(baseSel.value,10); buildKeyboard(state) };

  // sliders → engine (and remember normalized)
  hookSlider('volume',v=>`${v}dB`,v=>Eng.setVolume(v));
  hookSlider('attack',fmtMs,v=>Eng.setEnv(v,+$('#decay').value,+$('#sustain').value,+$('#release').value));
  hookSlider('decay',fmtMs,v=>Eng.setEnv(+$('#attack').value,v,+$('#sustain').value,+$('#release').value));
  hookSlider('sustain',v=>Number(v).toFixed(2),v=>Eng.setEnv(+$('#attack').value,+$('#decay').value,Number(v),+$('#release').value));
  hookSlider('release',fmtMs,v=>Eng.setEnv(+$('#attack').value,+$('#decay').value,+$('#sustain').value,v));
  hookSlider('cutoff',fmtHz,v=>Eng.setCutoff(v));
  hookSlider('q',v=>Number(v).toFixed(1),v=>Eng.setQ(Number(v)));
  hookSlider('reverb',v=>Number(v).toFixed(2),v=>Eng.setReverb(Number(v)));
  hookSlider('delay',v=>Number(v).toFixed(2),v=>Eng.setDelay(Number(v)));
  hookSlider('bendRange',v=>String(v),v=>Eng.setBendRange(Number(v)));

  // Presets
  loadPresets();
}

// Mouse on keys
function bindKeyMouse(){ const kb=$('#kb'); kb.addEventListener('mousedown', async e=>{ const t=e.target.closest('[data-midi]'); if(!t) return; await Eng.start(); const m=+t.dataset.midi; playOn(m,110); const up=()=>{ playOff(m); window.removeEventListener('mouseup',up) }; window.addEventListener('mouseup',up) }); kb.addEventListener('touchstart', async e=>{ const t=e.target.closest('[data-midi]'); if(!t) return; await Eng.start(); playOn(+t.dataset.midi,110) },{passive:true}); kb.addEventListener('touchend', e=>{ const t=e.target.closest('[data-midi]'); if(!t) return; playOff(+t.dataset.midi) }); }

// Boot
buildKeyboard(state); buildPads(); injectInlineMap(); bindKeyMouse(); bindTyping(); bindMIDI(); bindUI(); loadAll(); renderCCTable(); renderPadTable(); bindConfig(); updateInlineBadges();

docReady();
function docReady(){ say('Ready. Start Audio → Test Tone → Connect MIDI.','ok'); diag(); ensurePresets(); window.addEventListener('visibilitychange',()=>diag()); }