// Presets for Axiom 25 web synth
// Each preset may define: osc, env {a,d,s,r} in ms, cutoff (Hz), q, reverb (0..1), delay (0..1)

export const PRESETS = [
  { id:'piano',   name:'Concert Piano', osc:'triangle', cutoff:12000, q:0.7, reverb:0.22, delay:0.00, env:{ a:5,  d:220, s:0.50, r:400 } },
  { id:'grand',   name:'Grand Piano',   osc:'triangle', cutoff:14000, q:0.8, reverb:0.28, delay:0.05, env:{ a:3,  d:260, s:0.50, r:520 } },
  { id:'ep',      name:'Electric Piano',osc:'sine',     cutoff:10000, q:0.6, reverb:0.30, delay:0.12, env:{ a:10, d:300, s:0.40, r:600 } },
  { id:'organ',   name:'Organ',         osc:'square',   cutoff:14000, q:0.2, reverb:0.15, delay:0.10, env:{ a:5,  d:0,   s:0.90, r:50  } },
  { id:'bass',    name:'Mono Bass',     osc:'sawtooth', cutoff:800,   q:1.2, reverb:0.05, delay:0.00, env:{ a:2,  d:120, s:0.30, r:120 } },
  { id:'pluck',   name:'Pluck',         osc:'square',   cutoff:4000,  q:1.0, reverb:0.12, delay:0.18, env:{ a:1,  d:120, s:0.00, r:80  } },
  { id:'pad',     name:'Warm Pad',      osc:'sawtooth', cutoff:3000,  q:0.9, reverb:0.35, delay:0.25, env:{ a:400,d:1000,s:0.80, r:1500} },
  { id:'lead',    name:'Saw Lead',      osc:'sawtooth', cutoff:12000, q:0.6, reverb:0.12, delay:0.10, env:{ a:5,  d:140, s:0.50, r:160 } },
  { id:'stringer',name:'Stringer',      osc:'sawtooth', cutoff:5000,  q:1.0, reverb:0.32, delay:0.20, env:{ a:60, d:700, s:0.70, r:800 } },
  { id:'keys',    name:'Bright Keys',   osc:'square',   cutoff:9000,  q:0.8, reverb:0.18, delay:0.14, env:{ a:8,  d:240, s:0.45, r:300 } },
  { id:'lofi',    name:'Lo‑Fi Pad',     osc:'triangle', cutoff:2500,  q:1.0, reverb:0.40, delay:0.22, env:{ a:250,d:900, s:0.75, r:1200} }
];
