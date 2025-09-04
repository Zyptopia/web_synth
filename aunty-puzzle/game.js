// Simple 4x4 pipe-rotation puzzle
// Goal: connect (0,0) to (3,3). Click tiles to rotate clockwise.

const gridEl = document.getElementById('grid');
const movesEl = document.getElementById('moves');
const timerEl = document.getElementById('timer');
const shuffleBtn = document.getElementById('shuffleBtn');
const resetBtn = document.getElementById('resetBtn');

const SIZE = 4;

// Tile types (base rotation = 0)
// Connections order: [N, E, S, W] booleans
const TYPES = {
  empty:  [0,0,0,0],
  straight: [1,0,1,0], // vertical
  corner: [1,1,0,0],   // N-E
  tee: [1,1,1,0],      // N-E-S
  cross: [1,1,1,1],
};

// Solved layout describing types and rotations to make a path
// Path: (0,0)->(0,1)->(0,2)->(1,2)->(2,2)->(2,3)->(3,3)
const SOLVED = [
  // row 0
  [{t:'corner', r:1, rot:true}, {t:'straight', r:1, rot:true}, {t:'corner', r:2, rot:true}, {t:'empty', r:0, rot:false}],
  // row 1
  [{t:'empty', r:0, rot:false}, {t:'empty', r:0, rot:false}, {t:'straight', r:0, rot:true}, {t:'empty', r:0, rot:false}],
  // row 2
  [{t:'empty', r:0, rot:false}, {t:'empty', r:0, rot:false}, {t:'corner', r:0, rot:true}, {t:'corner', r:2, rot:true}],
  // row 3
  [{t:'empty', r:0, rot:false}, {t:'empty', r:0, rot:false}, {t:'empty', r:0, rot:false}, {t:'straight', r:0, rot:true}],
];

let state = JSON.parse(JSON.stringify(SOLVED)); // deep copy
let moves = 0;
let startTime = null;
let timerInt = null;

function rotatedConnections(type, rot){
  const base = TYPES[type];
  // rotate right 'rot' times
  let c = base.slice();
  for(let i=0;i<rot;i++){
    c = [c[3], c[0], c[1], c[2]]; // rotate N,E,S,W -> W,N,E,S
  }
  return c;
}

function makeTileEl(r,c){
  const tile = document.createElement('button');
  tile.className = 'tile';
  tile.setAttribute('role','gridcell');
  tile.setAttribute('aria-label',`row ${r+1} col ${c+1}`);
  if(!state[r][c].rot) tile.classList.add('locked');
  tile.addEventListener('click', ()=>onRotate(r,c));
  tile.addEventListener('keydown', (e)=>{
    if(e.key==='Enter' || e.key===' '){ e.preventDefault(); onRotate(r,c); }
  });

  const marker = document.createElement('div');
  marker.className='marker';
  if(r===0 && c===0){ marker.textContent='Start'; }
  if(r===SIZE-1 && c===SIZE-1){ marker.textContent='Goal'; marker.classList.add('goal'); }
  tile.appendChild(marker);

  // Center node
  const center = document.createElement('div');
  center.className='center';
  const node = document.createElement('div');
  node.className='node';
  center.appendChild(node);
  tile.appendChild(center);

  // 4 connectors; visibility depends on current connections
  const conns = ['n','e','s','w'].map(dir=>{
    const el = document.createElement('div');
    el.className='conn ' + dir;
    const glow = document.createElement('div');
    glow.className='conn ' + dir + ' shadow';
    tile.appendChild(glow);
    tile.appendChild(el);
    return el;
  });

  tile.dataset.r = r;
  tile.dataset.c = c;
  updateTileVisual(tile);
  return tile;
}

function updateTileVisual(tile){
  const r = +tile.dataset.r;
  const c = +tile.dataset.c;
  const {t, r:rot} = state[r][c];
  const conns = rotatedConnections(t, rot);

  const connEls = Array.from(tile.querySelectorAll('.conn')).filter(e=>!e.classList.contains('shadow'));
  const shadowEls = Array.from(tile.querySelectorAll('.conn.shadow'));
  // Clear all
  [...connEls, ...shadowEls].forEach((el,i)=>{
    el.style.display='none';
  });

  // Enable the needed connectors (two elems per direction since we have a glow too)
  const showDir = (idx, cls) => {
    const els = tile.querySelectorAll('.' + cls + ':not(.shadow)');
    const glows = tile.querySelectorAll('.' + cls + '.shadow');
    els.forEach(el => el.style.display = conns[idx] ? 'block' : 'none');
    glows.forEach(el => el.style.display = conns[idx] ? 'block' : 'none');
  };

  showDir(0,'n'); showDir(1,'e'); showDir(2,'s'); showDir(3,'w');
}

