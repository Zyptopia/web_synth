export const PRESETS = [
  // Pianos / Keys
  { id:'piano',  name:'Concert Piano (synth)', osc:'triangle', env:{a:0.02,d:0.25,s:0.5,r:0.45}, filt:{cut:4800,q:0.9}, fx:{rev:0.22,delay:0.08} },
  { id:'grand',  name:'Grand Piano – Bright',  osc:'triangle', env:{a:0.01,d:0.26,s:0.52,r:0.55}, filt:{cut:6000,q:0.7}, fx:{rev:0.24,delay:0.08} },
  { id:'soft',   name:'Soft Piano',            osc:'triangle', env:{a:0.02,d:0.40,s:0.65,r:0.90}, filt:{cut:3400,q:0.7}, fx:{rev:0.35,delay:0.10} },
  { id:'honky',  name:'Bar Piano',             osc:'square',   env:{a:0.003,d:0.22,s:0.45,r:0.35},filt:{cut:5200,q:0.9}, fx:{rev:0.12,delay:0.06} },
  { id:'ep',     name:'Electric Piano',        osc:'triangle', env:{a:0.01,d:0.35,s:0.55,r:0.50},filt:{cut:3800,q:0.7}, fx:{rev:0.30,delay:0.12} },
  { id:'tines',  name:'Tines EP (chorus‑ish)', osc:'triangle', env:{a:0.005,d:0.36,s:0.70,r:0.45},filt:{cut:4200,q:0.8}, fx:{rev:0.28,delay:0.12} },

  // Leads / Plucks
  { id:'pluck',  name:'Pluck',                 osc:'square',   env:{a:0.002,d:0.18,s:0.0,r:0.18},filt:{cut:5200,q:1.2}, fx:{rev:0.18,delay:0.16} },
  { id:'pluckBright', name:'Bright Pluck',     osc:'sawtooth', env:{a:0.002,d:0.15,s:0.0,r:0.16},filt:{cut:6500,q:1.0}, fx:{rev:0.14,delay:0.14} },
  { id:'leadSaw', name:'Saw Lead',             osc:'sawtooth', env:{a:0.01,d:0.18,s:0.45,r:0.30},filt:{cut:6000,q:0.9}, fx:{rev:0.15,delay:0.12} },
  { id:'leadSquare', name:'Square Lead',       osc:'square',   env:{a:0.01,d:0.20,s:0.50,r:0.28},filt:{cut:5200,q:0.8}, fx:{rev:0.12,delay:0.10} },
  { id:'brass',  name:'Analog Brass',          osc:'sawtooth', env:{a:0.02,d:0.25,s:0.55,r:0.35},filt:{cut:3000,q:1.2}, fx:{rev:0.14,delay:0.08} },

  // Pads / Strings / Choir
  { id:'pad',    name:'Warm Pad',              osc:'sawtooth', env:{a:0.25,d:0.60,s:0.70,r:1.20},filt:{cut:2600,q:0.7}, fx:{rev:0.35,delay:0.18} },
  { id:'glass',  name:'Glass Pad',             osc:'triangle', env:{a:0.20,d:0.70,s:0.60,r:1.30},filt:{cut:3000,q:1.4}, fx:{rev:0.40,delay:0.16} },
  { id:'choir',  name:'Choir‑ish Pad',         osc:'triangle', env:{a:0.30,d:0.80,s:0.75,r:1.40},filt:{cut:2400,q:1.1}, fx:{rev:0.45,delay:0.12} },
  { id:'ambient',name:'Ambient Air',           osc:'triangle', env:{a:0.80,d:1.20,s:0.80,r:2.00},filt:{cut:2000,q:0.9}, fx:{rev:0.55,delay:0.20} },
  { id:'strings',name:'Strings',               osc:'sawtooth', env:{a:0.15,d:0.60,s:0.70,r:0.90},filt:{cut:3400,q:0.7}, fx:{rev:0.35,delay:0.10} },
  { id:'slowStr',name:'Slow Strings',          osc:'sawtooth', env:{a:0.60,d:0.80,s:0.75,r:1.60},filt:{cut:3000,q:0.8}, fx:{rev:0.45,delay:0.06} },

  // Organs / Mallets / Bells
  { id:'organ',  name:'Organ',                 osc:'square',   env:{a:0.0, d:0.10,s:0.80,r:0.15},filt:{cut:6500,q:0.6}, fx:{rev:0.18,delay:0.08} },
  { id:'organPerc', name:'Organ Percussive',   osc:'square',   env:{a:0.0, d:0.18,s:0.30,r:0.20},filt:{cut:6000,q:0.9}, fx:{rev:0.10,delay:0.05} },
  { id:'bell',   name:'Bell‑ish',              osc:'sine',     env:{a:0.0, d:0.70,s:0.0, r:1.40},filt:{cut:7000,q:1.5}, fx:{rev:0.35,delay:0.12} },
  { id:'vibes',  name:'Vibes/Mallet',          osc:'sine',     env:{a:0.0, d:0.80,s:0.0, r:1.00},filt:{cut:5200,q:1.2}, fx:{rev:0.28,delay:0.10} },

  // Basses
  { id:'bass',   name:'Bass (mono)',           osc:'square',   env:{a:0.005,d:0.15,s:0.40,r:0.18},filt:{cut:2000,q:1.1}, fx:{rev:0.05,delay:0.03}, mono:true },
  { id:'sub',    name:'Sub Bass (mono)',       osc:'sine',     env:{a:0.003,d:0.12,s:0.60,r:0.18},filt:{cut:800, q:0.8},  fx:{rev:0.03,delay:0.02}, mono:true },
  { id:'acid',   name:'Acid Bass (mono)',      osc:'sawtooth', env:{a:0.003,d:0.18,s:0.40,r:0.18},filt:{cut:1500,q:1.6}, fx:{rev:0.06,delay:0.03}, mono:true },

  // Utility
  { id:'drum',   name:'Drum Pads Only',        osc:'triangle', env:{a:0.01,d:0.20,s:0.50,r:0.30},filt:{cut:4500,q:0.8}, fx:{rev:0.12,delay:0.10} }
];