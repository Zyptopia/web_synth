import {SynthEngine} from './synth.js';
import {MidiManager} from './midi.js';
import {PRESETS} from './presets.js';
import {MapState, PARAM_RANGES, DRUM_CHOICES, midiName} from './mapping.js';
import {Coach} from './coach.js';

const $ = (s)=>document.querySelector(s);
const $$ = (s)=>Array.from(document.querySelectorAll(s));
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const fmtMs=v=>`${Math.round(v)}ms`, fmtHz=v=>v>=1000?(v/1000).toFixed(1)+'k':Math.round(v);

function say(msg, tone=''){ const st=$('#status'); if(!st) return; st.className='status '+(tone||''); st.innerHTML=msg; }

// ---------------- UI Builders ----------------
function buildKeyboard(state){
  const kb=$('#kb'); if(!kb) return; kb.innerHTML='';
  const W=[0,2,4,5,7,9,11], B={1:1,3:1,6:1,8:1,10:1};
  for(let i=0;i<25;i++){
    const n=state.base+i, s=n%12; if(W.includes(s)){
      const w=document.createElement('div'); w.className='white'; w.dataset.midi=n; kb.appendChild(w);
      const next=(s+1)%12; if(B[next]){ const b=document.createElement('div'); b.className='black'; b.dataset.midi=n+1; w.appendChild(b) }
    }
  }
}
function flashKey(state,m,on){ const el=$(`#kb [data-midi="${m}"]`); if(!el) return; el.classList.toggle('active',!!on) }

function buildPads(){
  const root=$('#pads'); if(!root) return; root.innerHTML='';
  for(let i=0;i<8;i++){
    const d=document.createElement('div'); d.className='pad';
    d.innerHTML=`<small>Pad ${i+1}</small><button class="mapBtn" title="Map this pad">●</button>`;
    d.onmousedown=async(e)=>{ if(e.target.classList.contains('mapBtn')) return; await handlePadHit(i, MapState.padNotes[i], 120); };
    d.querySelector('.mapBtn').onclick=(e)=>{ e.stopPropagation(); startPadLearn(i, d.querySelector('.mapBtn')) };
    root.appendChild(d);
  }
}
function flashPad(i,on){ const d=$$('#pads .pad')[i]; if(d) d.classList.toggle('active',!!on) }

function injectInlineMap(){
  for(const p of MapState.ccParams()){
    const el=$('#'+p); if(!el) continue; const row=el.closest('.control'); if(!row) continue;
    const b=document.createElement('button'); b.className='miniMap'; b.title='Map this control (Learn)'; b.textContent='●'; b.onclick=()=>startCCLearn(p,b); row.appendChild(b);
  }
  updateInlineBadges();
}
function updateInlineBadges(){
  for(const p of MapState.ccParams()){
    const el=$('#'+p); if(!el) continue; const row=el.closest('.control'); if(!row) continue; const b=row.querySelector('.miniMap'); if(!b) continue;
    const cc=MapState.ccMap[p]; const mode=(cc!=null && MapState.ccMode[cc])?MapState.ccMode[cc]:null;
    b.textContent=cc!=null?`●CC${cc}`:'●';
    b.title=cc!=null?`Mapped to CC${cc}${mode?` (${mode})`:''}. Click to re-map or press Esc to cancel.`:'Map this control (Learn)';
  }
  $$('#pads .pad').forEach((d,i)=>{
    const b=d.querySelector('.mapBtn'); const m=MapState.padNotes[i];
    if(b){ b.textContent='●'+m; b.title=`Pad ${i+1} → MIDI ${m} (${midiName(m)}) — click to re-map (Esc to cancel)` }
  });
}

function diag(extra={}){
  const cells=[
    ['Secure',String(window.isSecureContext)],
    ['Host',location.hostname||'(file)'],
    ['Protocol',location.protocol],
    ['Engine', Eng?.mode||'—'],
    ['AudioState', Eng?.ctx?.state||'—'],
    ['WebMIDI', ('requestMIDIAccess'in navigator)?'yes':'no'],
    ['Buttons','yes'],
    ['LastErr', window.__lastErr||'—']
  ];
  for(const [k,v] of Object.entries(extra)) cells.push([k,v]);
  const root=$('#diag'); if(root) root.innerHTML=cells.map(([k,v])=>`<div class=di><b>${k}</b>${v}</div>`).join('');
}
window.__lastErr='—';
window.addEventListener('error',e=>{window.__lastErr=e.message; diag()});
window.addEventListener('unhandledrejection',e=>{window.__lastErr=String(e.reason?.message||e.reason||'Promise'); diag()});


