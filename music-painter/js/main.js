(function(MP){
  // Start statuses
  MP.ui?.setAudioState?.(MP.audio.ctx ? MP.audio.ctx.state : 'idle');

  // Nothing else; modules bootstrap on load (draw loop already running).
})();
