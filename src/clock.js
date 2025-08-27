// Musical clock with look-ahead scheduling (16th grid)
export class Clock {
  constructor({ctx, bpm=120, ts=[4,4], lookAhead=0.1, tickRateMs=25}){
    this.ctx=ctx; this.bpm=bpm; this.ts=ts; this.look=lookAhead; this.rate=tickRateMs;
    this.playing=false; this._sub=new Map(); this._nextTime=0; this._timer=null;
  }
  on(evt, fn){ (this._sub.get(evt) || this._sub.set(evt,[]).get(evt)).push(fn); }
  _emit(evt, d){ const a=this._sub.get(evt); if(a) a.forEach(f=>{ try{ f(d) }catch(_){/*noop*/} }); }
  _beatSec(){ return 60/this.bpm }
  nowBeats(){ return this.ctx ? (this.ctx.currentTime/this._beatSec()) : 0 }
  play(){ if(this.playing||!this.ctx) return; this.playing=true; const t0=this.ctx.currentTime+0.05; this._nextTime=t0; this._loop(); }
  stop(){ this.playing=false; if(this._timer){clearInterval(this._timer); this._timer=null;} }
  setBpm(b){ this.bpm=Math.max(20,Math.min(300, b||120)); }
  setLoopBars(bars=4){ this.loopBars=Math.max(1,Math.min(64,bars|0)); }
  enableLoop(on){ this.loopOn=!!on }
  _schedule(){ const beat=this._beatSec();
    while(this._nextTime < this.ctx.currentTime + this.look){
      this._emit('tick', { when:this._nextTime, beat });
      this._nextTime += beat/4; // 16th
    }
  }
  _loop(){ this._schedule(); this._timer=setInterval(()=>{ if(this.playing) this._schedule(); }, this.rate); }
}