// Mini Mario V2 - improved engine with level select, simple sprites, enemies, one-way platforms & basic audio

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const levelSelect = document.getElementById('level-select');
const btnStart = document.getElementById('btn-start');
const btnEditor = document.getElementById('btn-editor');

let levels = [];
let currentLevelIdx = 0;
let levelData = null;
let tileSize = 32;
let cameraX = 0;
let coins = 0;

const keys = {};
window.addEventListener('keydown', e => keys[e.key.toLowerCase()] = true);
window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

class Player {
  constructor(x,y){
    this.x = x; this.y = y; this.w = 26; this.h = 30;
    this.vx = 0; this.vy = 0; this.onGround = false; this.facing = 1;
    this.anim = 0; this.animTime = 0;
  }
  update(dt){
    const accel = 1800, maxSpeed = 220, jumpSpeed = -520;
    if (keys['arrowleft'] || keys['a']) { this.vx -= accel*dt; this.facing = -1 }
    if (keys['arrowright'] || keys['d']) { this.vx += accel*dt; this.facing = 1 }
    if (!(keys['arrowleft']||keys['arrowright']||keys['a']||keys['d'])) this.vx *= 0.88;
    this.vx = Math.max(-maxSpeed, Math.min(maxSpeed, this.vx));
    this.vy += 1400 * dt;
    if ((keys['arrowup']||keys[' ']||keys['w']) && this.onGround) { this.vy = jumpSpeed; this.onGround = false }
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.resolveCollisions();
    // anim
    this.animTime += dt; if (this.animTime>0.12){ this.anim = (this.anim+1)%4; this.animTime=0 }
  }
  resolveCollisions(){
    if (!levelData) return;
    this.onGround = false;
    // AABB vs tile grid - sample corners
    const corners = [
      {x:this.x,y:this.y}, {x:this.x+this.w,y:this.y}, {x:this.x,y:this.y+this.h}, {x:this.x+this.w,y:this.y+this.h}
    ];

    // check tiles around player
    const left = Math.floor((this.x)/tileSize)-1;
    const right = Math.floor((this.x+this.w)/tileSize)+1;
    const top = Math.floor((this.y)/tileSize)-1;
    const bottom = Math.floor((this.y+this.h)/tileSize)+1;

    for (let ty=top; ty<=bottom; ty++){
      for (let tx=left; tx<=right; tx++){
        const ch = getTile(tx,ty);
        if (!ch || ch=='.') continue;
        const tileRect = {x:tx*tileSize, y:ty*tileSize, w:tileSize, h:tileSize};
        if (ch==='T') {
          const inter = rectIntersection({x:this.x,y:this.y,w:this.w,h:this.h}, tileRect);
          if (inter){
            if (inter.w < inter.h){ // horizontal
              if (this.x < tileRect.x) this.x -= inter.w; else this.x += inter.w;
              this.vx = 0;
            } else { // vertical
              if (this.y < tileRect.y){ this.y -= inter.h; this.vy = 0; this.onGround = true } else { this.y += inter.h; this.vy=0 }
            }
          }
        } else if (ch==='^') { // one-way platform - collides only when falling and above
          if (this.vy >= 0){
            const feetY = this.y + this.h;
            if (feetY > tileRect.y && this.y < tileRect.y){
              // land on platform
              this.y = tileRect.y - this.h; this.vy = 0; this.onGround = true;
            }
          }
        } else if (ch==='C'){
          // collect coin
          if (rectIntersection({x:this.x,y:this.y,w:this.w,h:this.h}, tileRect)){
            setTile(tx,ty,'.'); coins++; document.getElementById('coins').textContent = coins;
            playSound('coin');
          }
        } else if (ch==='G'){
          if (rectIntersection({x:this.x,y:this.y,w:this.w,h:this.h}, tileRect)){
            playSound('win');
            setTimeout(()=>{ loadLevel(currentLevelIdx+1); }, 200);
          }
        } else if (ch==='/'||ch==='\\'){
          // slopes: simple approach - treat as bouncy wedge
          // approximate by pushing player up if intersecting lower half
          const inter = rectIntersection({x:this.x,y:this.y,w:this.w,h:this.h}, tileRect);
          if (inter){
            if (this.y + this.h > tileRect.y + tileRect.h/2){ // deep intersection
              this.y = tileRect.y - this.h; this.vy = 0; this.onGround = true;
            }
          }
        }
      }
    }

    // world bounds
    if (this.y > levelData.height * tileSize + 200){ loadLevel(currentLevelIdx); }
  }
  draw(ctx){
    // simple sprite: body + eyes, animate by color
    const sx = this.x - cameraX; const sy = this.y;
    ctx.save();
    ctx.translate(sx+this.w/2, sy+this.h/2);
    ctx.scale(this.facing,1);
    ctx.fillStyle = '#d33';
    ctx.fillRect(-this.w/2, -this.h/2, this.w, this.h);
    ctx.fillStyle = '#fff'; ctx.fillRect(-6, -6, 4, 4); ctx.fillRect(2, -6, 4, 4);
    ctx.restore();
  }
}