function applyEngineFromUI(){
  if(!Eng?.started) return;
  try{
    Eng.setVolume(+$('#volume').value);
    Eng.setEnv(+$('#attack').value, +$('#decay').value, +$('#sustain').value, +$('#release').value);
    Eng.setCutoff(+$('#cutoff').value);
    Eng.setQ(+$('#q').value);
    Eng.setReverb(+$('#reverb').value);
    Eng.setDelay(+$('#delay').value);
    Eng.setBendRange(Number($('#bendRange').value));
    const kv=document.querySelector('#keysVol');
    if(kv) Eng.setKeysVolume(parseFloat(kv.value)||0);
  }catch(e){
    window.__lastErr=e.message; diag();
  }
}

// ---------------- Engine & MIDI ----------------
const Eng = new SynthEngine();
const MIDI = new MidiManager();
window.Eng=Eng;

// Coach (metronome, arp, scale, velocity, composer)
let COACH;

const state={ base:60, held:new Set(), transpose:0, octave:0, ch:1, padMode:'drum', drumKit:'standard' };
const eff=(m)=> m + state.transpose + state.octave*12;

// Raw note handlers
function rawNoteOn(m,vel=100){ const mv=eff(m); Eng.noteOn(mv,vel/127); state.held.add(mv); flashKey(state,mv,true); }
function rawNoteOff(m){ const mv=eff(m); if(!state.held.has(mv)){flashKey(state,mv,false); return} if(Eng.sustain){flashKey(state,mv,false); return} Eng.noteOff(mv); state.held.delete(mv); flashKey(state,mv,false) }
// Coach-aware wrappers
function playOn(m,vel=100){ if(window.COACH) window.COACH.noteOn(m,vel); else rawNoteOn(m,vel) }
function playOff(m){ if(window.COACH) window.COACH.noteOff(m); else rawNoteOff(m) }

function allOff(){ Eng.releaseAll(); state.held.clear(); document.querySelectorAll('.white,.black,.pad').forEach(el=>el.classList.remove('active')) }

async function handlePadHit(idx, midi, vel){ await Eng.start(); if(state.padMode==='off') return; const gain=(MapState.padGain?.[idx]??1); flashPad(idx,true); setTimeout(()=>flashPad(idx,false),120); if(state.padMode==='drum'){ Eng.setDrumKit(state.drumKit); Eng.triggerDrum(midi, (vel||110)/127, gain); } else if(state.padMode==='instrument'){ playOn(midi, Math.round((vel||110)*gain)); } }

function lcd(a,b){ $('#lcd').innerHTML=`<small>ZONE 1 • CH ${state.ch}</small>${a||''}${b?' — '+b:''}` }

// ---------------- Controls ----------------
function hookSlider(param,fmt,on){
  const el=$('#'+param), lab=$('#'+param+'Val'); if(!el||!lab) return;

  const applyUI=()=>{ 
    const v=+el.value; 
    lab.textContent=fmt(v); 
    const r=PARAM_RANGES[param]; 
    if(r){ 
      const x=(v-r.min)/(r.max-r.min); 
      MapState.setParamNorm(param,x); 
    } 
    updateInlineBadges(); 
  };
  const applyEngine=()=>{ 
    if(Eng?.started){ 
      const v=+el.value; 
      try{ on(v); }catch(_){} 
    } 
  };

  el.addEventListener('input',()=>{ applyUI(); applyEngine(); });
  applyUI();             // UI shows values right away
  // (engine gets set later by applyEngineFromUI after Start)
}


function loadPresets(){ const sel=$('#preset'); if(!sel) return; sel.innerHTML=''; for(const p of PRESETS){ const o=document.createElement('option'); o.value=p.id; o.textContent=p.name; sel.appendChild(o) } sel.value='piano'; applyPreset('piano'); sel.onchange=()=>applyPreset(sel.value) }
const ensurePresets=()=>{ const sel=$('#preset'); if(sel && sel.options.length===0) loadPresets(); };
const applyPreset=(id)=>{ const p=PRESETS.find(x=>x.id===id)||PRESETS[0]; Eng.setPreset(p.id,p) };

