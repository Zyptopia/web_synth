import {SynthEngine} from './synth.js';
import {MidiManager} from './midi.js';
import {PRESETS} from './presets.js';
import {MapState, DRUM_CHOICES, midiName} from './mapping.js';

const $ = (s)=>document.querySelector(s);
const $$ = (s)=>Array.from(document.querySelectorAll(s));
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const fmtMs=v=>`${Math.round(v)}ms`, fmtHz=v=>v>=1000?(v/1000).toFixed(1)+'k':Math.round(v);

// Build keys (25) and pads
function buildKeyboard(state){ const kb=$('#kb'); kb.innerHTML=''; const W=[0,2,4,5,7,9,11], B={1:1,3:1,6:1,8:1,10:1}; for(let i=0;i<25;i++){ const n=state.base+i, s=n%12; if(W.includes(s)){ const w=document.createElement('div'); w.className='white'; w.dataset.midi=n; kb.appendChild(w); const next=(s+1)%12; if(B[next]){ const b=document.createElement('div'); b.className='black'; b.dataset.midi=n+1; w.appendChild(b)} } } }
function flashKey(state,m,on){ if(m<state.base-1||m>=state.base+32) return; const el=$(`#kb [data-midi="${m}"]`); if(!el) return; el.classList.toggle('active',!!on) }

function buildPads(){ const root=$('#pads'); root.innerHTML=''; for(let i=0;i<8;i++){ const d=document.createElement('div'); d.className='pad'; d.innerHTML=`<small>Pad ${i+1}</small>`; d.onmousedown=async()=>{ await Eng.start(); Eng.setPreset('drum'); Eng.noteOn(MapState.padNotes[i],0.9); d.classList.add('active'); setTimeout(()=>d.classList.remove('active'),120) }; root.appendChild(d) } }

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

// Sliders → engine
function hook(id,fmt,on){ const el=$('#'+id), lab=$('#'+id+'Val'); const apply=()=>{ const v=+el.value; lab.textContent=fmt(v); on(v) }; el.addEventListener('input',apply); apply() }

// Presets
function loadPresets(){ const sel=$('#preset'); sel.innerHTML=''; for(const p of PRESETS){ const o=document.createElement('option'); o.value=p.id; o.textContent=p.name; sel.appendChild(o) } sel.value='piano'; applyPreset('piano'); sel.onchange=()=>applyPreset(sel.value) }
function applyPreset(id){ const p=PRESETS.find(x=>x.id===id)||PRESETS[0]; Eng.setPreset(p.id,p) }

// Typing
function bindTyping(){ const keyW='asdfghjkl;'.split(''), keyB='wetyuop'.split(''), offW=[0,2,4,5,7,9,11,12,14,16], offB=[1,3,6,8,10,13,15];
  window.addEventListener('keydown', async e=>{ if(e.repeat) return; const k=e.key.toLowerCase(); const iw=keyW.indexOf(k), ib=keyB.indexOf(k); let m=null; if(iw>-1)m=state.base+offW[iw]; else if(ib>-1)m=state.base+offB[ib]; if(m!=null){ await Eng.start(); playOn(m,110) } });
  window.addEventListener('keyup', e=>{ const k=e.key.toLowerCase(); const iw=keyW.indexOf(k), ib=keyB.indexOf(k); let m=null; if(iw>-1)m=state.base+offW[iw]; else if(ib>-1)m=state.base+offB[ib]; if(m!=null) playOff(m) });
}

