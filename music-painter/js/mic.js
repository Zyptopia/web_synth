// js/mic.js
(function (MP) {
  let stream = null, source = null, analyser = null, buf = null, raf = null;
  let currentNote = null, stableCount = 0, monitorGain = null;

  const params = {
    sensitivity: 0.02,   // RMS below this = silence
    minFreq: 60,         // Hz
    maxFreq: 1200,       // Hz
    monitor: false       // route mic to speakers? (off by default)
  };

  function isOn() { return !!raf; }

  async function start() {
    if (raf) return;
    try {
      // ensure AudioContext exists & is running
      try { await MP.audio.unlock?.(); } catch {}
      const ctx = MP.audio.ensure();

      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });

      source = ctx.createMediaStreamSource(stream);
      analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      buf = new Float32Array(analyser.fftSize);
      source.connect(analyser);

      applyMonitor(); // optional, off by default
      loop();
    } catch (err) {
      alert('Microphone error: ' + (err?.message || err));
      stop();
    }
  }

  function stop() {
    if (raf) { cancelAnimationFrame(raf); raf = null; }
    if (currentNote != null) {
      try { MP.engine.noteOff(currentNote); } catch {}
      currentNote = null;
    }
    if (monitorGain) { try { monitorGain.disconnect(); } catch {} monitorGain = null; }
    if (analyser) { try { analyser.disconnect(); } catch {} analyser = null; }
    if (source) { try { source.disconnect(); } catch {} source = null; }
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
  }

  function toggle() { isOn() ? stop() : start(); }

  function setSensitivity(v) { params.sensitivity = Math.max(0.002, Math.min(0.2, v)); }
  function setMonitor(on) { params.monitor = !!on; applyMonitor(); }

  function applyMonitor() {
    if (!source) return;
    if (monitorGain) { try { monitorGain.disconnect(); } catch {} monitorGain = null; }
    if (params.monitor) {
      const ctx = MP.audio.ensure();
      monitorGain = ctx.createGain();
      monitorGain.gain.value = 0.15; // quiet to avoid feedback
      source.connect(monitorGain).connect(MP.audio.master.node);
    }
  }

  function loop() {
    raf = requestAnimationFrame(loop);
    if (!analyser) return;

    analyser.getFloatTimeDomainData(buf);

    // RMS loudness
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    const rms = Math.sqrt(sum / buf.length);

    // Silence gate
    if (rms < params.sensitivity) {
      if (currentNote != null) {
        MP.engine.noteOff(currentNote);
        currentNote = null;
        stableCount = 0;
      }
      return;
    }

    const sr = analyser.context.sampleRate;
    const freq = estimatePitch(buf, sr, params.minFreq, params.maxFreq);
    if (!freq) return;

    const midiFloat = 69 + 12 * Math.log2(freq / 440);
    const note = Math.round(midiFloat);
    const vel = Math.max(30, Math.min(127, Math.floor(rms * 900)));

    if (currentNote == null) {
      MP.engine.noteOn(note, vel);
      currentNote = note;
      stableCount = 0;
    } else if (Math.abs(note - currentNote) >= 1) {
      // require two consecutive frames to switch notes (reduce flicker)
      if (++stableCount >= 2) {
        MP.engine.noteOff(currentNote);
        MP.engine.noteOn(note, vel);
        currentNote = note;
        stableCount = 0;
      }
    } else {
      // update velocity in-place for smoother thickness mapping
      const n = MP.state.activeNotes?.get(currentNote);
      if (n) n.velocity = vel;
      stableCount = 0;
    }
  }

  // Simple autocorrelation pitch estimator
  function estimatePitch(buf, sampleRate, minF, maxF) {
    // zero-mean
    let mean = 0;
    for (let i = 0; i < buf.length; i++) mean += buf[i];
    mean /= buf.length;
    for (let i = 0; i < buf.length; i++) buf[i] -= mean;

    const minLag = Math.floor(sampleRate / maxF);
    const maxLag = Math.floor(sampleRate / minF);

    let bestLag = 0, bestCorr = 0;
    for (let lag = minLag; lag <= maxLag; lag++) {
      let corr = 0;
      for (let i = 0; i + lag < buf.length; i++) corr += buf[i] * buf[i + lag];
      corr /= (buf.length - lag);
      if (corr > bestCorr) { bestCorr = corr; bestLag = lag; }
    }
    if (bestLag === 0 || bestCorr < 0.01) return null;
    return sampleRate / bestLag;
  }

  MP.mic = { start, stop, toggle, isOn, setSensitivity, setMonitor };
})(window.MP);
