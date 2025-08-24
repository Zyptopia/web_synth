// SynthEngine — poly synth + expanded drum kits (no samples)
// ----------------------------------------------------------
export const midiToFreq = m=>440*Math.pow(2,(m-69)/12);
const dB = g=>Math.pow(10,g/20);
const now = (ctx)=>ctx.currentTime;

function makeIR(ctx,seconds=1.8,decay=2.2){
  const rate=ctx.sampleRate,len=rate*seconds,buf=ctx.createBuffer(2,len,rate);
  for(let c=0;c<2;c++){
    const ch=buf.getChannelData(c);
    for(let i=0;i<len;i++) ch[i]=(Math.random()*2-1)*Math.pow(1-i/len,decay);
  }
  return buf;
}

export class SynthEngine{
  constructor(){
    this.mode='webaudio';
    this.ctx=null; this.comp=null; this.master=null; this.filter=null; this.rev=null; this.revGain=null; this.del=null; this.delGain=null; this.fb=null;
    this.env={a:0.02,d:0.2,s:0.6,r:0.4};
    this.cutoff=4500; this.q=0.8; this.volume=-6; this.bend=0; this.bendRange=200; this.modDepth=0;
    this.voices=new Map(); this.sustain=false; this.sustained=new Set(); this.preset='piano'; this.mono=false;
    this.drumKit='standard';
  }
  init(){ if(this.ctx) return; const AC=window.AudioContext||window.webkitAudioContext; this.ctx=new AC();
    const ctx=this.ctx;
    this.comp=ctx.createDynamicsCompressor(); this.comp.threshold.value=-16; this.comp.ratio.value=3; this.comp.attack.value=0.003; this.comp.release.value=0.25;
    this.master=ctx.createGain(); this.master.gain.value=dB(this.volume); this.comp.connect(this.master).connect(ctx.destination);
    this.filter=ctx.createBiquadFilter(); this.filter.type='lowpass'; this.filter.frequency.value=this.cutoff; this.filter.Q.value=this.q;
    const dry=ctx.createGain(); dry.gain.value=1; this.filter.connect(dry).connect(this.comp);
    this.rev=ctx.createConvolver(); this.rev.buffer=makeIR(ctx); this.revGain=ctx.createGain(); this.revGain.gain.value=0.22; this.filter.connect(this.rev); this.rev.connect(this.revGain).connect(this.comp);
    this.del=ctx.createDelay(1.0); this.del.delayTime.value=0.25; this.fb=ctx.createGain(); this.fb.gain.value=0.28; this.delGain=ctx.createGain(); this.delGain.gain.value=0.12; this.filter.connect(this.del); this.del.connect(this.fb).connect(this.del); this.del.connect(this.delGain).connect(this.comp);
    ctx.onstatechange=()=>this.onState?.(ctx.state);
  }
  async start(){ this.init(); await this.ctx.resume(); return this.ctx.state==='running' }

  // ----------- Synth voice -----------
  setPreset(id,def){ this.preset=id; this.mono=!!def?.mono; this.setOscType(def?.osc||'triangle'); this.setEnv(def?.env?.a*1000||20, def?.env?.d*1000||200, def?.env?.s??0.6, def?.env?.r*1000||400); this.setCutoff(def?.filt?.cut??4500); this.setQ(def?.filt?.q??0.8); this.setReverb(def?.fx?.rev??0.2); this.setDelay(def?.fx?.delay??0.1); }
  setOscType(t){ this._oscType=t }
  setEnv(aMs,dMs,s,rMs){ Object.assign(this.env,{a:aMs/1000,d:dMs/1000,s,r:rMs/1000}) }
  setCutoff(v){ this.cutoff=v; if(this.filter) this.filter.frequency.value=v }
  setQ(v){ this.q=v; if(this.filter) this.filter.Q.value=v }
  setVolume(db){ this.volume=db; if(this.master) this.master.gain.value=dB(db) }
  setReverb(w){ if(this.revGain) this.revGain.gain.value=w }
  setDelay(w){ if(this.delGain) this.delGain.gain.value=w }
  setBendRange(c){ this.bendRange=c }
  setModDepth(x){ this.modDepth=x }
  setSustain(on){ this.sustain=on; if(!on){ for(const m of Array.from(this.sustained)) this._releaseNow(m); this.sustained.clear() } }

