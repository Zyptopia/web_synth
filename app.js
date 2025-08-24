========================== app.js ==========================
kb.innerHTML=''; const W=[0,2,4,5,7,9,11], B={1:1,3:1,6:1,8:1,10:1};
for(let i=0;i<25;i++){ const n=state.base+i, s=n%12; if(W.includes(s)){ const w=document.createElement('div'); w.className='white'; w.dataset.midi=n; kb.appendChild(w); const next=(s+1)%12; if(B[next]){ const b=document.createElement('div'); b.className='black'; b.dataset.midi=n+1; w.appendChild(b);} } }
}
buildKeys();
function midiVisible(m){return m>=state.base-1 && m<state.base+32}
function keyEl(m){ return kb.querySelector(`[data-midi="${m}"]`) }
function flashKey(m,on){ if(!midiVisible(m))return; const el=keyEl(m); if(!el)return; el.classList.toggle('active',!!on) }


kb.addEventListener('mousedown', async e=>{ const t=e.target.closest('[data-midi]'); if(!t) return; await Eng.start(); const m=+t.dataset.midi; playOn(m,110); const up=()=>{ playOff(m); window.removeEventListener('mouseup',up)}; window.addEventListener('mouseup',up) });
kb.addEventListener('touchstart', async e=>{ const t=e.target.closest('[data-midi]'); if(!t) return; await Eng.start(); playOn(+t.dataset.midi,110) },{passive:true});
kb.addEventListener('touchend', e=>{ const t=e.target.closest('[data-midi]'); if(!t) return; playOff(+t.dataset.midi) });


// Computer typing
const keyW='asdfghjkl;'.split(''), keyB='wetyuop'.split(''), offW=[0,2,4,5,7,9,11,12,14,16], offB=[1,3,6,8,10,13,15];
window.addEventListener('keydown', async e=>{ if(e.repeat) return; const k=e.key.toLowerCase(); const iw=keyW.indexOf(k), ib=keyB.indexOf(k); let m=null; if(iw>-1)m=state.base+offW[iw]; else if(ib>-1)m=state.base+offB[ib]; if(m!=null){ await Eng.start(); playOn(m,110) } });
window.addEventListener('keyup', e=>{ const k=e.key.toLowerCase(); const iw=keyW.indexOf(k), ib=keyB.indexOf(k); let m=null; if(iw>-1)m=state.base+offW[iw]; else if(ib>-1)m=state.base+offB[ib]; if(m!=null) playOff(m) });


// Notes
function eff(m){ return m + state.transpose + state.octave*12 }
function playOn(m,vel=100){ const mv=eff(m); if($('#preset').value==='drum'){ Eng.setPreset('drum'); Eng.noteOn(mv,vel/127); flashKey(mv,true); lcd('PAD',`m${mv} v${vel}`); return } Eng.setPreset($('#preset').value); Eng.noteOn(mv,vel/127); state.held.add(mv); flashKey(mv,true); lcd('NOTE',`m${mv} v${vel}`) }
function playOff(m){ const mv=eff(m); if(!state.held.has(mv)){ flashKey(mv,false); return } if(Eng.sustain){ flashKey(mv,false); return } Eng.noteOff(mv); state.held.delete(mv); flashKey(mv,false) }
function allOff(){ Eng.releaseAll(); state.held.clear(); $$('.white,.black,.pad').forEach(el=>el.classList.remove('active')) }


// Pads
const padLayout=[{m:36,n:'Kick'},{m:38,n:'Snare'},{m:42,n:'CH'},{m:46,n:'OH'},{m:39,n:'Clap'},{m:41,n:'LT'},{m:43,n:'HT'},{m:49,n:'Crash'}];
const pads=$('#pads'); pads.innerHTML='';
padLayout.forEach(p=>{ const d=document.createElement('div'); d.className='pad'; d.innerHTML=`<small>${p.n}</small>`; d.addEventListener('mousedown', async()=>{ await Eng.start(); Eng.setPreset('drum'); Eng.noteOn(p.m,0.9); d.classList.add('active'); setTimeout(()=>d.classList.remove('active'),120) }); pads.appendChild(d) });


// Sliders → engine
function hook(id,fmt,on){ const el=$('#'+id), lab=$('#'+id+'Val'); const apply=()=>{ const v=+el.value; lab.textContent=fmt(v); on(v) }; el.addEventListener('input',apply); apply() }


hook('volume',v=>`${v}dB`,v=>Eng.setVolume(v));
hook('attack',fmtMs,v=>Eng.setEnv(v,+$('#decay').value,+$('#sustain').value,+$('#release').value));
hook('decay',fmtMs,v=>Eng.setEnv(+$('#attack').value,v,+$('#sustain').value,+$('#release').value));
hook('sustain',v=>v.toFixed(2),v=>Eng.setEnv(+$('#attack').value,+$('#decay').value,v,+$('#release').value));
hook('release',fmtMs,v=>Eng.setEnv(+$('#attack').value,+$('#decay').value,+$('#sustain').value,v));
hook('cutoff',fmtHz,v=>Eng.setCutoff(v));
hook('q',v=>v.toFixed(1),v=>Eng.setQ(v));
hook('reverb',v=>v.toFixed(2),v=>Eng.setReverb(v));
hook('delay',v=>v.toFixed(2),v=>Eng.setDelay(v));
hook('bendRange',v=>String(v),v=>Eng.setBendRange(v));


$('#preset').addEventListener('change',()=>Eng.setPreset($('#preset').value));
$('#panic').addEventListener('click',allOff);