function bindTyping(){
  const keyW='asdfghjkl;'.split(''), keyB='wetyuop'.split('');
  const offW=[0,2,4,5,7,9,11,12,14,16], offB=[1,3,6,8,10,13,15];
  window.addEventListener('keydown', async e=>{ if(e.repeat) return; const k=e.key.toLowerCase(); const iw=keyW.indexOf(k), ib=keyB.indexOf(k); let m=null; if(iw>-1)m=state.base+offW[iw]; else if(ib>-1)m=state.base+offB[ib]; if(m!=null){ await Eng.start(); playOn(m,110) } });
  window.addEventListener('keyup', e=>{ const k=e.key.toLowerCase(); const iw=keyW.indexOf(k), ib=keyB.indexOf(k); let m=null; if(iw>-1)m=state.base+offW[iw]; else if(ib>-1)m=state.base+offB[ib]; if(m!=null) playOff(m) });
}

// --------------- Learn / Mapping ---------------
let ccLearnParam=null, ccLearnBtn=null, padLearnIndex=null, padLearnBtn=null, learnTimer=null;
function startCCLearn(param,btn){ if(ccLearnParam===param){ endLearns(); say('CC learn cancelled.','warn'); return } ccLearnParam=param; ccLearnBtn?.classList.remove('active'); ccLearnBtn=btn; btn?.classList.add('active'); say(`Twist a knob to map → ${param} (Esc to cancel)`, 'warn'); clearTimeout(learnTimer); learnTimer=setTimeout(()=>{ endLearns(); say('CC learn timed out.','warn') },15000); }
function startPadLearn(idx,btn){ if(padLearnIndex===idx){ endLearns(); say('Pad learn cancelled.','warn'); return } padLearnIndex=idx; padLearnBtn?.classList.remove('active'); padLearnBtn=btn; btn?.classList.add('active'); say(`Hit a pad to map → Pad ${idx+1} (Esc to cancel)`, 'warn'); clearTimeout(learnTimer); learnTimer=setTimeout(()=>{ endLearns(); say('Pad learn timed out.','warn') },15000); }
function endLearns(){ if(ccLearnBtn) ccLearnBtn.classList.remove('active'); if(padLearnBtn) padLearnBtn.classList.remove('active'); ccLearnParam=null; padLearnIndex=null; clearTimeout(learnTimer); learnTimer=null; updateInlineBadges(); }
window.addEventListener('keydown',e=>{ if(e.key==='Escape') endLearns() });

function bindMIDI(){
  MIDI.onNoteOn=(d1,d2)=>{
    if(padLearnIndex!=null){ MapState.padNotes[padLearnIndex]=d1; renderPadTable(); saveAll(); say(`Pad ${padLearnIndex+1} → MIDI ${d1} (${midiName(d1)})`,'ok'); endLearns(); return }
    const idx = MapState.padNotes.indexOf(d1);
    if(idx!==-1){ handlePadHit(idx, d1, d2); return; }
    playOn(d1,d2);
  };
  MIDI.onNoteOff=(d1)=>{ const idx=MapState.padNotes.indexOf(d1); if(idx!==-1) flashPad(idx,false); playOff(d1) };
  MIDI.onBend=(bend)=>{ const cents=(bend/8192)*Eng.bendRange; Eng.bendTo(cents) };
  MIDI.onChChange=(ch)=>{ state.ch=ch };
  MIDI.onCC=(cc,val)=>{
    if(ccLearnParam){ MapState.setCC(ccLearnParam, cc); renderCCTable(); saveAll(); say(`Mapped CC${cc} → ${ccLearnParam}`,'ok'); endLearns(); return }
    MapState.markCCMode(cc,val);
    if(cc===64){ Eng.setSustain(val>=64); lcd('Sustain',val>=64?'On':'Off'); return }
    if(cc===1){ if(!MapState.paramByCC(1) && !MapState.paramByCC(cc)) Eng.setModDepth?.(val/127); }
    const target = MapState.paramByCC(cc); if(!target){ return }
    const mode = MapState.ccMode[cc]||'absolute';
    if(mode==='absolute'){ setParamByNorm(target, val/127); }
    else { const delta=MapState.relDelta(val)/64; const prev=MapState.getParamNorm(target); setParamByNorm(target, clamp(prev+delta,0,1)); }
  };
}

function setParamByNorm(param, x){ MapState.setParamNorm(param, x); const r=PARAM_RANGES[param]; const val=r.min + x*(r.max-r.min); const el=$('#'+param); if(el){ el.value=String(val); el.dispatchEvent(new Event('input')) } }

