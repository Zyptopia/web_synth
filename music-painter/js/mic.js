// js/mic.js (Mic → pitched notes only. No drum triggers.)
(function (MP) {
  let stream = null, source = null, analyser = null, buf = null, raf = null;
  let currentNote = null, stableCount = 0, monitorGain = null;

  // UI maps 0..1 to roughly 0.004..0.040 RMS. Default ~0.022 @ mid.
  const params = {
    sensitivity: 0.022, // RMS below this = silence
    minFreq: 60,        // Hz
    maxFreq: 1200,      // Hz
    monitor: false      // route mic to speakers? (off by default)
  };

  const isOn = () => !!raf;

  async function start() {
    if (raf) return true;
    try {
      if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
        throw new Error('Microphone requires HTTPS (or localhost)');
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('getUserMedia not supported in this browser');
      }
      try { await MP.audio.unlock?.(); } catch {}
      const ctx = MP.audio.ensure();

      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
      });

      source = ctx.createMediaStreamSource(stream);

      analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      buf = new Float32Array(analyser.fftSize);
      source.connect(analyser);

      applyMonitor(); // optional, off by default
      loop();
      return true;
    } catch (err) {
      alert('Microphone error: ' + (err?.message || err));
      stop();
      return false;
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

  async function toggle() {
    if (isOn()) { stop(); return false; }
    const ok = await start();
    return !!ok;
  }

  function setSensitivity(v) {
    // v is already mapped by UI; keep a safe clamp just in case
    params.sensitivity = Math.max(0.001, Math.min(0.1, v));
  }

  function setMonitor(on) {
    params.monitor = !!on;
    applyMonitor();
  }

  function applyMonitor() {
    if (!source) return;
    if (monitorGain) { try { monitorGain.disconnect(); } catch {} monitorGain = null; }
    if (params.monitor) {
      const ctx = MP.audio.ensure();
      monitorGain = ctx.createGain();
      monitorGain.gain.value = 0.15;
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

    // --- Pitch estimation with confidence ---
    const p = estimatePitch(buf, sr, params.minFreq, params.maxFreq); // {freq,corr} or null
    const hasPitch = !!(p && p.freq && p.corr >= 0.06); // confident enough to be "pitched"

    // If we have a stable pitch, map it to a note; otherwise don't create pitched notes
    if (hasPitch) {
      const midiFloat = 69 + 12 * Math.log2(p.freq / 440);
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
        const n = MP.state.activeNotes?.get(currentNote);
        if (n) n.velocity = vel;
        stableCount = 0;
      }
    } else {
      // unpitched → release any held pitched note
      if (currentNote != null) {
        MP.engine.noteOff(currentNote);
        currentNote = null;
        stableCount = 0;
      }
    }
  }

  // Autocorrelation pitch estimator with confidence
  function estimatePitch(buf, sampleRate, minF, maxF) {
    // zero-mean
    let mean = 0;
    for (let i = 0; i < buf.length; i++) mean += buf[i];
    mean /= buf.length;
    const tmp = new Float32Array(buf.length);
    for (let i = 0; i < buf.length; i++) tmp[i] = buf[i] - mean;

    const minLag = Math.floor(sampleRate / maxF);
    const maxLag = Math.floor(sampleRate / minF);

    let bestLag = 0, bestCorr = 0;
    for (let lag = minLag; lag <= maxLag; lag++) {
      let corr = 0;
      for (let i = 0; i + lag < tmp.length; i++) corr += tmp[i] * tmp[i + lag];
      corr /= (tmp.length - lag);
      if (corr > bestCorr) { bestCorr = corr; bestLag = lag; }
    }
    if (bestLag === 0 || bestCorr < 0.01) return null;
    return { freq: sampleRate / bestLag, corr: bestCorr };
  }

  // Export (no drums hookup here)
  MP.mic = { start, stop, toggle, isOn, setSensitivity, setMonitor };
})(window.MP);
