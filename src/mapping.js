// Central mapping + ranges + helpers (Axiom 25)
// -------------------------------------------------

export const PARAM_RANGES = {
  volume:   {min:-36, max:  6},
  attack:   {min:  0, max:2000},
  decay:    {min:  0, max:3000},
  sustain:  {min:  0, max:   1},
  release:  {min: 10, max:6000},
  cutoff:   {min:150, max:12000},
  q:        {min:0.2, max:  18},
  reverb:   {min:  0, max:   1},
  delay:    {min:  0, max:   1},
  bendRange:{min: 50, max: 400}
};

// GM-ish drum list for pad mapping dropdown
export const DRUM_CHOICES = [
  ['Kick',36], ['Side Stick',37], ['Acoustic Snare',38], ['Hand Clap',39], ['Electric Snare',40],
  ['Low Floor Tom',41], ['Closed Hat',42], ['High Floor Tom',43], ['Mid Tom',45], ['Open Hat',46],
  ['Crash',49], ['Ride',51]
];

export function midiName(n){
  const names=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const o=Math.floor(n/12)-1; return names[n%12]+o;
}

export const MapState = {
  // Default CC mapping for Axiom encoders (K1..K8 → CC16..23)
  ccMap: { cutoff:16, q:17, attack:18, decay:19, sustain:20, reverb:21, delay:22, volume:23 },

  // Runtime
  ccMode: {},   // cc# → 'absolute' | 'relative'
  seen:  {},    // first values seen, for mode detection

  // Your requested default pad order (Pad1..Pad8)
  padNotes: [40,41,42,43,36,37,38,39],
  // Per-pad volume (0..1)
  padGain:  [1, 1, 1, 1, 1, 1, 1, 1],

  // Per-parameter normalized positions (0..1) so relative knobs "hold" values
  paramNorm: {},

  // Parameters that can be mapped from CCs
  ccParams(){ return ['volume','cutoff','q','attack','decay','sustain','release','reverb','delay','bendRange']; },

  // Get/Set normalized value
  getParamNorm(p){ if(this.paramNorm[p]==null){ const r=PARAM_RANGES[p]; this.paramNorm[p] = r ? (0 - r.min) / (r.max - r.min) : 0.5 } return this.paramNorm[p] },
  setParamNorm(p,x){ this.paramNorm[p]=Math.max(0,Math.min(1,x)); },

  // Find which param is listening to a given CC
  paramByCC(cc){ for(const [p,c] of Object.entries(this.ccMap)) if(c===cc) return p; return null },

  // Ensure one-to-one mapping
  setCC(p,cc){ for(const [k,v] of Object.entries(this.ccMap)) if(v===cc && k!==p) delete this.ccMap[k]; this.ccMap[p]=cc },

  // Absolute vs relative
  markCCMode(cc,val){ if(this.ccMode[cc]) return; if(val===63 || val===65) { this.ccMode[cc]='relative'; return } const prev=this.seen[cc]; this.seen[cc]=val; const near64=(x)=>Math.abs(x-64)<=4; this.ccMode[cc] = (prev!=null && near64(val) && near64(prev)) ? 'relative':'absolute' },
  relDelta(val){ if(val===64) return 0; if(val>64) return (val-64); return -(64-val) },

  // Resets
  resetPads(){ this.padNotes=[40,41,42,43,36,37,38,39] },
  resetPadGain(){ this.padGain=[1,1,1,1,1,1,1,1] },
  resetCCs(){ this.ccMap={ cutoff:16, q:17, attack:18, decay:19, sustain:20, reverb:21, delay:22, volume:23 }; this.ccMode={}; this.seen={} }
};