// MIDI wiring with mapping + learn modes
let ccLearnParam=null; let padLearnIndex=null;
function bindMIDI(){
  MIDI.onNoteOn=(d1,d2)=>{
    // If a hardware pad sends notes, we still just play them (drum or synth per preset)
    if($('#preset').value==='drum') Eng.setPreset('drum', PRESETS.find(p=>p.id==='drum'));
    playOn(d1,d2);
  };
  MIDI.onNoteOff=(d1)=>playOff(d1);
  MIDI.onBend=(bend)=>{ const cents=(bend/8192)*Eng.bendRange; Eng.bendTo(cents) };
  MIDI.onChChange=(ch)=>{ state.ch=ch };
  MIDI.onCC=(cc,val)=>{
    if(ccLearnParam){
      MapState.setCC(ccLearnParam, cc); renderCCTable(); saveAll(); ccLearnParam=null; say(`Mapped CC${cc} → ${ccLearnParam}`,'ok'); return;
    }
    // Special pedals
    if(cc===64){ Eng.setSustain(val>=64); lcd('Sustain',val>=64?'On':'Off'); return }
    // Use mapping
    const target = MapState.paramByCC(cc);
    if(!target){ if(cc===1){ Eng.setModDepth(val/127); lcd('Mod',val); } return }
    const x=val/127;
    switch(target){
      case 'volume': { const db=-36 + x*(6+36); $('#volume').value=String(Math.round(db)); $('#volume').dispatchEvent(new Event('input')); break }
      case 'cutoff': { const v=Math.round(150 + x*(12000-150)); Eng.setCutoff(v); const el=$('#cutoff'); if(el){ el.value=String(v); $('#cutoffVal').textContent=v>=1000?(v/1000).toFixed(1)+'k':String(v) } break }
      case 'q':      { const v=(0.2 + x*(18-0.2)); Eng.setQ(v); const el=$('#q'); if(el){ el.value=String(v.toFixed(1)); $('#qVal').textContent=el.value } break }
      case 'attack': { const v=Math.round(x*2000); const el=$('#attack'); if(el){ el.value=String(v); el.dispatchEvent(new Event('input')) } break }
      case 'decay':  { const v=Math.round(x*3000); const el=$('#decay'); if(el){ el.value=String(v); el.dispatchEvent(new Event('input')) } break }
      case 'sustain':{ const v=Number(x.toFixed(2)); const el=$('#sustain'); if(el){ el.value=String(v); el.dispatchEvent(new Event('input')) } break }
      case 'release':{ const v=Math.round(10 + x*5990); const el=$('#release'); if(el){ el.value=String(v); el.dispatchEvent(new Event('input')) } break }
      case 'reverb': { const v=Number(x.toFixed(2)); const el=$('#reverb'); if(el){ el.value=String(v); el.dispatchEvent(new Event('input')) } break }
      case 'delay':  { const v=Number(x.toFixed(2)); const el=$('#delay'); if(el){ el.value=String(v); el.dispatchEvent(new Event('input')) } break }
      case 'modDepth':{ Eng.setModDepth(x); break }
    }
  };
}

// Mapping UI
function renderCCTable(){
  const params = MapState.ccParams();
  const table = $('#ccTable');
  table.innerHTML = `<tr><th>Parameter</th><th>CC#</th><th></th></tr>` +
    params.map(p=>{
      const cc = MapState.ccMap[p] ?? '';
      return `<tr>
        <td>${p}</td>
        <td><input data-cc-param="${p}" class="ccNum" type="number" min="0" max="127" value="${cc}"></td>
        <td><button class="learnCC" data-param="${p}">Learn</button></td>
      </tr>`
    }).join('');
  table.querySelectorAll('.ccNum').forEach(inp=>{
    inp.onchange=()=>{ MapState.setCC(inp.dataset.ccParam, clamp(parseInt(inp.value,10)||0,0,127)); saveAll() };
  });
  table.querySelectorAll('.learnCC').forEach(btn=>{
    btn.onclick=()=>{ ccLearnParam = btn.dataset.param; say(`Turn a knob to map → ${ccLearnParam}`,'warn') };
  });
}
function renderPadTable(){
  const table=$('#padTable');
  table.innerHTML = `<tr><th>Pad</th><th>MIDI Note</th><th>Name</th></tr>`+
    MapState.padNotes.map((m,i)=>{
      const opts = DRUM_CHOICES.map(([name,n])=>`<option value="${n}" ${n===m?'selected':''}>${n} — ${name}</option>`).join('');
      return `<tr>
        <td>Pad ${i+1}</td>
        <td><select data-pad-idx="${i}" class="padSel">${opts}</select></td>
        <td>${m} (${midiName(m)})</td>
      </tr>`
    }).join('');
  table.querySelectorAll('.padSel').forEach(sel=>{
    sel.onchange=()=>{ const idx=+sel.dataset.padIdx; MapState.padNotes[idx]=parseInt(sel.value,10); saveAll() };
  });
  const idxSel=$('#padIndex'); idxSel.innerHTML=''; for(let i=0;i<8;i++){ const o=document.createElement('option'); o.value=String(i); o.textContent=`Pad ${i+1}`; idxSel.appendChild(o) }
}