  _voiceFor(midi,vel){ const ctx=this.ctx,t=now(ctx); const g=ctx.createGain(); g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(Math.max(0.1,vel), t+this.env.a); g.gain.linearRampToValueAtTime(Math.max(0.001,this.env.s), t+this.env.a+this.env.d);
    const osc=ctx.createOscillator(); const type=this._oscType||'triangle'; osc.type=type; osc.frequency.value=midiToFreq(midi); osc.detune.value=this.bend;
    const lfo=ctx.createOscillator(); lfo.frequency.value=5; const lfoGain=ctx.createGain(); lfoGain.gain.value=this.modDepth*50; lfo.connect(lfoGain).connect(osc.detune); lfo.start();
    osc.connect(g).connect(this.filter); osc.start(); return {osc,g,lfo}; }
  noteOn(midi,vel01=0.7){ this.init(); if(this.preset==='drum'){ this.triggerDrum(midi,vel01); return }
    if(this.mono){ for(const m of Array.from(this.voices.keys())) this._releaseNow(m); }
    const v=this._voiceFor(midi,vel01); this.voices.set(midi,v);
  }
  noteOff(midi){ if(this.sustain){ this.sustained.add(midi); return } this._releaseNow(midi) }
  _releaseNow(midi){ const v=this.voices.get(midi); if(!v) return; const t=now(this.ctx); v.g.gain.cancelScheduledValues(t); v.g.gain.setTargetAtTime(0,t, Math.max(0.01,this.env.r)); const stopAt=t+this.env.r+0.05; try{v.osc.stop(stopAt); v.lfo.stop(stopAt)}catch{} setTimeout(()=>{ try{v.osc.disconnect(); v.g.disconnect()}catch{} }, (this.env.r+0.1)*1000); this.voices.delete(midi) }
  releaseAll(){ for(const m of Array.from(this.voices.keys())) this._releaseNow(m) }
  bendTo(cents){ this.bend=cents; for(const v of this.voices.values()){ try{v.osc.detune.value=cents}catch{} } }

  // ----------- Drum engine -----------
  setDrumKit(id){ this.drumKit=id }

