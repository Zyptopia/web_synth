// draw.js (FULL REPLACEMENT, zoom-on-resize fixed)
(function(MP){
  const el = MP.el;
  const stageWrap = el('stageWrap');
  const fxCanvas = el('fxCanvas');
  const fxCtx = fxCanvas.getContext('2d');

  // Base “baked” canvas
  const baseCanvas = document.createElement('canvas');
  baseCanvas.className='layerCanvas'; baseCanvas.style.zIndex=0; stageWrap.prepend(baseCanvas);
  const baseCtx = baseCanvas.getContext('2d');

  // Long-lived additive accent canvas
  const accentCanvas = document.createElement('canvas');
  accentCanvas.className='layerCanvas'; accentCanvas.style.zIndex=9; stageWrap.appendChild(accentCanvas);
  const accentCtx = accentCanvas.getContext('2d');

  const layers=[]; let activeLayer=0;

  // --------- resize helpers (preserve pixels, no compounding zoom) ----------
  function copyWithIdentity(ctx, prev, dstW, dstH){
    // copy device→device pixels using identity transform to avoid re-scaling
    ctx.setTransform(1,0,0,1,0,0);
    if (prev && prev.width && prev.height){
      ctx.drawImage(prev, 0,0, prev.width, prev.height, 0,0, dstW, dstH);
    }
  }
  function preserveResize(c){
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const r = stageWrap.getBoundingClientRect();

    const prevW = c.width, prevH = c.height;
    let prev = null;
    if (prevW && prevH){
      prev = document.createElement('canvas');
      prev.width = prevW; prev.height = prevH;
      try { prev.getContext('2d').drawImage(c, 0, 0); } catch {}
    }

    const newW = Math.floor(r.width * dpr);
    const newH = Math.floor(r.height * dpr);
    c.width = newW; c.height = newH;
    c.style.width = r.width + 'px';
    c.style.height = r.height + 'px';

    const ctx = c.getContext('2d');
    // 1) copy previous pixels 1:1 in device space
    copyWithIdentity(ctx, prev, newW, newH);
    // 2) now switch to CSS-pixel coordinates for future drawing
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  function resizeBase(){ preserveResize(baseCanvas); }
  function resizeFx(){
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const r = stageWrap.getBoundingClientRect();

    const prevW = fxCanvas.width, prevH = fxCanvas.height;
    let prev = null;
    if (prevW && prevH){
      prev = document.createElement('canvas');
      prev.width = prevW; prev.height = prevH;
      try { prev.getContext('2d').drawImage(fxCanvas,0,0); } catch {}
    }

    const newW = Math.floor(r.width * dpr);
    const newH = Math.floor(r.height * dpr);
    fxCanvas.width  = newW;
    fxCanvas.height = newH;
    fxCanvas.style.width = r.width + 'px';
    fxCanvas.style.height = r.height + 'px';

    // 1) copy previous pixels 1:1 in device space
    copyWithIdentity(fxCtx, prev, newW, newH);
    // 2) switch to CSS-pixel coordinates
    fxCtx.setTransform(dpr,0,0,dpr,0,0);
  }
  function resizeAccent(){ preserveResize(accentCanvas); }
  function resizeAll(){
    resizeBase();
    resizeFx();
    resizeAccent();
    layers.forEach(l => preserveResize(l.canvas));
    updateCenter();
  }

  // --------- layer ops ----------
  function createLayer(){
    const c=document.createElement('canvas');
    c.className='layerCanvas';
    c.style.zIndex=1+layers.length;
    stageWrap.appendChild(c);
    const ctx=c.getContext('2d');
    ctx.lineCap='round'; ctx.lineJoin='round';
    preserveResize(c);
    layers.push({canvas:c, ctx, blend:'source-over', opacity:1});
    MP.ui?.updateLayerSelect?.(layers, activeLayer);
    selectLayer(layers.length-1);
  }
  function selectLayer(i){ activeLayer=Math.max(0,Math.min(i,layers.length-1)); MP.ui?.onSelectLayer?.(layers, activeLayer); }
  function deleteLayer(){ if(layers.length<=1) return; const {canvas}=layers[activeLayer]; canvas.remove(); layers.splice(activeLayer,1); selectLayer(Math.max(0,activeLayer-1)); }
  function clearLayer(){ const {canvas,ctx}=layers[activeLayer]; ctx.clearRect(0,0,canvas.width,canvas.height); }
  function freezeArtwork(){
    const prev=baseCtx.globalCompositeOperation; baseCtx.globalCompositeOperation='source-over';
    layers.forEach(l=>baseCtx.drawImage(l.canvas,0,0)); baseCtx.globalCompositeOperation=prev;
    layers.forEach(l=>l.ctx.clearRect(0,0,l.canvas.width,l.canvas.height));
  }
  function compositeTo(ctx){
    ctx.save(); ctx.setTransform(1,0,0,1,0,0); ctx.fillStyle='#0b0f14';
    ctx.fillRect(0,0,ctx.canvas.width,ctx.canvas.height);
    ctx.drawImage(baseCanvas,0,0);
    layers.forEach(l=>ctx.drawImage(l.canvas,0,0));
    ctx.drawImage(accentCanvas,0,0);
    ctx.drawImage(fxCanvas,0,0);
    ctx.restore();
  }

  // --------- center cache ----------
  const stageSize={w:0,h:0,cx:0,cy:0};
  function updateCenter(){ const r=stageWrap.getBoundingClientRect(); stageSize.w=r.width; stageSize.h=r.height; stageSize.cx=r.width/2; stageSize.cy=r.height/2; }

  // --------- pen + colour ----------
  const pen={x:0,y:0,px:0,py:0};
  function centerPen(){ updateCenter(); pen.x=stageSize.cx; pen.y=stageSize.cy; pen.px=pen.x; pen.py=pen.y; }
  function getPen(){ return {x:pen.x, y:pen.y}; }

  // colour helpers
  function hexToHsl(hex){ const r=parseInt(hex.slice(1,3),16)/255, g=parseInt(hex.slice(3,5),16)/255, b=parseInt(hex.slice(5,7),16)/255; const M=Math.max(r,g,b), m=Math.min(r,g,b); let h,s,l=(M+m)/2; if(M===m){h=s=0;} else { const d=M-m; s=l>0.5? d/(2-M-m) : d/(M+m); switch(M){case r:h=(g-b)/d+(g<b?6:0);break;case g:h=(b-r)/d+2;break;case b:h=(r-g)/d+4;break;} h/=6; } return {h:h*360,s:s*100,l:l*100}; }
  function computeHue(hueFromNotes, velocity){
    const mode=MP.ui.colorMode(); const base=hexToHsl(MP.ui.colorPick());
    let h=hueFromNotes;
    if (mode==='fixed') h=base.h;
    if (mode==='offset') h=(hueFromNotes+MP.ui.hueOffset())%360;
    if (mode==='vel') h=(base.h + (velocity/127)*140)%360;
    return (h+360)%360;
  }

  // --------- flow helpers ----------
  const CONSONANT_PCS=new Set([0,3,4,5,7,8,9]);
  function chordConsonance(notes){
    const pcs=Array.from(notes).map(MP.pc); let c=0,d=0;
    for(let i=0;i<pcs.length;i++) for(let j=i+1;j<pcs.length;j++){
      const iv=Math.min((pcs[j]-pcs[i]+12)%12,(pcs[i]-pcs[j]+12)%12);
      if (CONSONANT_PCS.has(iv)) c++; else d++;
    }
    const tot=c+d; return tot? c/tot : 0;
  }
  const baseAngle = n => (n*2.399963229728653 + MP.ui.flowPhase()) % (Math.PI*2);
  const harmAngle = n => (((MP.pc(n)*7)%12) * (2*Math.PI/12));

  // --------- Drum FX (subtle + long-lived accents) ----------
  const effects=[];            // fast/transient (fxCanvas)
  const accents=[];            // long-lived additive (accentCanvas)
  const influence={scatter:0,spin:0,center:0,ybias:0};
  const MAX_RING = 180;
  const MAX_BLOOM = 160;

  function addAccent(obj){ accents.push(obj); }

  MP.drawFX = {
    kick(x,y,v){ addAccent({type:'bloom',x,y,r:10,a:0.18+0.28*(v/127),h:(x*0.2+y*0.1)%360,grow:1.1,fade:0.004}); influence.center += 0.015*(v/127); },
    snare(x,y,v){ const count=16; for(let i=0;i<count;i++){ const ang=Math.random()*Math.PI*2; const sp=0.5+Math.random()*1.1; addAccent({type:'confetti',x,y,vx:Math.cos(ang)*sp,vy:Math.sin(ang)*sp,a:0.10+0.16*(v/127),life:1+Math.random()*0.8,h:(ang*180/Math.PI)%360}); } influence.scatter += 1.2*(v/127); },
    hat(x,y,v,open){ const n=open?20:12; for(let i=0;i<n;i++){ const ang=Math.random()*Math.PI*2; const sp=open?1.2:0.9; addAccent({type:'sparkle',x,y,vx:Math.cos(ang)*sp,vy:Math.sin(ang)*sp,a:0.14+0.18*(v/127),life:open?1.3:0.8}); } },
    tom(x,y,v,which){ addAccent({type:'ribbon',x,y,t:0,a:0.18+0.24*(v/127),dir:(which==='hi')?-1:1,h:(which==='hi')?290:230}); influence.spin += 0.035*(v/127); },
    clap(x,y,v){ for(let i=0;i<2;i++){ addAccent({type:'ring',x,y,r:8+i*10,a:0.16+0.22*(v/127),grow:0.55,fade:0.006}); } influence.scatter += 0.8*(v/127); }
  };

  // transient fx
  function drawFX(dt){
    fxCtx.save(); fxCtx.globalCompositeOperation='destination-out';
    fxCtx.fillStyle=`rgba(0,0,0,${0.10*dt*60})`; fxCtx.fillRect(0,0,fxCanvas.width,fxCanvas.height);
    fxCtx.restore();
    effects.forEach((e,i)=>{ if (e.type==='glint'){ e.x+=e.vx*(dt*60); e.y+=e.vy*(dt*60); e.life-=dt; if (e.life<=0){ effects.splice(i,1); return; } fxCtx.save(); fxCtx.globalCompositeOperation='lighter'; fxCtx.fillStyle=`hsla(50,100%,80%,${e.a})`; fxCtx.fillRect(e.x-1,e.y-1,2,2); fxCtx.restore(); } });
  }

  // long-lived accents
  function drawAccents(dt){
    accentCtx.save(); accentCtx.globalCompositeOperation='destination-out';
    accentCtx.fillStyle=`rgba(0,0,0,${0.004*dt*60})`;
    accentCtx.fillRect(0,0,accentCanvas.width,accentCanvas.height);
    accentCtx.restore();

    accents.forEach((a,i)=>{
      if (a.type==='bloom'){
        a.r+=a.grow*(dt*60); a.a-=a.fade*(dt*60);
        if (a.r>MAX_BLOOM) a.a=0;
        if (a.a<=0){ accents.splice(i,1); return; }
        const grad=accentCtx.createRadialGradient(a.x,a.y,0,a.x,a.y,a.r);
        grad.addColorStop(0,`hsla(${a.h},100%,60%,${a.a*0.35})`);
        grad.addColorStop(1,`hsla(${a.h},100%,60%,0)`);
        accentCtx.save(); accentCtx.globalCompositeOperation='lighter';
        accentCtx.fillStyle=grad; accentCtx.beginPath(); accentCtx.arc(a.x,a.y,a.r,0,Math.PI*2); accentCtx.fill(); accentCtx.restore();
      } else if (a.type==='confetti' || a.type==='sparkle'){
        a.x+=a.vx*(dt*60); a.y+=a.vy*(dt*60); a.life-=dt; if (a.life<=0){ accents.splice(i,1); return; }
        accentCtx.save(); accentCtx.globalCompositeOperation='lighter';
        const hue=a.h ?? ((a.x*0.3+a.y*0.2)%360);
        accentCtx.fillStyle=`hsla(${hue},100%,70%,${a.a})`;
        accentCtx.fillRect(a.x-1.2,a.y-1.2,2.4,2.4);
        accentCtx.restore();
      } else if (a.type==='ribbon'){
        a.t+=dt*0.9; if (a.t>=1.1){ accents.splice(i,1); return; }
        const span=60, bend=40*a.dir;
        const x1=a.x-span, x2=a.x+span, y1=a.y, y2=a.y;
        const cx=a.x, cy=a.y+bend*(Math.sin(a.t*Math.PI));
        accentCtx.save(); accentCtx.globalCompositeOperation='lighter';
        accentCtx.strokeStyle=`hsla(${a.h},100%,65%,${a.a*(1-a.t)})`; accentCtx.lineWidth=2.5;
        accentCtx.beginPath(); accentCtx.moveTo(x1,y1);
        accentCtx.quadraticCurveTo(cx,cy,x2,y2);
        accentCtx.stroke(); accentCtx.restore();
      } else if (a.type==='ring'){
        a.r+=a.grow*(dt*60); a.a-=a.fade*(dt*60);
        if (a.r>MAX_RING) a.a=0;
        if (a.a<=0){ accents.splice(i,1); return; }
        accentCtx.save(); accentCtx.globalCompositeOperation='lighter';
        accentCtx.strokeStyle=`hsla(200,100%,75%,${a.a})`; accentCtx.lineWidth=2;
        accentCtx.beginPath(); accentCtx.arc(a.x,a.y,a.r,0,Math.PI*2); accentCtx.stroke();
        accentCtx.restore();
      }
    });

    const decay=Math.pow(0.5, dt/1.4);
    influence.scatter*=decay; influence.spin*=decay; influence.center*=decay; influence.ybias*=decay;
  }

  // --------- drawing ----------
  function drawStroke(ctx,x1,y1,x2,y2,width,hue,sat,light,alpha){
    const type=MP.ui.brushType();
    const comp=(MP.ui.isErasing()?'destination-out':(type==='glow'?'lighter':MP.ui.layerBlend(activeLayer)));
    ctx.save();
    ctx.globalCompositeOperation=comp;
    ctx.globalAlpha = MP.ui.layerOpacity(activeLayer) * MP.ui.opacity();

    if (type==='line' || type==='glow'){
      if (type==='glow'){ ctx.shadowColor=`hsla(${hue},${sat}%,${light}%,${Math.min(1,alpha*1.2)})`; ctx.shadowBlur=Math.min(120,width*8); }
      else ctx.shadowBlur=0;
      ctx.strokeStyle=`hsla(${hue},${sat}%,${MP.ui.isErasing()?Math.max(10,light-10):light}%,${alpha})`;
      ctx.lineWidth=width; ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
    } else if (type==='particles'){
      const dx=x2-x1, dy=y2-y1; const dist=Math.hypot(dx,dy)||1; const steps=Math.max(1,Math.floor(dist/Math.max(1,width*0.8)));
      for(let i=0;i<=steps;i++){
        const t=i/steps; const bx=x1+dx*t, by=y1+dy*t;
        const extra=influence.scatter*0.2;
        const spread=Math.max(0.5,width*0.6)+(MP.ui.scatter()+MP.state.mpeScatter+extra)*0.04;
        const px=bx+(Math.random()-0.5)*spread, py=by+(Math.random()-0.5)*spread;
        const r=Math.max(0.6,(width*0.35)*(0.6+Math.random()*0.8));
        ctx.fillStyle=`hsla(${hue},${sat}%,${light}%,${alpha*0.8})`;
        ctx.beginPath(); ctx.arc(px,py,r,0,Math.PI*2); ctx.fill();
      }
    } else if (type==='blocks'){
      const dx=x2-x1, dy=y2-y1; const dist=Math.hypot(dx,dy)||1; const step=Math.max(2,width*1.2);
      for(let s=0; s<=dist; s+=step){ const t=s/dist; const bx=x1+dx*t, by=y1+dy*t; const size=width*1.6;
        ctx.fillStyle=`hsla(${hue},${sat}%,${light+5}%,${alpha*0.7})`; ctx.fillRect(bx-size/2, by-size/2, size, size);
      }
    }
    ctx.restore();
  }
  function drawSymmetry(ctx,x1,y1,x2,y2,width,hue,sat,light,alpha){
    const n=Math.max(1,MP.ui.symmetry());
    if (n===1){ drawStroke(ctx,x1,y1,x2,y2,width,hue,sat,light,alpha); return; }
    const step=(2*Math.PI)/n;
    for(let i=0;i<n;i++){
      const a=i*step; const s=Math.sin(a), c=Math.cos(a);
      const cx=stageSize.cx, cy=stageSize.cy;
      const rx1=(x1-cx)*c - (y1-cy)*s + cx, ry1=(x1-cx)*s + (y1-cy)*c + cy;
      const rx2=(x2-cx)*c - (y2-cy)*s + cx, ry2=(x2-cx)*s + (y2-cy)*c + cy;
      drawStroke(ctx,rx1,ry1,rx2,ry2,width,hue,sat,light,alpha);
    }
  }

  // --------- loop ----------
  let last=performance.now(), frames=0, lastFPS=performance.now();
  function loop(now){
    const dt=Math.max(0.001, Math.min(0.05, (now-last)/1000)); last=now;
    frames++; if (now-lastFPS>1000){ MP.ui.setFps(frames); frames=0; lastFPS=now; }

    const trail=MP.ui.trail(); if (trail>0){ for(const l of layers){ const c=l.ctx; c.save(); c.globalCompositeOperation='destination-out'; c.fillStyle=`rgba(0,0,0,${trail})`; c.fillRect(0,0,l.canvas.width,l.canvas.height); c.restore(); } }

    if (MP.state.activeNotes.size===0){ const sf=MP.ui.silenceFade(); if (sf>0){ const per=sf*(dt*60); for(const l of layers){ const c=l.ctx; c.save(); c.globalCompositeOperation='destination-out'; c.fillStyle=`rgba(0,0,0,${per})`; c.fillRect(0,0,l.canvas.width,l.canvas.height); c.restore(); } } }

    let Vb={x:0,y:0}, Vh={x:0,y:0}, weight=0, hueNum=0, velAvg=0;
    const act=Array.from(MP.state.activeNotes.keys());
    MP.state.activeNotes.forEach((n, note)=>{
      const wBase=n.velocity/127; const press=(n.pressure ?? MP.state.pressure)*0.7; const w=wBase*(1+press);
      Vb.x+=Math.cos(baseAngle(note))*w; Vb.y+=Math.sin(baseAngle(note))*w;
      Vh.x+=Math.cos(harmAngle(note))*w; Vh.y+=Math.sin(harmAngle(note))*w;
      hueNum+=note*w*7.0; weight+=w; velAvg+=n.velocity;
    });
    velAvg = act.length ? velAvg/act.length : 0;

    let V={x:0,y:0};
    const mode=MP.ui.flowMode();
    if (mode==='harmonic'){ const m=Math.hypot(Vh.x,Vh.y)||1; V={x:Vh.x/m,y:Vh.y/m}; }
    else if (mode==='melodic'){ const target = weight>0 ? ( ()=>{ const m=Math.hypot(Vb.x,Vb.y)||1; return {x:Vb.x/m,y:Vb.y/m}; })() : {x:0,y:0};
      const smooth=MP.ui.flowSmooth();
      let delta=0; if (act.length){ const avgPc=act.reduce((a,b)=>a+MP.pc(b),0)/act.length; delta=Math.abs(avgPc-(MP.memAvgPc||avgPc)); MP.memAvgPc=avgPc; }
      const alpha=Math.min(1, smooth*0.8 + Math.min(1, delta/3)*0.5);
      MP.memX = (MP.memX??0)*(1-alpha) + target.x*alpha; MP.memY = (MP.memY??0)*(1-alpha) + target.y*alpha;
      const m2=Math.hypot(MP.memX,MP.memY)||1; V={x:MP.memX/m2,y:MP.memY/m2};
    } else { const nb=Math.hypot(Vb.x,Vb.y)||1, nh=Math.hypot(Vh.x,Vh.y)||1;
      const Bb={x:Vb.x/nb,y:Vb.y/nb}, Hh={x:Vh.x/nh,y:Vh.y/nh};
      const t=0.35; V={x:Bb.x*(1-t)+Hh.x*t, y:Bb.y*(1-t)+Hh.y*t}; const m=Math.hypot(V.x,V.y)||1; V.x/=m; V.y/=m; }

    if (Math.abs(influence.spin)>0.0001){
      const ang=influence.spin*0.001; const cs=Math.cos(ang), sn=Math.sin(ang);
      const rx=V.x*cs - V.y*sn, ry=V.x*sn + V.y*cs; V.x=rx; V.y=ry;
    }

    const cons=chordConsonance(act);
    const baseSc=MP.ui.scatter() + MP.state.mpeScatter + influence.scatter*0.2;
    const scatterEff=baseSc * (1 - cons*MP.ui.consBias());
    const gRaw=MP.ui.gravity() + influence.center*0.15;
    const gEff=Math.pow(Math.min(1,gRaw),1.8) * 0.35;
    if (gEff>0){ const gx=(stageSize.cx-pen.x), gy=(stageSize.cy-pen.y), gm=Math.hypot(gx,gy)||1; V.x=V.x*(1-gEff)+(gx/gm)*gEff; V.y=V.y*(1-gEff)+(gy/gm)*gEff; }
    if (Math.abs(influence.ybias)>0.0001) V.y += influence.ybias*0.2;

    const mV=Math.hypot(V.x,V.y)||1; V.x/=mV; V.y/=mV;

    if (weight>0){
      pen.px=pen.x; pen.py=pen.y;
      const jitter=()=> (Math.random()-0.5)*scatterEff;
      const mag = 1 + weight*1.1;
      pen.x += (V.x*mag + jitter());
      pen.y += (V.y*mag + jitter());

      const r=stageWrap.getBoundingClientRect();
      if (pen.x<0){ pen.x+=r.width; pen.px=pen.x; }
      if (pen.y<0){ pen.y+=r.height; pen.py=pen.y; }
      if (pen.x>r.width){ pen.x-=r.width; pen.px=pen.x; }
      if (pen.y>r.height){ pen.y-=r.height; pen.py=pen.y; }

      let hueAuto=((hueNum/Math.max(0.0001,weight))%360+360)%360;
      let sat=MP.ui.sat(), light=MP.ui.light();
      if (MP.ui.paletteMono()){ const avgPc=act.reduce((a,b)=>a+MP.pc(b),0)/Math.max(1,act.length); light=Math.round(25+(avgPc/11)*55); sat=0; }
      const hue=computeHue(hueAuto, velAvg);
      const width = 1 + (MP.ui.brushScale() * (1 + weight*6)) * (1 + (MP.state.pressure*0.7));
      const alpha = 0.9;
      const ctx = layers[activeLayer].ctx;
      drawSymmetry(ctx, pen.px, pen.py, pen.x, pen.y, width, hue.toFixed(1), sat, light, alpha);
    }

    drawAccents(dt);
    drawFX(dt);
    MP.capture?.compositeEachFrame?.(ctx => compositeTo(ctx));
    requestAnimationFrame(loop);
  }

  MP.draw = {
    createLayer, deleteLayer, clearLayer, selectLayer, layers,
    layerSetBlend:(i,v)=>{ layers[i].blend=v; },
    layerSetOpacity:(i,v)=>{ layers[i].opacity=v; },
    freezeArtwork, compositeTo, resizeAll, centerPen, updateCenter, fxCanvas, getPen
  };

  window.addEventListener('resize', resizeAll);
  createLayer(); resizeAll(); centerPen();
  requestAnimationFrame(loop);
})(window.MP);