class Enemy {
  constructor(x,y,patrol=80){ this.x=x;this.y=y;this.w=28;this.h=28;this.vx=60;this.patrol=patrol; this.leftBound=x-patrol/2; this.rightBound=x+patrol/2 }
  update(dt){ this.x += this.vx*dt; if (this.x < this.leftBound || this.x > this.rightBound) this.vx *= -1 }
  draw(ctx){ ctx.fillStyle='#333'; ctx.fillRect(this.x-cameraX,this.y,this.w,this.h) }
}

let player=null; let enemies=[];

function rectIntersection(a,b){ const x=Math.max(a.x,b.x), y=Math.max(a.y,b.y); const x2=Math.min(a.x+a.w,b.x+b.w), y2=Math.min(a.y+a.h,b.y+b.h); if (x2>x && y2>y) return {x,y,w:x2-x,h:y2-y}; return null }

function getTile(tx,ty){ if (!levelData) return null; if (ty<0||tx<0||tx>=levelData.width||ty>=levelData.height) return null; const row=levelData.tiles[ty]||''; return row[tx]||'.' }
function setTile(tx,ty,ch){ if (!levelData) return; if (ty<0||tx<0||tx>=levelData.width||ty>=levelData.height) return; const row=levelData.tiles[ty]; levelData.tiles[ty]=row.substr(0,tx)+ch+row.substr(tx+1) }

let lastTime=0;
function gameLoop(ts){ if (!lastTime) lastTime = ts; const dt = Math.min(1/30,(ts-lastTime)/1000); lastTime = ts; update(dt); render(); requestAnimationFrame(gameLoop) }

function update(dt){ if (!player) return; player.update(dt); enemies.forEach(e=>{ e.update(dt); if (rectIntersection({x:player.x,y:player.y,w:player.w,h:player.h},{x:e.x,y:e.y,w:e.w,h:e.h})){ // simple collision
    playSound('hurt'); loadLevel(currentLevelIdx);
  } })
  cameraX = Math.floor(player.x - canvas.width/2 + player.w/2); cameraX = Math.max(0, Math.min(cameraX, levelData.width*tileSize - canvas.width)); }

function render(){ ctx.clearRect(0,0,canvas.width,canvas.height); if (!levelData) return; const startCol = Math.floor(cameraX/tileSize); const endCol = startCol + Math.ceil(canvas.width/tileSize)+1; const startRow = 0; const endRow = levelData.height; for (let y=startRow;y<endRow;y++){ const row = levelData.tiles[y]||''; for (let x=startCol;x<=endCol;x++){ const ch = row[x]||'.'; const sx = x*tileSize-cameraX; const sy = y*tileSize; if (ch==='T'){ ctx.fillStyle='#7b3'; ctx.fillRect(sx,sy,tileSize,tileSize); ctx.strokeStyle='#4a2'; ctx.strokeRect(sx,sy,tileSize,tileSize); } else if (ch==='^'){ ctx.fillStyle='#996'; ctx.fillRect(sx,sy,tileSize,tileSize/6); } else if (ch==='C'){ ctx.fillStyle='gold'; ctx.beginPath(); ctx.arc(sx+tileSize/2,sy+tileSize/2,tileSize/6,0,Math.PI*2); ctx.fill(); ctx.strokeStyle='#aa7'; ctx.stroke(); } else if (ch==='G'){ ctx.fillStyle='#fff'; ctx.fillRect(sx+tileSize*0.35,sy+tileSize*0.1,tileSize*0.2,tileSize*0.8); ctx.fillStyle='blue'; ctx.beginPath(); ctx.moveTo(sx+tileSize*0.55,sy+tileSize*0.1); ctx.lineTo(sx+tileSize*0.9,sy+tileSize*0.3); ctx.lineTo(sx+tileSize*0.55,sy+tileSize*0.5); ctx.fill(); } else if (ch==='/'||ch==='\\'){ ctx.fillStyle='#a66'; ctx.fillRect(sx,sy,tileSize,tileSize); ctx.fillStyle='#d88'; ctx.fillRect(sx, sy + tileSize/2, tileSize, tileSize/2); } } } enemies.forEach(e=>e.draw(ctx)); player.draw(ctx) }

