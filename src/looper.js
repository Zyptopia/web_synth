// Minimal MIDI looper (keys & drums), quantized, loop length in bars
export class Looper {
  constructor(clock){ this.clock=clock; this.lenBars=4; this.quant='1/16'; this.overdub=true; this.tracks={keys:[], drums:[]}; this._armed=null; }
  setLength(bars){ this.lenBars=Math.max(1,Math.min(64,bars|0)); }
  arm(track){ this._armed=track; }
  disarm(){ this._armed=null; }
  clear(track){ if(track) this.tracks[track]=[]; else { this.tracks.keys=[]; this.tracks.drums=[]; } }
  _grid(){ return this.quant==='1/8'?2: (this.quant==='1/4'?1:4); } // 16ths by default
  _secPerBeat(){ return 60/this.clock.bpm }
  _toBeats(tAudio){ return tAudio/this._secPerBeat(); }
  _wrapBeats(t){ const cyc=this.lenBars*4; return ((t%cyc)+cyc)%cyc }
  recordNoteOn(midi, vel, tAudio, track='keys'){
    if(this._armed && this._armed!==track) return;
    const step=1/this._grid(); const t=this._wrapBeats(Math.round(this._toBeats(tAudio)/step)*step);
    this.tracks[track].push({type:'on', t, midi, vel});
  }
  // Playback: call with schedule(whenAbsSec, event, track)
  play(schedule){
    const secPerBeat=this._secPerBeat(); const stepSec=secPerBeat/4;
    this.clock.on('tick', ({when})=>{
      const loopSec = this.lenBars*4*secPerBeat; // <-- use current length
      const loopStart = Math.floor(when/loopSec)*loopSec;
      for(const [track,evs] of Object.entries(this.tracks)){
        for(const ev of evs){ const at=loopStart + ev.t*secPerBeat; if(at>=when && at<when+stepSec){ schedule(at, ev, track); } }
      }
    });
  }
}