function renderCCTable(){
  const params=MapState.ccParams(); const table=$('#ccTable'); if(!table) return;
  table.innerHTML=`<tr><th>Parameter</th><th>CC#</th><th>Mode</th><th>Learn</th></tr>`+
    params.map(p=>{ const cc=MapState.ccMap[p]??''; const mode=cc!=='' && MapState.ccMode[cc]?MapState.ccMode[cc]:'';
      return `<tr><td>${p}</td><td><input data-cc-param="${p}" class="ccNum" type="number" min="0" max="127" value="${cc}"></td><td>${mode}</td><td><button class="learnCC" data-param="${p}">●</button></td></tr>`
    }).join('');
  table.querySelectorAll('.ccNum').forEach(inp=>{ inp.onchange=()=>{ MapState.setCC(inp.dataset.ccParam, clamp(parseInt(inp.value,10)||0,0,127)); saveAll(); updateInlineBadges(); }; });
  table.querySelectorAll('.learnCC').forEach(btn=>{ btn.onclick=()=>{ startCCLearn(btn.dataset.param, btn); }; });
}
function renderPadTable(){
  const table=$('#padTable'); if(!table) return;
  table.innerHTML=`<tr><th>Pad</th><th>MIDI Note</th><th>Name</th><th>Vol</th><th>Learn</th></tr>`+
    MapState.padNotes.map((m,i)=>{
      const opts=DRUM_CHOICES.map(([name,n])=>`<option value="${n}" ${n===m?'selected':''}>${n} — ${name}</option>`).join('');
      const vol=(MapState.padGain?.[i]??1);
      return `<tr><td>Pad ${i+1}</td><td><select data-pad-idx="${i}" class="padSel">${opts}</select></td><td>${m} (${midiName(m)})</td><td><input type="range" min="0" max="1" step="0.01" value="${vol}" class="padVol" data-pad-idx="${i}"><span class="pv">${Math.round(vol*100)}%</span></td><td><button class="learnPad" data-idx="${i}">●</button></td></tr>`
    }).join('');
  table.querySelectorAll('.padSel').forEach(sel=>{ sel.onchange=()=>{ const idx=+sel.dataset.padIdx; MapState.padNotes[idx]=parseInt(sel.value,10); saveAll(); updateInlineBadges(); }; });
  table.querySelectorAll('.padVol').forEach(sl=>{ sl.oninput=()=>{ const idx=+sl.dataset.padIdx; const v=parseFloat(sl.value)||0; if(!MapState.padGain) MapState.padGain=[1,1,1,1,1,1,1,1]; MapState.padGain[idx]=Math.max(0,Math.min(1,v)); sl.parentElement.querySelector('.pv').textContent=`${Math.round(MapState.padGain[idx]*100)}%`; saveAll(); }; });
  table.querySelectorAll('.learnPad').forEach(btn=>{ btn.onclick=()=>{ startPadLearn(parseInt(btn.dataset.idx,10), btn); }; });
}

// --------------- Persistence & Config ---------------
function saveAll(){ localStorage.setItem('axiom.map.v2', JSON.stringify({ccMap:MapState.ccMap, ccMode:MapState.ccMode, padNotes:MapState.padNotes, padGain:MapState.padGain, padMode:state.padMode, drumKit:state.drumKit})) }
function loadAll(){ try{ const s=localStorage.getItem('axiom.map.v2'); if(s){ const o=JSON.parse(s); if(o.ccMap) MapState.ccMap=o.ccMap; if(o.ccMode) MapState.ccMode=o.ccMode; if(o.padNotes) MapState.padNotes=o.padNotes; if(o.padGain) MapState.padGain=o.padGain; if(o.padMode) state.padMode=o.padMode; if(o.drumKit) state.drumKit=o.drumKit; } }catch(_){} }

function bindConfig(){
  // Export/Import
  $('#exportBtn').onclick=()=>{ const obj={ ccMap:MapState.ccMap, ccMode:MapState.ccMode, padNotes:MapState.padNotes, padGain:MapState.padGain, padMode:state.padMode, drumKit:state.drumKit }; const txt=JSON.stringify(obj,null,2); navigator.clipboard?.writeText(txt); const pb=$('#pastebox'); pb.value = (pb.value ? pb.value + '\n' : '') + txt; };
  $('#importBtn').onclick=()=>{ const txt=prompt('Paste exported JSON'); if(!txt) return; try{ const obj=JSON.parse(txt); if(obj.ccMap) MapState.ccMap=obj.ccMap; if(obj.ccMode) MapState.ccMode=obj.ccMode; if(obj.padNotes) MapState.padNotes=obj.padNotes; if(obj.padGain) MapState.padGain=obj.padGain; if(obj.padMode) state.padMode=obj.padMode; if(obj.drumKit) state.drumKit=obj.drumKit; saveAll(); renderCCTable(); renderPadTable(); updateInlineBadges(); updatePadModeUI(); say('Imported.','ok') }catch(e){ say('Import failed: '+e.message,'bad') } };
  $('#clearBtn').onclick=()=>{ localStorage.removeItem('axiom.map.v2'); loadAll(); renderCCTable(); renderPadTable(); updateInlineBadges(); updatePadModeUI(); say('Local settings cleared.','ok') };
}