  triggerDrum(midi,vel){ this.init(); const ctx=this.ctx, t=now(ctx); const kit=this.drumKit||'standard';
    const mkNoise=(dur)=>{const len=ctx.sampleRate*dur,buf=ctx.createBuffer(1,len,ctx.sampleRate),ch=buf.getChannelData(0);for(let i=0;i<len;i++) ch[i]=(Math.random()*2-1); const src=ctx.createBufferSource(); src.buffer=buf; return src};
    const out=this.comp;

    // Per-kit tunings
    const KITS={
      standard:{kick:{base:120,dec:0.25,click:0}, snare:{tone:1800,noise:0.22}, hpfHat:6000, clap:true, tom:[160,200], crash:2500},
      room:{    kick:{base:75, dec:0.35,click:0},  snare:{tone:1600,noise:0.25}, hpfHat:5200, clap:true, tom:[170,210], crash:2500},
      electro:{ kick:{base:95, dec:0.22,click:1},  snare:{tone:2200,noise:0.18}, hpfHat:6500, clap:true, tom:[200,260], crash:2800},
      '808':{  kick:{base:55, dec:0.55,click:0},   snare:{tone:1800,noise:0.22}, hpfHat:8000, clap:true, tom:[140,180], crash:4000},
      trap:{   kick:{base:48, dec:0.75,click:0},   snare:{tone:2000,noise:0.20}, hpfHat:9000, clap:true, tom:[150,190], crash:5000},
      lofi:{   kick:{base:80, dec:0.28,click:0},   snare:{tone:1200,noise:0.35}, hpfHat:4200, clap:true, tom:[150,190], crash:2200},
      cr78:{   kick:{base:100,dec:0.18,click:1},   snare:{tone:1500,noise:0.15}, hpfHat:5000, clap:false,tom:[150,180], crash:3000},
      dnb:{    kick:{base:85, dec:0.20,click:1},   snare:{tone:2000,noise:0.30}, hpfHat:10000,clap:false,tom:[180,220], crash:5500}
    };
    const P=KITS[kit]||KITS.standard;

    const kick=(base,dec,click)=>{ const o=ctx.createOscillator(), g=ctx.createGain(); o.type='sine'; o.frequency.setValueAtTime(base,t); o.frequency.exponentialRampToValueAtTime(Math.max(30,base*0.33),t+0.12); if(click){ const n=mkNoise(0.02), hp=ctx.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=3000; const cg=ctx.createGain(); cg.gain.value=0.2*vel; n.connect(hp).connect(cg).connect(out); n.start(t); n.stop(t+0.03);} g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(1.1*vel,t+0.004); g.gain.exponentialRampToValueAtTime(0.0001,t+dec); o.connect(g).connect(out); o.start(t); o.stop(t+dec+0.05) };
    const snare=(tone,noise)=>{ const n=mkNoise(noise), bp=ctx.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=tone; const g=ctx.createGain(); g.gain.value=0.8*vel; n.connect(bp).connect(g).connect(out); n.start(t); n.stop(t+noise) };
    const hat=(open=false)=>{ const n=mkNoise(open?0.28:0.06); const hp=ctx.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=P.hpfHat; const g=ctx.createGain(); g.gain.value=(open?0.28:0.36)*vel; n.connect(hp).connect(g).connect(out); n.start(t); n.stop(t+(open?0.28:0.06)) };
    const clap=()=>{ if(!P.clap){ snare(P.snare.tone*0.9,0.12); return } const n=mkNoise(0.15), hp=ctx.createBiquadFilter(), g=ctx.createGain(); hp.type='highpass'; hp.frequency.value=1500; g.gain.value=0.6*vel; n.connect(hp).connect(g).connect(out); n.start(t); n.stop(t+0.15) };
    const tom=(freq)=>{ const o=ctx.createOscillator(), g=ctx.createGain(); o.type='sine'; o.frequency.setValueAtTime(freq,t); g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(0.75*vel,t+0.005); g.gain.exponentialRampToValueAtTime(0.0001,t+0.28); o.connect(g).connect(out); o.start(t); o.stop(t+0.3) };
    const crash=()=>{ const n=mkNoise(0.8), hp=ctx.createBiquadFilter(), g=ctx.createGain(); hp.type='highpass'; hp.frequency.value=P.crash; g.gain.value=0.28*vel; n.connect(hp).connect(g).connect(out); n.start(t); n.stop(t+0.8) };

    switch(midi){
      case 36: kick(P.kick.base,P.kick.dec,P.kick.click); break; // kick
      case 37: snare(P.snare.tone*0.7,0.12); break;             // side stick-ish
      case 38: snare(P.snare.tone,P.snare.noise); break;        // main snare
      case 39: clap(); break;                                   // clap
      case 40: snare(P.snare.tone*1.1,0.20); break;             // el. snare
      case 41: tom(P.tom[0]); break;                            // low tom
      case 42: hat(false); break;                               // closed hat
      case 43: tom(P.tom[1]); break;                            // high floor tom
      case 45: tom((P.tom[0]+P.tom[1])/2); break;               // mid tom
      case 46: hat(true); break;                                // open hat
      case 49: crash(); break;                                  // crash
      case 51: crash(); break;                                  // ride (reuse)
      default: hat(false);                                      // fallback
    }
  }

  test(){ this.init(); const o=this.ctx.createOscillator(), g=this.ctx.createGain(); g.gain.value=0.12; o.frequency.value=880; o.connect(g).connect(this.ctx.destination); o.start(); setTimeout(()=>{try{o.stop()}catch{}},160) }
}
