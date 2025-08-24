// SynthEngine — keyboard + drum engine
// v8.1: SAFE setters, reapply-on-build, keys/drums submix, fixed drum routing,
//       correct per-note pitch, cleaned syntax

export class SynthEngine{
  constructor(){
    this.started=false; this._built=false; this.mode='idle';
    this.presetId='piano'; this.sustain=false; this.bendRange=200;
    // remember UI values set before audio starts
    this._volDb=0; this._keysVol=1; this.cutoff=14000; this.q=0.8; this._revMix=0.18; this._delMix=0.0;
    this.env={a:0.02,d:0.2,s:0.6,r:0.4};
  }

  async start(){
    if(this.started && this.ctx?.state==='running') return true;
    this.ctx = this.ctx || new (window.AudioContext||window.webkitAudioContext)();
    if(this.ctx.state!=='running'){ try{ await this.ctx.resume(); }catch(_){} }
    this.build();
    this.started=true; this.mode='on';
    return this.ctx?.state==='running';
  }

  build(){
    const ctx=this.ctx; if(!ctx) return; if(this._built) return; this._built=true;
    // Nodes
    this.master = ctx.createGain(); this.master.gain.value = 0.8; // dB controlled in app
    // Submixes
    this.instGain = ctx.createGain(); this.instGain.gain.value = 1.0; // keyboard-only
    this.drumGain = ctx.createGain(); this.drumGain.gain.value = 1.0; // drums-only

    // Synth voice path (shared): filter → instGain → comp
    this.filter = ctx.createBiquadFilter(); this.filter.type='lowpass'; this.filter.frequency.value=this.cutoff; this.filter.Q.value=this.q;

    // FX
    this.rev = ctx.createConvolver(); this.revGain = ctx.createGain(); this.revGain.gain.value=this._revMix;
    this.delay = ctx.createDelay(1.0); this.delay.delayTime.value=0.25; this.delayFB=ctx.createGain(); this.delayFB.gain.value=0.25; this.delayGain=ctx.createGain(); this.delayGain.gain.value=this._delMix; this.delay.connect(this.delayFB).connect(this.delay);

    // Master comp
    this.comp = ctx.createDynamicsCompressor(); this.comp.threshold.value=-18; this.comp.knee.value=6; this.comp.ratio.value=2; this.comp.attack.value=0.003; this.comp.release.value=0.24;

    // Wire graph
    this.filter.connect(this.instGain).connect(this.comp);
    this.drumGain.connect(this.comp);
    this.rev.connect(this.revGain).connect(this.comp);
    this.delay.connect(this.delayGain).connect(this.comp);
    this.comp.connect(this.master).connect(ctx.destination);

    // Reverb IR
    this.rev.buffer = this.makeSmallIR(ctx);

    // defaults / state
    this.keyVoices=new Map();
    this.kits = this.makeKits(); this.currentKit=this.currentKit||'standard';

    // Re-apply any values set before start()
    if (this._volDb != null) {
      const lin = Math.pow(10, this._volDb/20);
      this.master.gain.setValueAtTime(lin, ctx.currentTime);
    }
    if (this._keysVol != null) this.instGain.gain.setValueAtTime(this._keysVol, ctx.currentTime);
    if (this.cutoff != null)   this.filter.frequency.setValueAtTime(this.cutoff, ctx.currentTime);
    if (this.q != null)        this.filter.Q.setValueAtTime(this.q, ctx.currentTime);
    if (this._revMix != null)  this.revGain.gain.setValueAtTime(this._revMix, ctx.currentTime);
    if (this._delMix != null)  this.delayGain.gain.setValueAtTime(this._delMix, ctx.currentTime);
  }

  // ---- Controls (safe even before start) ----
  setVolume(db){
    this._volDb = db; // remember
    if (this.master && this.ctx) {
      const lin = Math.pow(10, db/20);
      this.master.gain.setTargetAtTime(lin, this.ctx.currentTime, 0.01);
    }
  }
  setKeysVolume(v){
    this._keysVol = Math.max(0, Math.min(1, v));
    if (this.instGain && this.ctx) {
      this.instGain.gain.setTargetAtTime(this._keysVol, this.ctx.currentTime, 0.01);
    }
  }
  setBendRange(cents){ this.bendRange=cents }
  setEnv(a,d,s,r){ this.env={a:a/1000,d:d/1000,s, r:r/1000} }
  setCutoff(hz){
    this.cutoff = hz;
    if (this.filter && this.ctx) this.filter.frequency.setTargetAtTime(hz, this.ctx.currentTime, 0.01);
  }
  setQ(q){
    this.q = q;
    if (this.filter && this.ctx) this.filter.Q.setTargetAtTime(q, this.ctx.currentTime, 0.01);
  }
  setReverb(mix){
    this._revMix = Math.max(0,Math.min(1,mix));
    if (this.revGain && this.ctx) this.revGain.gain.setTargetAtTime(this._revMix, this.ctx.currentTime, 0.01);
  }
  setDelay(mix){
    this._delMix = Math.max(0,Math.min(1,mix));
    if (this.delayGain && this.ctx) this.delayGain.gain.setTargetAtTime(this._delMix, this.ctx.currentTime, 0.01);
  }
  setBendRangeSemis(semi){ this.bendRange = semi*100 }

