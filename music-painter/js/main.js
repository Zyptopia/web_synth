(function(MP){
  // Minimal bootstrap that does not assume MP.ui exists
  try{
    const pill = MP.el('audioStatus');
    if (MP.audio.ctx) pill.textContent = 'Audio: ' + MP.audio.ctx.state;
    else pill.textContent = 'Audio: idle';
  }catch(e){}
})(window.MP);