function updatePadModeUI(){ $('#padMode').value=state.padMode; $('#drumKit').value=state.drumKit; const r=$('#drumKitRow'); if(r) r.style.display = (state.padMode==='drum')?'grid':'none'; $('#padModeVal').textContent=state.padMode; $('#drumKitVal').textContent=state.drumKit; }

function ensureDrumKitOptions(){ const dk=$('#drumKit'); if(!dk) return; const want=['standard','808','electro','room','trap','lofi','cr78','dnb']; const labels={standard:'Standard','808':'808',electro:'Electro',room:'Roomy',trap:'Trap',lofi:'Lo‑Fi',cr78:'CR‑78',dnb:'DnB'}; const have=new Set([...dk.options].map(o=>o.value)); for(const id of want){ if(!have.has(id)){ const o=document.createElement('option'); o.value=id; o.textContent=labels[id]; dk.appendChild(o) } } }

function addKeysVolUI(){
  const m=$('#volume'); if(!m) return;
  if($('#keysVol')) return;
  const row=m.closest('.control')||m.parentElement;
  const dv=document.createElement('div');
  dv.className='control';
  dv.innerHTML=`<label>Keys Volume</label><input type="range" id="keysVol" min="0" max="1" step="0.01" value="1"><span id="keysVolVal">100%</span>`;
  row.after(dv);
  const el=$('#keysVol'), lab=$('#keysVolVal');
  const apply=()=>{ 
  const v=parseFloat(el.value)||0; 
  lab.textContent=Math.round(v*100)+'%'; 
  if(Eng?.started && Eng.instGain) Eng.setKeysVolume(v);   // <-- guard
};

  el.addEventListener('input',apply);
  apply(); // harmless before audio; re-fired below after start
}