  test(){ if(!this.ctx) return; const ctx=this.ctx; const o=ctx.createOscillator(); const g=ctx.createGain(); o.type='sine'; o.frequency.value=880; g.gain.value=0.1; o.connect(g).connect(this.master); o.start(); o.stop(ctx.currentTime+0.15) }

  // ---- Synth voices ----
  noteOn(midi, v=0.8){
    if(!this.ctx) return;
    const ctx=this.ctx; const t=ctx.currentTime; const f=440*Math.pow(2,(midi-69)/12);
    const o=ctx.createOscillator(); o.type = (this.preset?.osc) || 'sawtooth';
    o.frequency.setValueAtTime(f, t); // per-note base pitch

    const lfo=ctx.createOscillator(); lfo.type='sine'; lfo.frequency.value=5;
    const lfg=ctx.createGain(); lfg.gain.value=0.002*f; lfo.connect(lfg).connect(o.frequency);

    const g=ctx.createGain(); g.gain.setValueAtTime(0, t); // ADSR
    g.gain.linearRampToValueAtTime(0.8*v, t+this.env.a);
    g.gain.linearRampToValueAtTime(this.env.s*0.8*v, t+this.env.a+this.env.d);

    o.connect(g).connect(this.filter);
    o.start(t); lfo.start(t);
    this.keyVoices.set(midi,{o,g,lfo});
  }

  noteOff(midi){
    if(!this.ctx) return;
    const v=this.keyVoices.get(midi); if(!v) return; const t=this.ctx.currentTime;
    v.g.gain.cancelScheduledValues(t);
    v.g.gain.setValueAtTime(v.g.gain.value, t);
    v.g.gain.exponentialRampToValueAtTime(0.0001, t+this.env.r);
    v.o.stop(t+this.env.r+0.02);
    if(v.lfo) v.lfo.stop(t+this.env.r+0.02);
    this.keyVoices.delete(midi);
  }

  releaseAll(){ for(const [m] of [...this.keyVoices]){ this.noteOff(m) } }
  bendTo(cents){ /* placeholder: vibrato already present */ }
  setSustain(on){ this.sustain=on }

