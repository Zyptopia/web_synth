// /src/looper.js
// MIDI looper (keys & drums), quantized, dynamic loop length
// v3: dynamic loopSec per tick, note-off capture, tiling/folding on length change
export class Looper {
  constructor(clock){
    this.clock = clock;
    this.lenBars = 4;          // current loop length in bars
    this.quant = '1/16';       // record quantization grid
    this.overdub = true;
    this.tracks = { keys: [], drums: [] };
    this._armed = null;
    this._held = new Map();    // active key downs: midi -> startBeat
    this._tickBound = null;    // to avoid duplicate bindings
  }

  _grid(){ return this.quant==='1/8'?2 : this.quant==='1/4'?1 : 4; }
  _spb(){ return 60 / (this.clock?.bpm || 120); }               // seconds per beat
  _toBeats(tAudio){ return tAudio / this._spb(); }
  _wrapBeats(t){ const cyc=this.lenBars*4; return ((t%cyc)+cyc)%cyc; }

  setLength(bars){
    const prev = this.lenBars;
    const next = Math.max(1, Math.min(64, bars|0));
    if (next === prev) { this.lenBars = next; return; }

    // If increasing by exact multiple ⇒ tile
    if (next > prev && (next % prev === 0)) {
      const mult = next / prev;
      const span = prev * 4; // beats
      for (const [track, evs] of Object.entries(this.tracks)) {
        const base = evs.filter(ev => ev.t < span);
        const clones = [];
        for (let k=1;k<mult;k++) {
          for (const ev of base) clones.push({ ...ev, t: ev.t + k*span });
        }
        evs.push(...clones);
      }
    } else if (next < prev) {
      // Shrinking ⇒ fold modulo into new span and de-dup
      const span = next * 4;
      for (const [track, evs] of Object.entries(this.tracks)) {
        const seen = new Set(); const folded = [];
        for (const ev of evs) {
          const t = this._wrapBeats.call({lenBars:next}, ev.t);
          const sig = `${ev.type}|${ev.midi}|${t}`;
          if (!seen.has(sig)) { seen.add(sig); folded.push({ ...ev, t }); }
        }
        this.tracks[track] = folded;
      }
    }
    this.lenBars = next;
  }

  arm(track){ this._armed = track; }
  disarm(){ this._armed = null; }
  clear(track){ if(track) this.tracks[track]=[]; else { this.tracks.keys=[]; this.tracks.drums=[]; } }

  // --- Recording ---
  recordNoteOn(midi, vel, tAudio, track='keys'){
    if (this._armed && this._armed !== track) return;
    const step = 1 / this._grid();
    const t = this._wrapBeats(Math.round(this._toBeats(tAudio)/step)*step);
    this.tracks[track].push({ type:'on', t, midi, vel: vel|0 });
    if (track === 'keys') this._held.set(midi, t);
  }

  recordNoteOff(midi, tAudio, track='keys'){
    if (track !== 'keys') return;
    if (!this._held.has(midi)) return;      // ignore stray off
    const t = this._wrapBeats(this._toBeats(tAudio)); // precise is fine
    this.tracks.keys.push({ type:'off', t, midi });
    this._held.delete(midi);
  }

  // --- Playback: schedule(atAbsSec, ev, track) ---
  play(schedule){
    if (this._tickBound) return; // bind once
    this._tickBound = ({ when }) => {
      const spb = this._spb();
      const stepSec = spb / 4;                       // 16th look-ahead window
      const loopSec = this.lenBars * 4 * spb;        // <-- recomputed every tick
      const loopStart = Math.floor(when/loopSec) * loopSec;

      for (const [track, evs] of Object.entries(this.tracks)) {
        for (const ev of evs) {
          const at = loopStart + ev.t * spb;
          if (at >= when && at < when + stepSec) {
            schedule(at, ev, track);
          }
        }
      }
    };
    this.clock.on('tick', this._tickBound);
  }
}
