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
        MP.ui?.setAudioState?.(audioCtx.state);
        audioCtx.onstatechange = ()=> MP.ui?.setAudioState?.(audioCtx.state);
      }
      return audioCtx;
    },

    async unlock(){
      // Must be called from a user gesture (click/keydown/touch)
      try{
        const ctx = MP.audio.ensure();
        if (ctx.state === 'running') return 'running';

        // 1) Try resume directly
        try { await ctx.resume(); } catch {}
        if (ctx.state === 'running') return 'running';

        // 2) Nudge the graph with a silent osc burst
        try{
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          g.gain.value = 0.00001; // inaudible
          o.connect(g).connect(MP.audio.master.node);
          o.start();
          o.stop(ctx.currentTime + 0.05);
        }catch{}

        try { await ctx.resume(); } catch {}
        return ctx.state;
      } catch (e){
        console.warn('unlock error', e);
        return 'error';
      }
    },

    async close(){
      if (audioCtx){ try{ await audioCtx.close(); }catch{} closedByPanic=true; MP.ui?.setAudioState?.('closed'); }
    },

    midiToFreq(n){ return 440*Math.pow(2,(n-69)/12); }
  };

  // --- Poly synth ---
  const activeOsc = new Map(); // note → {osc,g}
  MP.audio.activeOsc = activeOsc;

  function envAttackDecay(g, v){
    const ctx=audioCtx, now=ctx.currentTime;
    g.gain.cancelScheduledValues(now);
    const cur=Math.max(0.0001,g.gain.value);
    g.gain.setValueAtTime(cur,now);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001,v), now+0.006);
    g.gain.exponentialRampToValueAtTime(v*0.7, now+0.14);
  }

  MP.audio.startTone = function(note, vel=100){
    MP.audio.ensure();
    const v=Math.max(0.0001, vel/127);
    let h=activeOsc.get(note);
    if (!h){
      const osc=audioCtx.createOscillator();
      osc.type='sawtooth';
      osc.frequency.value = MP.audio.midiToFreq(note);
      const g=audioCtx.createGain();
      g.gain.value=0.0001;
      osc.connect(g).connect(master.node);
      osc.start();
      osc.onended = () => { const cur=activeOsc.get(note); if(cur && cur.osc===osc) activeOsc.delete(note); };
      h={osc,g}; activeOsc.set(note,h);
    }
    envAttackDecay(h.g, v);
  };

  MP.audio.stopTone = function(note, fast=false){
    const h=activeOsc.get(note); if(!h) return;
    activeOsc.delete(note);
    const now=audioCtx.currentTime, t=fast?0.01:0.06;
    h.g.gain.cancelScheduledValues(now);
    h.g.gain.setTargetAtTime(0.0001, now, t);
    try{ h.osc.stop(now+0.1);}catch{}
    setTimeout(()=>{ try{ h.osc.disconnect(); h.g.disconnect(); }catch{} }, 160);
  };

  // --- Drum synths ---
  function envGain(t0,a=0.001,d=0.15){ const g=audioCtx.createGain(); g.gain.setValueAtTime(0.0001,t0); g.gain.exponentialRampToValueAtTime(1.0,t0+a); g.gain.exponentialRampToValueAtTime(0.0001,t0+a+d); return g; }
  function mkNoise(){ const len=audioCtx.sampleRate*2; const b=audioCtx.createBuffer(1,len,audioCtx.sampleRate); const d=b.getChannelData(0); for(let i=0;i<len;i++) d[i]=Math.random()*2-1; return b; }
  let noiseBuf=null; const noise=()=> noiseBuf || (noiseBuf=mkNoise());

  MP.drums = {
    kick(v=100){ MP.audio.ensure(); const t=audioCtx.currentTime, vel=v/127; const o=audioCtx.createOscillator(); o.type='sine'; const g=audioCtx.createGain(); g.gain.setValueAtTime(0.0001,t); o.frequency.setValueAtTime(120+60*vel,t); o.frequency.exponentialRampToValueAtTime(50,t+0.18); g.gain.exponentialRampToValueAtTime(1.2*vel,t+0.008); g.gain.exponentialRampToValueAtTime(0.0001,t+0.22); o.connect(g).connect(master.node); o.start(t); o.stop(t+0.25); },
    snare(v=100){ MP.audio.ensure(); const t=audioCtx.currentTime, vel=v/127; const n=audioCtx.createBufferSource(); n.buffer=noise(); const b=audioCtx.createBiquadFilter(); b.type='bandpass'; b.frequency.value=1800; b.Q.value=0.8; const hg=envGain(t,0.001,0.18); hg.gain.value=0.5+vel*0.8; n.connect(b).connect(hg).connect(master.node); const o=audioCtx.createOscillator(); o.type='triangle'; o.frequency.setValueAtTime(190,t); o.frequency.exponentialRampToValueAtTime(150,t+0.1); const tg=envGain(t,0.001,0.11); tg.gain.value=0.2+vel*0.5; o.connect(tg).connect(master.node); n.start(t); n.stop(t+0.22); o.start(t); o.stop(t+0.16); },
    hat(v=100,open=false){ MP.audio.ensure(); const t=audioCtx.currentTime, vel=v/127; const n=audioCtx.createBufferSource(); n.buffer=noise(); const h=audioCtx.createBiquadFilter(); h.type='highpass'; h.frequency.value=6000; h.Q.value=0.7; const dur=open?0.5:0.07; const g=envGain(t,0.0005,dur); g.gain.value=(open?0.35:0.25)+vel*0.4; n.connect(h).connect(g).connect(master.node); n.start(t); n.stop(t+dur+0.05); },
    tom(v=100,p='low'){ MP.audio.ensure(); const t=audioCtx.currentTime, vel=v/127; const o=audioCtx.createOscillator(); o.type='sine'; const g=envGain(t,0.001,0.25); g.gain.value=0.9*vel; const s=p==='low'?180:p==='mid'?220:260; const e=p==='low'?110:p==='mid'?160:200; o.frequency.setValueAtTime(s,t); o.frequency.exponentialRampToValueAtTime(e,t+0.25); o.connect(g).connect(master.node); o.start(t); o.stop(t+0.3); },
    clap(v=100){ MP.audio.ensure(); const t=audioCtx.currentTime, vel=v/127; for(let i=0;i<3;i++){ const n=audioCtx.createBufferSource(); n.buffer=noise(); const b=audioCtx.createBiquadFilter(); b.type='bandpass'; b.frequency.value=1600; b.Q.value=0.8; const g=envGain(t+i*0.01,0.0005,0.12); g.gain.value=0.5+vel*0.6; n.connect(b).connect(g).connect(master.node); n.start(t+i*0.01); n.stop(t+0.2);} }
  };

  MP.audio.hardClose = async () => { try{ MP.audio.activeOsc.forEach((_,n)=>MP.audio.stopTone(n,true)); }catch{} await MP.audio.close(); };
})(window.MP);