function bindMappingUI(){
  // build param dropdown for learn
  const dd=$('#ccLearnParam'); dd.innerHTML=''; for(const p of MapState.ccParams()){ const o=document.createElement('option'); o.value=p; o.textContent=p; dd.appendChild(o) }
  $('#ccLearnBtn').onclick=()=>{ ccLearnParam=dd.value; say(`Turn a knob to map → ${ccLearnParam}`,'warn') };
  $('#ccReset').onclick=()=>{ MapState.resetCC(); renderCCTable(); saveAll(); say('CC mapping reset to Axiom defaults.','ok') };

  $('#padLearnBtn').onclick=()=>{ padLearnIndex = parseInt($('#padIndex').value,10); say(`Hit a pad on your Axiom to map → Pad ${padLearnIndex+1}`,'warn') };
  $('#padReset').onclick=()=>{ MapState.resetPads(); renderPadTable(); saveAll(); say('Pad notes reset.','ok') };
}

// Capture pad learn on incoming notes (channel-agnostic)
(function hookPadLearn(){
  const origNoteOn = (d1,d2)=>{}; // placeholder
  // We intercept MIDI.onNoteOn via a wrapper
  const _onNote = (d1,d2)=>{
    if(padLearnIndex!=null){ MapState.padNotes[padLearnIndex]=d1; renderPadTable(); saveAll(); say(`Pad ${padLearnIndex+1} → MIDI ${d1} (${midiName(d1)})`,'ok'); padLearnIndex=null; return }
    playOn(d1,d2);
  };
  MIDI.onNoteOn = _onNote;
})();

// Export/Import
function saveAll(){ localStorage.setItem('axiom.map.v1', JSON.stringify({ccMap:MapState.ccMap, padNotes:MapState.padNotes})) }
function loadAll(){ try{ const s=localStorage.getItem('axiom.map.v1'); if(s){ const o=JSON.parse(s); if(o.ccMap) MapState.ccMap=o.ccMap; if(o.padNotes) MapState.padNotes=o.padNotes } }catch(_){} }

function bindConfig(){
  $('#exportBtn').onclick=()=>{ const obj={ ccMap:MapState.ccMap, padNotes:MapState.padNotes }; const txt=JSON.stringify(obj,null,2); navigator.clipboard?.writeText(txt); const pb=$('#pastebox'); pb.value=(pb.value?pb.value+'':'')+txt; say('Config copied to clipboard.','ok') };
  $('#importBtn').onclick=()=>{ const txt=prompt('Paste exported JSON'); if(!txt) return; try{ const obj=JSON.parse(txt); if(obj.ccMap) MapState.ccMap=obj.ccMap; if(obj.padNotes) MapState.padNotes=obj.padNotes; saveAll(); renderCCTable(); renderPadTable(); say('Imported.','ok') }catch(e){ say('Import failed: '+e.message,'bad') } };
  $('#clearBtn').onclick=()=>{ localStorage.removeItem('axiom.map.v1'); loadAll(); renderCCTable(); renderPadTable(); say('Local settings cleared.','ok') };
}