function bindUI(){
  $('#startBtn').onclick = async()=>{ try{ const ok=await Eng.start(); if(ok){ say('Audio started.','ok'); Eng.test() } else say('Audio context not running. Click again.','warn'); diag(); ensurePresets(); addKeysVolUI(); applyEngineFromUI(); }catch(e){ window.__lastErr=e.message; say('Could not start audio: '+e.message,'bad'); diag() } const kv=document.querySelector('#keysVol'); if(kv) kv.dispatchEvent(new Event('input'));};
  $('#testBtn').onclick = async()=>{ try{ await Eng.start(); Eng.test(); say('Test beep sent.','ok'); diag(); ensurePresets(); addKeysVolUI(); applyEngineFromUI(); }catch(e){ window.__lastErr=e.message; say('Test failed: '+e.message,'bad'); diag() } const kv2=document.querySelector('#keysVol'); if(kv2) kv2.dispatchEvent(new Event('input'));};
  $('#midiBtn').onclick = async()=>{ try{ const {list,selected} = await MIDI.connect(); const sel=$('#midiIn'); if(sel){ sel.innerHTML=''; for(const i of list){ const o=document.createElement('option'); o.value=i.id; o.textContent=i.name; sel.appendChild(o) } if(selected) sel.value=selected.id; } say(selected?`Connected to <b>${selected.name}</b>.`:'MIDI ready. Select device.','ok'); diag({MIDIInputs:list.length}); ensurePresets(); addKeysVolUI(); applyEngineFromUI(); }catch(e){ window.__lastErr=e.message; say(e.message,'bad'); diag() } const kv3=document.querySelector('#keysVol'); if(kv3) kv3.dispatchEvent(new Event('input'));};
  $('#resetBtn').onclick = ()=>{ location.reload() };

  // LCD utilities
  $('#tDown').onclick = ()=>{ state.transpose=clamp(state.transpose-1,-6,6); updLCD() };
  $('#tUp').onclick   = ()=>{ state.transpose=clamp(state.transpose+1,-6,6); updLCD() };
  $('#oDown').onclick = ()=>{ state.octave=clamp(state.octave-1,-3,3); updLCD() };
  $('#oUp').onclick   = ()=>{ state.octave=clamp(state.octave+1,-3,3); updLCD() };
  const updLCD=()=>{ $('#lcd').innerHTML=`<small>ZONE 1 • CH ${state.ch}</small>Tr ${state.transpose} / Oct ${state.octave}` };

  // Base note selector
  const baseSel=$('#baseNote'); if(baseSel){ for(let m=36;m<=72;m++){ const o=document.createElement('option'); o.value=m; o.textContent=`MIDI ${m}`; baseSel.appendChild(o) } baseSel.value=String(state.base); baseSel.onchange=()=>{ state.base=parseInt(baseSel.value,10); buildKeyboard(state); if(window.COACH) window.COACH.updateScale(); }; }

  // Sliders → engine
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

  // Add Keys Volume UI next to master
  addKeysVolUI();

  // Presets
  loadPresets();

  // Pad mode + kit
  ensureDrumKitOptions();
  const pm=$('#padMode'); if(pm) pm.onchange=()=>{ state.padMode=$('#padMode').value; updatePadModeUI(); saveAll(); };
  const dk=$('#drumKit'); if(dk) dk.onchange=()=>{ state.drumKit=$('#drumKit').value; Eng.setDrumKit(state.drumKit); updatePadModeUI(); saveAll(); say('Drum kit: '+state.drumKit,'ok') };

  // Panic
  $('#panic').onclick=()=>{ allOff(); say('All notes off','warn') };

  // CC quick learn UI
  const ccSel=$('#ccLearnParam'); if(ccSel){ ccSel.innerHTML = MapState.ccParams().map(p=>`<option value="${p}">${p}</option>`).join(''); }
  if($('#ccLearnBtn')) $('#ccLearnBtn').onclick=()=>{ startCCLearn(ccSel.value, $('#ccLearnBtn')); };
  if($('#ccReset')) $('#ccReset').onclick=()=>{ MapState.resetCCs(); renderCCTable(); updateInlineBadges(); saveAll(); say('CC map reset to Axiom defaults (K1..K8 → CC16..23).','ok'); };

  // Pad quick learn UI
  const pSel=$('#padIndex'); if(pSel){ pSel.innerHTML=Array.from({length:8},(_,i)=>`<option value="${i}">Pad ${i+1}</option>`).join(''); pSel.value='0'; }
  if($('#padLearnBtn')) $('#padLearnBtn').onclick=()=>{ startPadLearn(parseInt(pSel.value,10), $('#padLearnBtn')); };
  if($('#padReset')) $('#padReset').onclick=()=>{ MapState.resetPads(); MapState.resetPadGain(); renderPadTable(); updateInlineBadges(); saveAll(); say('Pads reset to 40,41,42,43,36,37,38,39 with 100% volume.','ok'); };
}

function bindKeyMouse(){
  const kb=$('#kb'); if(!kb) return;
  kb.addEventListener('mousedown', async e=>{ const t=e.target.closest('[data-midi]'); if(!t) return; await Eng.start(); const m=+t.dataset.midi; playOn(m,110); const up=()=>{ playOff(m); window.removeEventListener('mouseup',up) }; window.addEventListener('mouseup',up) });
  kb.addEventListener('touchstart', async e=>{ const t=e.target.closest('[data-midi]'); if(!t) return; await Eng.start(); playOn(+t.dataset.midi,110) },{passive:true});
  kb.addEventListener('touchend', e=>{ const t=e.target.closest('[data-midi]'); if(!t) return; playOff(+t.dataset.midi) });
}

// ---------------- Boot ----------------
buildKeyboard(state);
buildPads();
injectInlineMap();
bindKeyMouse();
bindTyping();
bindMIDI();
bindUI();
loadAll();
updatePadModeUI();
renderCCTable();
renderPadTable();
bindConfig();
updateInlineBadges();

// Coach mount
COACH = new Coach({ noteOnRaw:(m,v)=>rawNoteOn(m,v), noteOffRaw:(m)=>rawNoteOff(m), getKBEl:()=>document.querySelector('#kb') });
window.COACH=COACH; COACH.mount();

// Initial diag/presets
say('Ready. Start Audio → Test Tone → Connect MIDI.','ok');
diag();
ensurePresets();
Eng.setDrumKit(state.drumKit);
