(function(MP){
  const el = MP.el;
  const midiStatus = el('midiStatus');

  let access=null, input=null;

  function setInput(i){ if (input) input.onmidimessage=null; input=i; if (input){ input.onmidimessage=onMsg; midiStatus.textContent='MIDI: ' + (input.name||'connected'); } }

  function populate(){
    if (!access) return;
    const inputs = Array.from(access.inputs.values());
    if (inputs.length) setInput(inputs[0]);
    else midiStatus.textContent='MIDI: no inputs';
  }

  async function connect(){
    if (!navigator.requestMIDIAccess){ midiStatus.textContent='MIDI: unsupported'; alert('WebMIDI not supported in this browser. Try Chrome/Edge.'); return; }
    try{ access = await navigator.requestMIDIAccess(); access.onstatechange = populate; populate(); }
    catch(e){ midiStatus.textContent='MIDI: unavailable'; console.warn(e); }
  }

  function triggerPad(type, vel){
    const cx=MP.draw.fxCanvas.width/2, cy=MP.draw.fxCanvas.height/2;
    if (type==='kick'){ MP.drums.kick(vel); MP.drawFX.kick(cx,cy,vel); }
    else if (type==='snare'){ MP.drums.snare(vel); MP.drawFX.snare(cx,cy,vel); }
    else if (type==='hat-closed'){ MP.drums.hat(vel,false); MP.drawFX.hat(cx,cy,vel,false); }
    else if (type==='hat-open'){ MP.drums.hat(vel,true); MP.drawFX.hat(cx,cy,vel,true); }
    else if (type==='tom-low'){ MP.drums.tom(vel,'low'); MP.drawFX.tom(cx,cy,vel,'lo'); }
    else if (type==='tom-floor'){ MP.drums.tom(vel,'mid'); MP.drawFX.tom(cx,cy,vel,'lo'); }
    else if (type==='tom-high'){ MP.drums.tom(vel,'hi'); MP.drawFX.tom(cx,cy,vel,'hi'); }
    else if (type==='rim'){ MP.drums.snare(Math.max(70,vel)); MP.drawFX.snare(cx,cy,vel*0.8); }
    else if (type==='clap'){ MP.drums.clap(vel); MP.drawFX.clap(cx,cy,vel); }
  }

  function maybePadOn(note, vel){
    const t = MP.PAD_TO_TYPE[note]; if (!t) return false; triggerPad(t, vel); return true;
  }

  function onMsg(e){
    const [st,d1,d2]=e.data; const cmd=st & 0xF0;
    if (cmd===0x90){ if (d2===0) MP.engine.noteOff(d1); else { if (!maybePadOn(d1,d2)) MP.engine.noteOn(d1,d2); } }
    else if (cmd===0x80){ MP.engine.noteOff(d1); }
    else if (cmd===0xB0){
      if (d1===1){ const f=d2/127; MP.ui.setOpacity(0.05+0.95*f); }
      else if (d1===64){ const was=MP.state.sustainDown; MP.state.sustainDown=(d2>=64); if(!MP.state.sustainDown && was) MP.engine.flushSustained(); MP.engine.toggleEraser(d2>=64); }
      else if (d1===74){ MP.state.mpeScatter = d2/127*60; MP.ui.reflectScatterExtra(MP.state.mpeScatter); }
      else if (d1===120 || d1===123){ MP.engine.panic(); }
    }
    else if (cmd===0xE0){ const bend=((d2<<7)+d1)-8192; MP.ui.setFlowPhase(bend/8192*Math.PI); }
    else if ((st&0xF0)===0xD0){ MP.state.pressure = d1/127; }
    else if ((st&0xF0)===0xA0){ const n=MP.state.activeNotes.get(d1); if(n) n.pressure=d2/127; }
  }

  MP.midi = { connect, triggerPad };
})(window.MP);