async function loadLevels(){ const res = await fetch('levels.json'); const json = await res.json(); levels = json.levels || []; levelSelect.innerHTML = ''; levels.forEach((l,idx)=>{ const opt = document.createElement('option'); opt.value = idx; opt.textContent = l.name || ('Level '+(idx+1)); levelSelect.appendChild(opt) }); }

function loadLevel(idx){ if (idx < 0 || idx >= levels.length) { idx = 0 } currentLevelIdx = idx; const lvl = levels[idx]; levelData = { width: lvl.width, height: lvl.height, tileSize: lvl.tileSize||32, tiles: lvl.tiles.slice() }; tileSize = levelData.tileSize; coins = 0; document.getElementById('coins').textContent = coins; document.getElementById('level-name').textContent = lvl.name || (idx+1); enemies = []; // populate enemies by scanning 'E' tiles
  for (let y=0;y<levelData.height;y++){ for (let x=0;x<levelData.width;x++){ const ch = getTile(x,y); if (ch==='P'){ // player start
      setTile(x,y,'.'); player = new Player(x*tileSize, y*tileSize); }
      if (ch==='E'){ enemies.push(new Enemy(x*tileSize, y*tileSize, 120)); setTile(x,y,'.') }
    } }
  if (!player) player = new Player(64,64); cameraX=0; lastTime=0; requestAnimationFrame(gameLoop); }

btnStart.addEventListener('click', ()=>{ loadLevel(parseInt(levelSelect.value || '0')) });
btnEditor.addEventListener('click', ()=>{ window.open('editor.html','_blank') });

// audio (tiny) - use AudioContext and simple tones
let audioCtx = null;
function ensureAudio(){ if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)() }
function playSound(type){ try{ ensureAudio(); if (type==='coin'){ const o = audioCtx.createOscillator(); const g = audioCtx.createGain(); o.type='triangle'; o.frequency.value=880; o.connect(g); g.connect(audioCtx.destination); g.gain.value=0.001; o.start(); g.gain.exponentialRampToValueAtTime(0.1, audioCtx.currentTime+0.01); g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime+0.3); o.stop(audioCtx.currentTime+0.35); } else if (type==='win'){ const o = audioCtx.createOscillator(); const g = audioCtx.createGain(); o.type='sine'; o.frequency.value=660; o.connect(g); g.connect(audioCtx.destination); g.gain.value=0.01; o.start(); g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime+0.7); o.stop(audioCtx.currentTime+0.75); } else if (type==='hurt'){ const o = audioCtx.createOscillator(); const g = audioCtx.createGain(); o.type='square'; o.frequency.value=220; o.connect(g); g.connect(audioCtx.destination); g.gain.value=0.02; o.start(); g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime+0.4); o.stop(audioCtx.currentTime+0.45); } }catch(e){ console.warn('Audio failed',e) } }

// init
loadLevels().then(()=>{ levelSelect.selectedIndex = 0; loadLevel(0) });

// simple helpers for dev
function setTileAtMouse(mx,my,ch){ const x = Math.floor((mx+cameraX)/tileSize); const y = Math.floor(my/tileSize); if (y>=0 && y<levelData.height && x>=0 && x<levelData.width){ setTile(x,y,ch) } }

canvas.addEventListener('click', e=>{ const rect = canvas.getBoundingClientRect(); setTileAtMouse(e.clientX-rect.left, e.clientY-rect.top, 'C') })
