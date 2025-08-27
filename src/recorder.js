// Simple MediaRecorder wrapper for master/keys/drums
export class Recorder{
  constructor(ctx, sources){ this.ctx=ctx; this.sources=sources; this.chunks=[]; this.dest=null; this.rec=null; }
  arm(which='master'){ this.stop(); this.chunks=[]; this.dest=this.ctx.createMediaStreamDestination(); (this.sources[which]||this.sources.master).connect(this.dest); this.which=which; return this }
  start(mime='audio/webm;codecs=opus'){ if(!this.dest) this.arm('master'); this.chunks=[]; this.rec=new MediaRecorder(this.dest.stream,{mimeType:mime}); this.rec.ondataavailable=e=>{ if(e.data.size) this.chunks.push(e.data) }; this.rec.onstop=()=>{ const blob=new Blob(this.chunks,{type:mime}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`take-${this.which}.webm`; a.click(); }; this.rec.start(); }
  stop(){ if(this.rec && this.rec.state!=='inactive') this.rec.stop(); this.rec=null; }
}