  // ---- Drums ----
  setDrumKit(id){ if(this.kits?.[id]) this.currentKit=id }
  triggerDrum(midi, vel01=0.9, padGain=1){
    if(!this.ctx) return; const ctx=this.ctx; const v=Math.max(0.01, Math.min(1, vel01))*padGain; const now=()=>ctx.currentTime; const out=this.drumGain; const P=this.kits[this.currentKit];
    const hitGain=ctx.createGain(); hitGain.gain.value=0.9*v; hitGain.connect(out);
    const send=ctx.createGain(); send.gain.value=0.18*v; hitGain.connect(send).connect(this.rev);

    const mkNoise=(dur)=>{ const buf=ctx.createBuffer(1, Math.max(1,Math.floor(ctx.sampleRate*dur)), ctx.sampleRate); const d=buf.getChannelData(0); for(let i=0;i<d.length;i++){ d[i]=(Math.random()*2-1)*0.7 } const n=ctx.createBufferSource(); n.buffer=buf; return n };
    const env=(a,d,s,r,amp=1)=>{ const g=ctx.createGain(); const t=now(); g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(amp,t+a); g.gain.exponentialRampToValueAtTime(0.0001, t+a+d+r); return {g,t} };

    const kick=(base,dec,click)=>{ const o=ctx.createOscillator(); o.type='sine'; o.frequency.setValueAtTime(base, now()); o.frequency.exponentialRampToValueAtTime(Math.max(30, base*0.33), now()+0.12); const {g,t}=env(0.001,0.05,0.0001,dec,1.2*v); o.connect(g).connect(hitGain); if(click>0){ const n=mkNoise(0.02), hp=ctx.createBiquadFilter(), cg=ctx.createGain(); hp.type='highpass'; hp.frequency.value=3000; cg.gain.value=0.15*v*click; n.connect(hp).connect(cg).connect(hitGain); n.start(t); n.stop(t+0.03);} o.start(); o.stop(now()+dec+0.05); };
    const snare=(tone,noiseAmt)=>{ const {g,t}=env(0.001,0.06,0.0001,0.12,0.9*v); const o=ctx.createOscillator(); o.type='triangle'; o.frequency.setValueAtTime(tone, t); o.connect(g).connect(hitGain); const n=mkNoise(0.3), bp1=ctx.createBiquadFilter(), bp2=ctx.createBiquadFilter(), hp=ctx.createBiquadFilter(), ng=ctx.createGain(); bp1.type='bandpass'; bp1.frequency.value=tone; bp1.Q.value=1.0; bp2.type='bandpass'; bp2.frequency.value=tone*2; bp2.Q.value=0.7; hp.type='highpass'; hp.frequency.value=900; ng.gain.value=0.5*noiseAmt*v; n.connect(hp).connect(bp1).connect(ng).connect(hitGain); n.connect(bp2).connect(ng); n.start(t); n.stop(t+0.15); o.start(t); o.stop(t+0.14); };
    const sidestick=()=>{ const {g,t}=env(0.001,0.03,0,0.08,0.8*v); const n=mkNoise(0.08), hp=ctx.createBiquadFilter(), bp=ctx.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=1200; bp.type='bandpass'; bp.frequency.value=1800; bp.Q.value=2.0; n.connect(hp).connect(bp).connect(g).connect(hitGain); n.start(t); n.stop(t+0.08); };
    const clap=()=>{ const baseT=now(); const mk=(dt)=>{ const n=mkNoise(0.12), hp=ctx.createBiquadFilter(), bp=ctx.createBiquadFilter(), g=ctx.createGain(); hp.type='highpass'; hp.frequency.value=1200; bp.type='bandpass'; bp.frequency.value=2000; bp.Q.value=1.2; g.gain.setValueAtTime(0, baseT+dt); g.gain.linearRampToValueAtTime(0.6*v, baseT+dt+0.002); g.gain.exponentialRampToValueAtTime(0.0001, baseT+dt+0.09); n.connect(hp).connect(bp).connect(g).connect(hitGain); n.start(baseT+dt); n.stop(baseT+dt+0.12); }; mk(0); mk(0.02); mk(0.04); };
    const hat=(open=false)=>{ const n=mkNoise(open?0.35:0.08), hp=ctx.createBiquadFilter(), hg=ctx.createGain(); hp.type='highpass'; hp.frequency.value=P.hatHP; hg.gain.value=(open?0.22:0.32)*v; n.connect(hp).connect(hg).connect(hitGain); const t=now(); n.start(t); n.stop(t+(open?0.30:0.05)); };
    const tom=(freq)=>{ const o=ctx.createOscillator(); o.type='sine'; const {g,t}=env(0.001,0.04,0,0.22,0.8*v); o.frequency.setValueAtTime(freq,t); o.connect(g).connect(hitGain); o.start(t); o.stop(t+0.26); };
    const crash=()=>{ const n=mkNoise(0.9), hp=ctx.createBiquadFilter(), g=ctx.createGain(); hp.type='highpass'; hp.frequency.value=P.crash; g.gain.value=0.22*v; n.connect(hp).connect(g).connect(hitGain); const t=now(); n.start(t); n.stop(t+0.9); };

    switch(midi){
      case 36: kick(P.kick, 0.22, 0.7); break;
      case 37: sidestick(); break;
      case 38: snare(P.snare, 1.0); break;
      case 39: clap(); break;
      case 40: tom(P.tomL); break;
      case 41: tom(P.tomM); break;
      case 42: hat(false); break;
      case 43: tom(P.tomH); break;
      case 46: hat(true); break;
      case 49: crash(); break;
      default: snare(P.snare,0.8); break;
    }
  }

  setPreset(id,p){
    this.presetId = id;
    // merge with defaults so missing fields don't break
    const def={osc:'sawtooth', env:null, cutoff:null, q:null, reverb:null, delay:null};
    this.preset = Object.assign(def, p||{});
    // push preset params into engine immediately
    if(this.preset.env){ const {a=10,d=200,s=0.6,r=300}=this.preset.env; this.setEnv(a,d,s,r); }
    if(this.preset.cutoff!=null) this.setCutoff(this.preset.cutoff);
    if(this.preset.q!=null)      this.setQ(this.preset.q);
    if(this.preset.reverb!=null) this.setReverb(this.preset.reverb);
    if(this.preset.delay!=null)  this.setDelay(this.preset.delay);
  }

  // ---- small IR
  makeSmallIR(ctx){ if(!ctx) return null; const len=(ctx.sampleRate*1.2)|0; const buf=ctx.createBuffer(2,len,ctx.sampleRate); for(let ch=0;ch<2;ch++){ const d=buf.getChannelData(ch); for(let i=0;i<len;i++){ const t=i/ctx.sampleRate; d[i]=(Math.random()*2-1)*Math.pow(1-t/1.2,3)*0.4 } } return buf }

  makeKits(){ return {
    standard:{ kick:80, snare:190, hatHP:8000, crash:4500, tomL:110, tomM:150, tomH:200 },
    '808':   { kick:55, snare:180, hatHP:10000, crash:5000, tomL:90,  tomM:130, tomH:180 },
    electro: { kick:70, snare:220, hatHP:9000, crash:5200, tomL:120, tomM:170, tomH:220 },
    room:    { kick:85, snare:200, hatHP:7000, crash:4200, tomL:120, tomM:165, tomH:210 },
    trap:    { kick:50, snare:220, hatHP:11000, crash:6000, tomL:95,  tomM:140, tomH:190 },
    lofi:    { kick:65, snare:170, hatHP:6000, crash:3800, tomL:105, tomM:145, tomH:195 },
    cr78:    { kick:72, snare:160, hatHP:7500, crash:0,    tomL:130, tomM:170, tomH:210 },
    dnb:     { kick:90, snare:210, hatHP:9500, crash:5200, tomL:140, tomM:185, tomH:230 },
  } }
}
