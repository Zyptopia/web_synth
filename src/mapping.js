
// Mapping state + helpers
export const MapState = {
  // CC map: parameter -> cc number
  ccMap: {
    cutoff:16, q:17, attack:18, decay:19, sustain:20, release:21, reverb:22, delay:23,
    volume: undefined, // you can map a knob to master volume if you like
    modDepth: undefined // or map CC to mod depth explicitly
  },
  // Pad notes (default GM-ish): Kick, Snare, CH, OH, Clap, LT, HT, Crash
  padNotes: [36,38,42,46,39,41,43,49],
  ccParams(){ return ['volume','cutoff','q','attack','decay','sustain','release','reverb','delay','modDepth'] },
  setCC(param,cc){ if(!(param in this.ccMap)) return; this.ccMap[param]=cc },
  paramByCC(cc){ for(const [p,n] of Object.entries(this.ccMap)){ if(n===cc) return p } return null },
  resetCC(){ this.ccMap={ cutoff:16, q:17, attack:18, decay:19, sustain:20, release:21, reverb:22, delay:23, volume:undefined, modDepth:undefined } },
  resetPads(){ this.padNotes=[36,38,42,46,39,41,43,49] }
};

export const DRUM_CHOICES = [
  ['Kick',36],['Snare',38],['Clap',39],['Low Tom',41],['Closed Hat',42],['High Tom',43],['Open Hat',46],['Crash',49],['Ride',51],['Mid Tom',45]
];

export function midiName(n){
  const names=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const note = names[n%12]; const oct = Math.floor(n/12)-1; return note+oct;
}

