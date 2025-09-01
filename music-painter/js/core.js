// Core namespace + safe UI stub so other modules can run before ui.js loads
window.MP = window.MP || {};
(function (MP) {
  MP.el = id => document.getElementById(id);

    // simple mobile check (used by mobile.js)
  MP.isMobile = (() => {
  const ua = navigator.userAgent || '';
  const coarse = matchMedia?.('(hover:none) and (pointer:coarse)').matches;
  return coarse || /Android|webOS|iPhone|iPad|iPod|Mobile|CriOS|FxiOS/i.test(ua);
})();

// add a CSS hook so we can style reliably
if (MP.isMobile) {
  document.documentElement.classList.add('mobile');
} else {
  document.documentElement.classList.remove('mobile');
}


  // --- SAFE UI STUB (replaced by real ui.js later) ---
  MP.ui = {
    setFps(){}, setAudioState(s){ const pill=MP.el('audioStatus'); if(pill) pill.textContent=`Audio: ${s}`; },
    colorMode:()=> 'auto', colorPick:()=> '#7c3aed', hueOffset:()=>0, sat:()=>85, light:()=>60,
    paletteMono:()=> false, flowMode:()=> 'balanced', flowSmooth:()=>0.6, consBias:()=>0.6,
    symmetry:()=>1, gravity:()=>0, silenceFade:()=>0, trail:()=>0,
    brushType:()=> 'line', brushScale:()=>1.2, opacity:()=>1, scatter:()=>0,
    setOpacity(){}, reflectScatterExtra(){},
    layerOpacity:()=>1, layerBlend:()=> 'source-over',
    setFlowPhase(){}, flowPhase:()=>0, isErasing:()=>false, setEraser(){},
    refreshNoteList(){}, updateLayerSelect(){}, onSelectLayer(){}
  };

  // Computer keyboard → piano notes
  MP.KEY_LAYOUT = { a:60,w:61,s:62,e:63,d:64,f:65,t:66,g:67,y:68,h:69,u:70,j:71,k:72 };
  // Number keys → drum pads (desktop)
  MP.KEY_DRUMS_NOTE = { '1':40,'2':41,'3':42,'4':43,'5':36,'6':37,'7':38,'8':39 };
  // Pad note → type
  MP.PAD_TO_TYPE = { 40:'tom-low',41:'tom-floor',42:'hat-closed',43:'tom-high',36:'kick',37:'rim',38:'snare',39:'clap' };

  MP.midiNoteName = n => ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'][n%12] + (Math.floor(n/12)-1);
  MP.pc = n => ((n%12)+12)%12;
})(window.MP);
