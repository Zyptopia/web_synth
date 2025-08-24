
export const PRESETS = [
  { id:'piano',  name:'Concert Piano (synth)', osc:'triangle', env:{a:0.02,d:0.25,s:0.5,r:0.45}, filt:{cut:4800,q:0.9}, fx:{rev:0.22,delay:0.08} },
  { id:'pad',    name:'Warm Pad',              osc:'sawtooth', env:{a:0.25,d:0.6, s:0.7,r:1.2 }, filt:{cut:2600,q:0.7}, fx:{rev:0.35,delay:0.18} },
  { id:'saw',    name:'Saw Lead',              osc:'sawtooth', env:{a:0.01,d:0.18,s:0.45,r:0.3}, filt:{cut:6000,q:0.9}, fx:{rev:0.15,delay:0.12} },
  { id:'square', name:'Square Lead',           osc:'square',   env:{a:0.01,d:0.2, s:0.5,r:0.28}, filt:{cut:5200,q:0.8}, fx:{rev:0.12,delay:0.10} },
  { id:'bass',   name:'Bass (mono)',           osc:'square',   env:{a:0.005,d:0.15,s:0.4,r:0.18},filt:{cut:2000,q:1.1}, fx:{rev:0.05,delay:0.03}, mono:true },
  { id:'drum',   name:'Drum Pads Only',        osc:'triangle', env:{a:0.01,d:0.2, s:0.5,r:0.3}, filt:{cut:4500,q:0.8}, fx:{rev:0.12,delay:0.10} }
];