// Transpose/Octave + LCD
function updLCD(){ $('#lcd').innerHTML = `<small>ZONE 1 • CH ${state.ch}</small>Tr ${state.transpose} / Oct ${state.octave}` }
$('#tDown').addEventListener('click',()=>{ state.transpose=clamp(state.transpose-1,-6,6); updLCD() });
$('#tUp').addEventListener('click',()=>{ state.transpose=clamp(state.transpose+1,-6,6); updLCD() });
$('#oDown').addEventListener('click',()=>{ state.octave=clamp(state.octave-1,-3,3); updLCD() });
$('#oUp').addEventListener('click',()=>{ state.octave=clamp(state.octave+1,-3,3); updLCD() });


// Base note picker
const baseSel=$('#baseNote'); for(let m=36;m<=72;m++){ const o=document.createElement('option'); o.value=m; o.textContent=`MIDI ${m}`; baseSel.appendChild(o) } baseSel.value=String(state.base); baseSel.addEventListener('change',()=>{ state.base=parseInt(baseSel.value,10); buildKeys() });


// MIDI
const midiSel=$('#midiIn'); let inputs=[];
function refreshInputs(){ midiSel.innerHTML=''; inputs=[]; if(!state.midi) return; for(const input of state.midi.inputs.values()){ inputs.push(input); const o=document.createElement('option'); o.value=input.id; o.textContent=input.name; midiSel.appendChild(o) } if(inputs.length){ const ax=inputs.find(i=>/axiom/i.test(i.name))||inputs[0]; setInput(ax); midiSel.value=ax.id } diag({MIDIInputs:inputs.length}) }
function setInput(input){ if(state.input) state.input.onmidimessage=null; state.input=input; input.onmidimessage=onMsg; say(`Connected to <b>${input.name}</b>.`,'ok') }
function onMsg(ev){ const [s,d1,d2]=ev.data, cmd=s&0xF0, ch=(s&0x0F)+1; state.ch=ch; log(`0x${s.toString(16)} ch${ch} d1=${d1} d2=${d2}`); if(cmd===0x90&&d2>0){ playOn(d1,d2); return } if((cmd===0x90&&d2===0)||cmd===0x80){ playOff(d1); return } if(cmd===0xE0){ const bend=((d2<<7)|d1)-8192; const cents=(bend/8192)*Eng.bendRange; Eng.bendTo(cents); return } if(cmd===0xB0){ handleCC(d1,d2); return } }
function handleCC(cc,val){ if(cc===64){ Eng.setSustain(val>=64); lcd('Sustain',val>=64?'On':'Off'); return } if(cc===1){ Eng.setModDepth(val/127); lcd('Mod',val); return } const x=val/127; switch(cc){ case 16: Eng.setCutoff(150+x*(12000-150)); $('#cutoff').value=Math.round(150+x*(12000-150)); $('#cutoffVal').textContent=fmtHz(+$('#cutoff').value); break; case 17: const q=0.2+x*(18-0.2); Eng.setQ(q); $('#q').value=q.toFixed(1); $('#qVal').textContent=$('#q').value; break; case 18: $('#attack').value=Math.round(x*2000); $('#attack').dispatchEvent(new Event('input')); break; case 19: $('#decay').value=Math.round(x*3000); $('#decay').dispatchEvent(new Event('input')); break; case 20: $('#sustain').value=x.toFixed(2); $('#sustain').dispatchEvent(new Event('input')); break; case 21: $('#release').value=Math.round(10+x*5990); $('#release').dispatchEvent(new Event('input')); break; case 22: $('#reverb').value=x.toFixed(2); $('#reverb').dispatchEvent(new Event('input')); break; case 23: $('#delay').value=x.toFixed(2); $('#delay').dispatchEvent(new Event('input')); break; default: /* ignore */ } }


// Buttons (bind + verify)
function bindButtons(){
$('#startBtn').addEventListener('click', async()=>{ try{ const ok=await Eng.start(); if(ok){ say('Audio started.','ok'); Eng.test() } else { say('Audio context not running. Click again.','warn') } diag() } catch(e){ window.__lastErr=e.message; say('Could not start audio: '+e.message,'bad'); diag() } });
$('#testBtn').addEventListener('click', async()=>{ try{ await Eng.start(); Eng.test(); say('Test beep sent.','ok'); diag() } catch(e){ window.__lastErr=e.message; say('Test failed: '+e.message,'bad'); diag() } });
$('#midiBtn').addEventListener('click', async()=>{ try{ if(!('requestMIDIAccess' in navigator)){ say('WebMIDI not supported (use Chrome/Edge).','bad'); return } const okHost=window.isSecureContext||['localhost','127.0.0.1','::1'].includes(location.hostname); if(!okHost){ say('WebMIDI needs HTTPS or localhost.','bad'); return } state.midi=await navigator.requestMIDIAccess({sysex:false}); state.midi.onstatechange=refreshInputs; refreshInputs(); if(!state.midi.inputs.size) say('No MIDI inputs detected. Plug your Axiom, then click Connect again.','warn'); else say('MIDI ready. Select device or play.','ok'); diag({MIDIInputs:inputs.length}) } catch(e){ window.__lastErr=e.message; say('MIDI access failed: '+e.message,'bad'); diag() } });
$('#resetBtn').addEventListener('click',()=>{ try{ localStorage.clear(); location.reload() }catch(_){ location.reload() } });
window.__btnsBound = true; diag();
}


function lcd(a,b){ $('#lcd').innerHTML = `<small>ZONE 1 • CH ${state.ch}</small>${a}${b?' — '+b:''}` }


// Init
say('Ready. Click Start Audio → Test Tone → Connect MIDI. (CSP‑safe build)','ok');
bindButtons();
diag();
console.log('[Axiom v15] BOOT ok');