// Mapping state + helpers with relative/absolute CC support
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));

export const PARAM_RANGES = {
  volume:{min:-36,max:6},
  cutoff:{min:150,max:12000},
  q:{min:0.2,max:18},
  attack:{min:0,max:2000},
  decay:{min:0,max:3000},
  sustain:{min:0,max:1},
  release:{min:10,max:6000},
  reverb:{min:0,max:1},
  delay:{min:0,max:1},
  modDepth:{min:0,max:1}
};

export const MapState = {
  // Parameter → CC number (undefined means unassigned)
  ccMap: {
    cutoff:16, q:17, attack:18, decay:19, sustain:20, release:21, reverb:22, delay:23,
    volume:undefined, modDepth:undefined
  },
  // CC number → mode ('absolute' | 'relative'); detected on first messages
  ccMode: {},
  // Parameter → normalized value (0..1). We keep this so relative encoders "hold" position
  paramValues: {},

  ccParams(){ return Object.keys(PARAM_RANGES) },
  setCC(param,cc){ if(!(param in this.ccMap)) return; this.ccMap[param]=cc },
  paramByCC(cc){ for(const [p,n] of Object.entries(this.ccMap)){ if(n===cc) return p } return null },
  resetCC(){ this.ccMap={ cutoff:16, q:17, attack:18, decay:19, sustain:20, release:21, reverb:22, delay:23, volume:undefined, modDepth:undefined }; this.ccMode={}; },

  // Pads default: Kick, Snare, CH, OH, Clap, LT, HT, Crash
  padNotes:[36,38,42,46,39,41,43,49],
  resetPads(){ this.padNotes=[36,38,42,46,39,41,43,49] },

  // Value helpers
  toValue(param,x){ const r=PARAM_RANGES[param]; return r.min + clamp(x,0,1)*(r.max-r.min) },
  fromValue(param,v){ const r=PARAM_RANGES[param]; return clamp((v-r.min)/(r.max-r.min),0,1) },
  setParamNorm(param,x){ this.paramValues[param]=clamp(x,0,1) },
  getParamNorm(param){ return this.paramValues[param] ?? 0.5 },

  // Relative detection + delta
  markCCMode(cc,val){ if(this.ccMode[cc]) return; // detect once
    if(val===64 || val===63 || val===65) { this.ccMode[cc]='relative'; return; }
    // heuristic: tight cluster around 64 means relative; wide elsewhere → absolute
    this.ccMode[cc] = (val>=60 && val<=68) ? 'relative' : 'absolute';
  },
  relDelta(val){ // two's-complement centered at 64
    if(val===64) return 0; // no change
    return (val-64); // negative for <64; positive for >64
  }
};

export const DRUM_CHOICES = [
  ['Kick',36],['Snare',38],['Clap',39],['Low Tom',41],['Closed Hat',42],['High Tom',43],['Open Hat',46],['Crash',49],['Ride',51],['Mid Tom',45]
];

export function midiName(n){
  const names=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const note = names[n%12]; const oct = Math.floor(n/12)-1; return note+oct;
}