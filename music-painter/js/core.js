// Global namespace + helpers
window.MP = {};

(function(MP){
  MP.el = id => document.getElementById(id);

  // Simple mobile hint (not used to change behavior here)
  MP.isMobile = (() => {
    const ua = navigator.userAgent || '';
    const coarse = matchMedia?.('(hover:none) and (pointer:coarse)').matches;
    return coarse || /Android|webOS|iPhone|iPad|iPod|Mobile|CriOS|FxiOS/i.test(ua);
  })();

  // Computer keyboard map (piano)
  MP.KEY_LAYOUT = { a:60,w:61,s:62,e:63,d:64,f:65,t:66,g:67,y:68,h:69,u:70,j:71,k:72 };
  // Number keys → drum pads (1..8) → 40,41,42,43 / 36,37,38,39
  MP.KEY_DRUMS_NOTE = { '1':40,'2':41,'3':42,'4':43,'5':36,'6':37,'7':38,'8':39 };

  // Pad mapping → type
  MP.PAD_TO_TYPE = {
    40:'tom-low', 41:'tom-floor', 42:'hat-closed', 43:'tom-high',
    36:'kick', 37:'rim', 38:'snare', 39:'clap'
  };

  MP.midiNoteName = n => ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'][n%12] + (Math.floor(n/12)-1);
  MP.pc = n => ((n%12)+12)%12;
})(window.MP);
