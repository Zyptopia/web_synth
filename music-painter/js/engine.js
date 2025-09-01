(function(MP){
  const state = {
    held: new Set(),
    activeNotes: new Map(), // note -> {velocity, sustained, pressure}
    sustainDown: false,
    pressure: 0,
    mpeScatter: 0,
    erasingBase: false,
  };
  MP.state = state;

  MP.engine = {
    noteOn(note, vel=100){
      MP.audio.ensure();
      state.held.add(note);
      state.activeNotes.set(note, { velocity: vel, sustained:false, pressure:0 });
      MP.audio.startTone(note, vel);
      MP.ui?.refreshNoteList?.();
    },
    noteOff(note){
      if (state.sustainDown){ const n=state.activeNotes.get(note); if(n) n.sustained=true; MP.ui?.refreshNoteList?.(); return; }
      state.held.delete(note); state.activeNotes.delete(note); MP.audio.stopTone(note);
      MP.ui?.refreshNoteList?.();
    },
    flushSustained(){
      const to=[]; state.activeNotes.forEach((v,k)=>{ if(v.sustained) to.push(k); });
      to.forEach(k=>{ state.held.delete(k); state.activeNotes.delete(k); MP.audio.stopTone(k); });
      MP.ui?.refreshNoteList?.();
    },
    toggleEraser(force=null){
      if (force===null) state.erasingBase=!state.erasingBase; else state.erasingBase=!!force;
      MP.ui?.setEraser?.(state.erasingBase);
    },
    async panic(){
      try{ MP.audio.activeOsc.forEach((_,n)=>MP.audio.stopTone(n,true)); }catch{}
      state.held.clear(); state.activeNotes.clear();
      state.sustainDown=false; state.pressure=0; state.mpeScatter=0;
      MP.ui?.refreshNoteList?.();
      await MP.audio.hardClose();
    }
  };

  // Watchdog: kill voices that shouldn't be on
  setInterval(()=> {
    MP.audio.activeOsc.forEach((_, note)=>{
      const n=state.activeNotes.get(note);
      const should = state.held.has(note) || (n && n.sustained);
      if (!should) MP.audio.stopTone(note,true);
    });
  }, 500);
})(window.MP);