// UI binders, base note, transpose/octave
function bindUI(){
  $('#startBtn').onclick = async()=>{ try{ const ok=await Eng.start(); if(ok){ say('Audio started.','ok'); Eng.test() } else say('Audio context not running. Click again.','warn'); diag() }catch(e){ window.__lastErr=e.message; say('Could not start audio: '+e.message,'bad'); diag() } };
  $('#testBtn').onclick = async()=>{ try{ await Eng.start(); Eng.test(); say('Test beep sent.','ok'); diag() }catch(e){ window.__lastErr=e.message; say('Test failed: '+e.message,'bad'); diag() } };
  $('#midiBtn').onclick = async()=>{ try{ const {list,selected} = await MIDI.connect(); const sel=$('#midiIn'); sel.innerHTML=''; for(const i of list){ const o=document.createElement('option'); o.value=i.id; o.textContent=i.name; sel.appendChild(o) } if(selected) sel.value=selected.id; say(selected?`Connected to <b>${selected.name}</b>.`:'MIDI ready. Select device.','ok'); diag({MIDIInputs:list.length}) }catch(e){ window.__lastErr=e.message; say(e.message,'bad'); diag() } };
  $('#resetBtn').onclick = ()=>{ location.reload() };

  // transpose/octave
  $('#tDown').onclick = ()=>{ state.transpose=clamp(state.transpose-1,-6,6); updLCD() };
  $('#tUp').onclick   = ()=>{ state.transpose=clamp(state.transpose+1,-6,6); updLCD() };
  $('#oDown').onclick = ()=>{ state.octave=clamp(state.octave-1,-3,3); updLCD() };
  $('#oUp').onclick   = ()=>{ state.octave=clamp(state.octave+1,-3,3); updLCD() };
  function updLCD(){ $('#lcd').innerHTML=`<small>ZONE 1 • CH ${state.ch}</small>Tr ${state.transpose} / Oct ${state.octave}` }

  // base note picker
  const baseSel=$('#baseNote'); for(let m=36;m<=72;m++){ const o=document.createElement('option'); o.value=m; o.textContent=`MIDI ${m}`; baseSel.appendChild(o) } baseSel.value=String(state.base); baseSel.onchange=()=>{ state.base=parseInt(baseSel.value,10); buildKeyboard(state) };

  // sliders → engine
  const hook=(id,fmt,on)=>{ const el=$('#'+id), lab=$('#'+id+'Val'); const apply=()=>{ const v=+el.value; lab.textContent=fmt(v); on(v) }; el.addEventListener('input',apply); apply() };
  hook('volume',v=>`${v}dB`,v=>Eng.setVolume(v));
  hook('attack',fmtMs,v=>Eng.setEnv(v,+$('#decay').value,+$('#sustain').value,+$('#release').value));
  hook('decay',fmtMs,v=>Eng.setEnv(+$('#attack').value,v,+$('#sustain').value,+$('#release').value));
  hook('sustain',v=>Number(v).toFixed(2),v=>Eng.setEnv(+$('#attack').value,+$('#decay').value,Number(v),+$('#release').value));
  hook('release',fmtMs,v=>Eng.setEnv(+$('#attack').value,+$('#decay').value,+$('#sustain').value,v));
  hook('cutoff',fmtHz,v=>Eng.setCutoff(v));
  hook('q',v=>Number(v).toFixed(1),v=>Eng.setQ(Number(v)));
  hook('reverb',v=>Number(v).toFixed(2),v=>Eng.setReverb(Number(v)));
  hook('delay',v=>Number(v).toFixed(2),v=>Eng.setDelay(Number(v)));
  hook('bendRange',v=>String(v),v=>Eng.setBendRange(Number(v)));

  // Presets
  loadPresets();
}

// Mouse on keys
function bindKeyMouse(){ const kb=$('#kb'); kb.addEventListener('mousedown', async e=>{ const t=e.target.closest('[data-midi]'); if(!t) return; await Eng.start(); const m=+t.dataset.midi; playOn(m,110); const up=()=>{ playOff(m); window.removeEventListener('mouseup',up) }; window.addEventListener('mouseup',up) }); kb.addEventListener('touchstart', async e=>{ const t=e.target.closest('[data-midi]'); if(!t) return; await Eng.start(); playOn(+t.dataset.midi,110) },{passive:true}); kb.addEventListener('touchend', e=>{ const t=e.target.closest('[data-midi]'); if(!t) return; playOff(+t.dataset.midi) }); }

// Boot
buildKeyboard(state); buildPads(); bindKeyMouse(); bindTyping(); bindMIDI(); bindUI(); loadAll(); renderCCTable(); renderPadTable(); bindMappingUI();

docReady();
function docReady(){ say('Ready. Start Audio → Test Tone → Connect MIDI.','ok'); diag(); window.addEventListener('visibilitychange',()=>diag()); }