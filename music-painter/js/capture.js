(function(MP){
  const el = MP.el;
  const recBadge = el('recBadge');
  const btnRec = el('btnRecord');
  const btnStop = el('btnStopRec');
  const btnShot = el('btnScreenshot');

  const recCanvas = document.createElement('canvas');
  const recCtx = recCanvas.getContext('2d');

  function resizeRec(){
    const dpr=Math.max(1,window.devicePixelRatio||1);
    const r=MP.draw.fxCanvas.getBoundingClientRect();
    recCanvas.width=Math.floor(r.width*dpr); recCanvas.height=Math.floor(r.height*dpr);
    recCtx.setTransform(1,0,0,1,0,0);
  }
  window.addEventListener('resize', resizeRec); resizeRec();

  let mediaRecorder=null, chunks=[];
  function start(){
    try{
      MP.audio.ensure(); resizeRec();
      if (!recCanvas.captureStream) throw new Error('Canvas captureStream not supported');
      const streamV=recCanvas.captureStream(60);
      const dest=MP.audio.ctx.createMediaStreamDestination();
      MP.audio.master.node.connect(dest);
      const mixed=new MediaStream([...streamV.getVideoTracks(), ...dest.stream.getAudioTracks()]);
      mediaRecorder=new MediaRecorder(mixed, { mimeType:'video/webm;codecs=vp9,opus' });
      chunks=[];
      mediaRecorder.ondataavailable=e=>{ if (e.data.size) chunks.push(e.data); };
      mediaRecorder.onstop=()=>{
        const blob=new Blob(chunks,{type:'video/webm'}); const url=URL.createObjectURL(blob);
        const a=document.createElement('a'); a.href=url; a.download='music-painter.webm'; a.click();
        setTimeout(()=>URL.revokeObjectURL(url), 1500);
        recBadge.style.display='none'; btnRec.disabled=false; btnRec.textContent='Record'; btnStop.disabled=true;
      };
      mediaRecorder.start();
      recBadge.style.display='inline-block'; btnRec.disabled=true; btnRec.textContent='Recording…'; btnStop.disabled=false;
    }catch(err){ alert('Capture failed: '+err.message); }
  }
  function stop(){ if (mediaRecorder && mediaRecorder.state!=='inactive') mediaRecorder.stop(); }
  function screenshot(){ const tmp=document.createElement('canvas'); tmp.width=recCanvas.width; tmp.height=recCanvas.height; const tctx=tmp.getContext('2d'); MP.draw.compositeTo(tctx); const a=document.createElement('a'); a.download='music-painter.png'; a.href=tmp.toDataURL('image/png'); a.click(); }

  // called every frame by draw loop
  function compositeEachFrame(cb){ cb(recCtx); }

  btnRec.addEventListener('click', start);
  btnStop.addEventListener('click', stop);
  btnShot.addEventListener('click', screenshot);

  MP.capture = { compositeEachFrame };
})(window.MP);