function mount(){
  gridEl.innerHTML='';
  gridEl.style.setProperty('--size', SIZE);
  for(let r=0;r<SIZE;r++){
    for(let c=0;c<SIZE;c++){
      gridEl.appendChild(makeTileEl(r,c));
    }
  }
  moves = 0; movesEl.textContent = moves;
  startTimer();
}

function onRotate(r,c){
  if(!state[r][c].rot) return;
  state[r][c].r = (state[r][c].r + 1) % 4;
  moves++; movesEl.textContent = moves;
  const tile = [...gridEl.children].find(el => +el.dataset.r===r && +el.dataset.c===c);
  updateTileVisual(tile);
  if(checkSolved()){
    finish();
  }
}

function neighbors(r,c){
  return [
    {r:r-1,c, dOut:0, dIn:2}, // N
    {r, c:c+1, dOut:1, dIn:3}, // E
    {r:r+1,c, dOut:2, dIn:0}, // S
    {r, c:c-1, dOut:3, dIn:1}, // W
  ];
}

function checkSolved(){
  // BFS from (0,0) following open connections; see if we can reach (SIZE-1,SIZE-1)
  const start = {r:0,c:0};
  const goal = {r:SIZE-1, c:SIZE-1};
  const seen = new Set();
  const key = (r,c)=>r+','+c;
  const q = [start];
  seen.add(key(start.r,start.c));

  while(q.length){
    const cur = q.shift();
    if(cur.r===goal.r && cur.c===goal.c) return true;
    const curConns = rotatedConnections(state[cur.r][cur.c].t, state[cur.r][cur.c].r);

    for(const nb of neighbors(cur.r, cur.c)){
      if(nb.r<0||nb.c<0||nb.r>=SIZE||nb.c>=SIZE) continue;
      const toConns = rotatedConnections(state[nb.r][nb.c].t, state[nb.r][nb.c].r);
      if(curConns[nb.dOut] && toConns[nb.dIn]){
        const k = key(nb.r, nb.c);
        if(!seen.has(k)){
          seen.add(k);
          q.push({r:nb.r, c:nb.c});
        }
      }
    }
  }
  return false;
}

function finish(){
  stopTimer();
  // Small celebratory flash
  gridEl.classList.add('flash');
  setTimeout(()=>{
    const secs = Math.floor((Date.now()-startTime)/1000);
    const url = new URL('reveal.html', window.location.href);
    url.searchParams.set('time', secs.toString());
    url.searchParams.set('moves', moves.toString());
    window.location.href = url.toString();
  }, 450);
}

function startTimer(){
  if(timerInt) clearInterval(timerInt);
  if(!startTime) startTime = Date.now();
  timerInt = setInterval(()=>{
    const secs = Math.floor((Date.now()-startTime)/1000);
    const mm = String(Math.floor(secs/60)).padStart(2,'0');
    const ss = String(secs%60).padStart(2,'0');
    timerEl.textContent = mm + ':' + ss;
  }, 250);
}

function stopTimer(){
  if(timerInt){ clearInterval(timerInt); timerInt = null; }
}

function shuffle(){
  // Rotate each rotatable path tile 0..3 times randomly
  for(let r=0;r<SIZE;r++){
    for(let c=0;c<SIZE;c++){
      if(state[r][c].rot){
        const turns = Math.floor(Math.random()*4);
        state[r][c].r = (state[r][c].r + turns) % 4;
      }
    }
  }
  // Ensure it's not accidentally already solved; if so, reshuffle once
  if(checkSolved()){
    for(let r=0;r<SIZE;r++){
      for(let c=0;c<SIZE;c++){
        if(state[r][c].rot){
          const turns = 1 + Math.floor(Math.random()*3);
          state[r][c].r = (state[r][c].r + turns) % 4;
        }
      }
    }
  }
  // Remount visuals
  [...gridEl.children].forEach(updateTileVisual);
  moves = 0; movesEl.textContent = moves;
  startTime = Date.now(); // restart timer on shuffle
}

function reset(){
  state = JSON.parse(JSON.stringify(SOLVED));
  mount();
  shuffle(); // start shuffled by default
}

// Wire up buttons
shuffleBtn.addEventListener('click', shuffle);
resetBtn.addEventListener('click', reset);

// Initial mount
mount();
shuffle();
