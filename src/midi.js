// WebMIDI manager: note on/off, CC, bend; fixed Axiom mapping K1..K8
export class MidiManager{
  constructor(){ this.access=null; this.input=null; this.onNoteOn=null; this.onNoteOff=null; this.onCC=null; this.onBend=null; this.onChChange=null; }
  async connect(){ if(!('requestMIDIAccess'in navigator)) throw new Error('WebMIDI not supported (use Chrome/Edge).'); const secure = window.isSecureContext || ['localhost','127.0.0.1','::1'].includes(location.hostname); if(!secure) throw new Error('WebMIDI needs HTTPS or localhost.'); this.access = await navigator.requestMIDIAccess({sysex:false}); return this.refreshInputs() }
  refreshInputs(){ const list=[]; for(const inp of this.access.inputs.values()) list.push(inp); const ax = list.find(i=>/axiom/i.test(i.name))||list[0]; if(ax) this.setInput(ax); return {list,selected:this.input} }
  setInput(input){ if(this.input) this.input.onmidimessage=null; this.input=input; this.input.onmidimessage=(e)=>this._onMsg(e); }
  _onMsg(e){ const [s,d1,d2]=e.data; const cmd=s&0xF0, ch=(s&0x0F)+1; this.onChChange?.(ch); if(cmd===0x90 && d2>0) return this.onNoteOn?.(d1,d2); if((cmd===0x90&&d2===0)||cmd===0x80) return this.onNoteOff?.(d1,d2); if(cmd===0xB0) return this.onCC?.(d1,d2); if(cmd===0xE0){ const bend=((d2<<7)|d1)-8192; return this.onBend?.(bend) } }
}

// Fixed CC map suited for Axiom 25 knob defaults (K1..K8 -> 16..23)
export const DEFAULT_CC_ROUTING = {
  16:'cutoff', 17:'q', 18:'attack', 19:'decay', 20:'sustain', 21:'release', 22:'reverb', 23:'delay',
  1:'modDepth', 64:'sustainPedal'
};