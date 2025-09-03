(function(MP){
  let audioCtx=null, closedByPanic=false;
  const master = { node:null, level:0.22 };
  MP.audio = {
    get ctx(){ return audioCtx; },
    master,
    ensure(){
      if (!audioCtx || closedByPanic){
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) throw new Error('WebAudio not supported');
        audioCtx = new AC();
        master.node = audioCtx.createGain();
        master.node.gain.value = master.level;
        master.node.connect(audioCtx.destination);
        closedByPanic=false;
      }
      return audioCtx;
    },
    async close(){
      if (audioCtx){ try{ await audioCtx.close(); }catch{} closedByPanic=true; }
    },
    midiToFreq(n){ return 440*Math.pow(2,(n-69)/12); }
  };

  // ---------- Synth presets ----------
  const SYNTH_PRESETS = {
    Classic: { type:'sawtooth', attack:0.006, decay:0.14, release:0.06, gain:1.0 },
    Soft:    { type:'sine',     attack:0.004, decay:0.12, release:0.08, gain:0.9 },
    Square:  { type:'square',   attack:0.006, decay:0.16, release:0.07, gain:0.95 },
    Tri:     { type:'triangle', attack:0.004, decay:0.12, release:0.07, gain:0.95 },
    Pluck:   { type:'sawtooth', attack:0.002, decay:0.08, release:0.05, gain:0.9 }
  };
  let synthName = 'Classic';
  MP.audio.setSynthPreset = function(name){
    if (SYNTH_PRESETS[name]) synthName = name;
  };
  MP.audio.getSynthPresets = () => Object.keys(SYNTH_PRESETS);

  // active voices
  const activeOsc = new Map(); // note → {osc,g}
  MP.audio.activeOsc = activeOsc;

  function envAttackDecay(g, v){
    const P = SYNTH_PRESETS[synthName];
    const ctx=audioCtx, now=ctx.currentTime;
    g.gain.cancelScheduledValues(now);
    const cur=Math.max(0.0001,g.gain.value);
    g.gain.setValueAtTime(cur,now);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, v*P.gain), now+P.attack);
    g.gain.exponentialRampToValueAtTime(v*P.gain*0.7, now+P.decay);
  }

  MP.audio.startTone = function(note, vel=100){
    MP.audio.ensure();
    const P=SYNTH_PRESETS[synthName];
    const v=Math.max(0.0001, vel/127);
    let h=activeOsc.get(note);
    if (!h){
      const osc=audioCtx.createOscillator();
      osc.type=P.type;
      osc.frequency.value = MP.audio.midiToFreq(note);
      const g=audioCtx.createGain();
      g.gain.value=0.0001;
      osc.connect(g).connect(master.node);
      osc.start();
      osc.onended = () => { const cur=activeOsc.get(note); if(cur && cur.osc===osc) activeOsc.delete(note); };
      h={osc,g}; activeOsc.set(note,h);
    } else {
      // if preset changed mid-note, update type
      h.osc.type = P.type;
    }
    envAttackDecay(h.g, v);
  };

  MP.audio.stopTone = function(note, fast=false){
    const h=activeOsc.get(note); if(!h) return;
    activeOsc.delete(note);
    const P=SYNTH_PRESETS[synthName];
    const now=audioCtx.currentTime, t=fast?0.012:P.release;
    h.g.gain.cancelScheduledValues(now);
    h.g.gain.setTargetAtTime(0.0001, now, t);
    try{ h.osc.stop(now+t+0.05);}catch{}
    setTimeout(()=>{ try{ h.osc.disconnect(); h.g.disconnect(); }catch{} }, (t+0.1)*1000);
  };

  // ---------- Drum kits ----------
  const DRUM_KITS = {
    Clean: {
      kick:{ f0:180, f1:55,  dur:0.22 },
      snr: { tone:190, band:1800, q:0.8, dNoise:0.18 },
      hat: { hp:6000, open:0.5, closed:0.07 },
      clap:{ grow:0.55, fade:0.006 }
    },
    "808": {
      kick:{ f0:140, f1:42,  dur:0.35 },
      snr: { tone:180, band:1500, q:0.7, dNoise:0.22 },
      hat: { hp:8000, open:0.65, closed:0.08 },
      clap:{ grow:0.65, fade:0.007 }
    },
    LoFi: {
      kick:{ f0:130, f1:50,  dur:0.28 },
      snr: { tone:160, band:1200, q:0.6, dNoise:0.20 },
      hat: { hp:5000, open:0.45, closed:0.06 },
      clap:{ grow:0.50, fade:0.008 }
    },
    Bright: {
      kick:{ f0:200, f1:60,  dur:0.20 },
      snr: { tone:210, band:2200, q:0.9, dNoise:0.16 },
      hat: { hp:9000, open:0.50, closed:0.07 },
      clap:{ grow:0.60, fade:0.006 }
    }
  };
  let kitName='Clean';
  MP.drums = MP.drums || {};
  MP.drums.setKit = function(name){ if (DRUM_KITS[name]) kitName=name; };
  MP.drums.getKits = () => Object.keys(DRUM_KITS);

  function envGain(t0,a=0.001,d=0.15){ const g=audioCtx.createGain(); g.gain.setValueAtTime(0.0001,t0); g.gain.exponentialRampToValueAtTime(1.0,t0+a); g.gain.exponentialRampToValueAtTime(0.0001, t0+a+d); return g; }
  function mkNoise(){ const len=audioCtx.sampleRate*2; const b=audioCtx.createBuffer(1,len,audioCtx.sampleRate); const d=b.getChannelData(0); for(let i=0;i<len;i++) d[i]=Math.random()*2-1; return b; }
  let noiseBuf=null; const noise=()=> noiseBuf || (noiseBuf=mkNoise());

  MP.drums.kick = function(v=100){
    MP.audio.ensure(); const t=audioCtx.currentTime, vel=v/127; const K=DRUM_KITS[kitName].kick;
    const o=audioCtx.createOscillator(); o.type='sine'; const g=audioCtx.createGain();
    g.gain.setValueAtTime(0.0001,t);
    o.frequency.setValueAtTime(K.f0 + 60*vel, t);
    o.frequency.exponentialRampToValueAtTime(K.f1, t+K.dur);
    g.gain.exponentialRampToValueAtTime(1.2*vel, t+0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t+K.dur);
    o.connect(g).connect(master.node); o.start(t); o.stop(t+K.dur+0.05);
  };

  MP.drums.snare = function(v=100){
    MP.audio.ensure(); const t=audioCtx.currentTime, vel=v/127; const P=DRUM_KITS[kitName].snr;
    const n=audioCtx.createBufferSource(); n.buffer=noise();
    const b=audioCtx.createBiquadFilter(); b.type='bandpass'; b.frequency.value=P.band; b.Q.value=P.q;
    const hg=envGain(t,0.001,P.dNoise); hg.gain.value=0.5+vel*0.8;
    n.connect(b).connect(hg).connect(master.node);
    const o=audioCtx.createOscillator(); o.type='triangle'; o.frequency.setValueAtTime(P.tone, t);
    o.frequency.exponentialRampToValueAtTime(P.tone*0.8, t+0.1);
    const tg=envGain(t,0.001,0.11); tg.gain.value=0.2+vel*0.5; o.connect(tg).connect(master.node);
    n.start(t); n.stop(t+P.dNoise+0.05); o.start(t); o.stop(t+0.16);
  };

  MP.drums.hat = function(v=100,open=false){
    MP.audio.ensure(); const t=audioCtx.currentTime, vel=v/127; const H=DRUM_KITS[kitName].hat;
    const n=audioCtx.createBufferSource(); n.buffer=noise();
    const h=audioCtx.createBiquadFilter(); h.type='highpass'; h.frequency.value=H.hp; h.Q.value=0.7;
    const dur=open?H.open:H.closed; const g=envGain(t,0.0005,dur); g.gain.value=(open?0.35:0.25)+vel*0.4;
    n.connect(h).connect(g).connect(master.node); n.start(t); n.stop(t+dur+0.05);
  };

  MP.drums.tom = function(v=100,p='low'){
    MP.audio.ensure(); const t=audioCtx.currentTime, vel=v/127;
    const o=audioCtx.createOscillator(); o.type='sine';
    const g=envGain(t,0.001,0.25); g.gain.value=0.9*vel;
    const s=p==='low'?180:p==='mid'?220:260; const e=p==='low'?110:p==='mid'?160:200;
    o.frequency.setValueAtTime(s,t); o.frequency.exponentialRampToValueAtTime(e,t+0.25);
    o.connect(g).connect(master.node); o.start(t); o.stop(t+0.3);
  };

  MP.drums.clap = function(v=100){
    MP.audio.ensure(); const t=audioCtx.currentTime, vel=v/127; const C=DRUM_KITS[kitName].clap;
    for(let i=0;i<2;i++){
      const n=audioCtx.createBufferSource(); n.buffer=noise();
      const b=audioCtx.createBiquadFilter(); b.type='bandpass'; b.frequency.value=1600; b.Q.value=0.8;
      const g=envGain(t+i*0.01,0.0005,0.12); g.gain.value=0.5+vel*0.6;
      n.connect(b).connect(g).connect(master.node); n.start(t+i*0.01); n.stop(t+0.2);
    }
  };

  MP.audio.hardClose = async () => { try{ MP.audio.activeOsc.forEach((_,n)=>MP.audio.stopTone(n,true)); }catch{} await MP.audio.close(); };

  // ADD this in audio.js (inside the IIFE, before "})(window.MP);")
MP.audio.unlock = async function unlock() {
  try {
    MP.audio.ensure();
    await audioCtx.resume();
    return audioCtx.state || 'running';
  } catch (err) {
    console.warn('unlock failed', err);
    return 'error';
  }
};

})(window.MP);
