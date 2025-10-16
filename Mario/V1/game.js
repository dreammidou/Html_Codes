// Mini Mario - game.js
// Lightweight 2D platformer using a JSON level file (levels.json)

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

let levelData = null;
let tileSize = 32;
let cameraX = 0;
let coins = 0;

const keys = { left: false, right: false, up: false };

window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = true;
  if (e.key === 'ArrowRight' || e.key === 'd') keys.right = true;
  if (e.key === 'ArrowUp' || e.key === ' ' || e.key === 'w') keys.up = true;
  if (e.key === 'r' || e.key === 'R') loadLevel(0);
});
window.addEventListener('keyup', (e) => {
  if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = false;
  if (e.key === 'ArrowRight' || e.key === 'd') keys.right = false;
  if (e.key === 'ArrowUp' || e.key === ' ' || e.key === 'w') keys.up = false;
});

class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.w = 28;
    this.h = 28;
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
  }
  update(dt) {
    const accel = 2000;
    const maxSpeed = 220;
    const jumpSpeed = -520;
    const friction = 0.85;

    if (keys.left) this.vx -= accel * dt;
    if (keys.right) this.vx += accel * dt;
    if (!keys.left && !keys.right) this.vx *= friction;
    this.vx = Math.max(-maxSpeed, Math.min(maxSpeed, this.vx));

    // gravity
    this.vy += 1400 * dt;

    // jump
    if (keys.up && this.onGround) {
      this.vy = jumpSpeed;
      this.onGround = false;
    }

    // integrate
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    this.resolveCollisions();
  }
  resolveCollisions() {
    if (!levelData) return;
    // basic AABB collision with tiles
    const left = Math.floor(this.x / tileSize);
    const right = Math.floor((this.x + this.w) / tileSize);
    const top = Math.floor(this.y / tileSize);
    const bottom = Math.floor((this.y + this.h) / tileSize);

    this.onGround = false;

    for (let ty = top; ty <= bottom; ty++) {
      for (let tx = left; tx <= right; tx++) {
        const ch = getTile(tx, ty);
        if (!ch) continue;
        if (ch === 'T') {
          // solid
          const tileRect = { x: tx * tileSize, y: ty * tileSize, w: tileSize, h: tileSize };
          const pRect = { x: this.x, y: this.y, w: this.w, h: this.h };
          const inter = rectIntersection(pRect, tileRect);
          if (inter) {
            // simple resolution: push out on smaller axis
            if (inter.w < inter.h) {
              // horizontal push
              if (pRect.x < tileRect.x) this.x -= inter.w; else this.x += inter.w;
              this.vx = 0;
            } else {
              if (pRect.y < tileRect.y) {
                this.y -= inter.h;
                this.vy = 0;
                this.onGround = true;
              } else {
                this.y += inter.h;
                this.vy = 0;
              }
            }
          }
        } else if (ch === 'C') {
          // coin
          const cx = tx * tileSize + tileSize/2;
          const cy = ty * tileSize + tileSize/2;
          if (rectContainsPoint({x:this.x,y:this.y,w:this.w,h:this.h}, cx, cy)) {
            setTile(tx, ty, '.');
            coins++;
            document.getElementById('coins').textContent = coins;
          }
        } else if (ch === 'G') {
          // goal
          const gx = tx * tileSize + tileSize/2;
          const gy = ty * tileSize + tileSize/2;
          if (rectContainsPoint({x:this.x,y:this.y,w:this.w,h:this.h}, gx, gy)) {
            alert('Level complete! Coins: ' + coins);
            loadLevel(0);
          }
        }
      }
    }

    // world bounds
    if (this.y > levelData.height * tileSize) {
      // fell
      loadLevel(0);
    }
  }
  draw(ctx) {
    ctx.fillStyle = 'red';
    ctx.fillRect(this.x - cameraX, this.y, this.w, this.h);
  }
}

function rectIntersection(a,b) {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  if (x2 > x && y2 > y) return { x, y, w: x2 - x, h: y2 - y };
  return null;
}
function rectContainsPoint(r, px, py) {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

let player = null;

function getTile(tx, ty) {
  if (!levelData) return null;
  if (ty < 0 || tx < 0 || tx >= levelData.width || ty >= levelData.height) return null;
  const row = levelData.tiles[ty] || '';
  return row[tx] || '.';
}
function setTile(tx, ty, ch) {
  if (!levelData) return;
  if (ty < 0 || tx < 0 || tx >= levelData.width || ty >= levelData.height) return;
  const row = levelData.tiles[ty];
  levelData.tiles[ty] = row.substr(0,tx) + ch + row.substr(tx+1);
}

let lastTime = 0;
function gameLoop(ts) {
  if (!lastTime) lastTime = ts;
  const dt = Math.min(1/30, (ts - lastTime) / 1000);
  lastTime = ts;

  update(dt);
  render();

  requestAnimationFrame(gameLoop);
}

function update(dt) {
  if (!player) return;
  player.update(dt);

  // camera follows player
  cameraX = Math.floor(player.x - canvas.width / 2 + player.w/2);
  cameraX = Math.max(0, Math.min(cameraX, levelData.width * tileSize - canvas.width));
}

function render() {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  if (!levelData) return;

  // draw tiles
  const startCol = Math.floor(cameraX / tileSize);
  const endCol = startCol + Math.ceil(canvas.width / tileSize) + 1;
  const startRow = 0;
  const endRow = levelData.height;

  for (let y = startRow; y < endRow; y++) {
    const row = levelData.tiles[y] || '';
    for (let x = startCol; x <= endCol; x++) {
      const ch = row[x] || '.';
      const sx = x * tileSize - cameraX;
      const sy = y * tileSize;
      if (ch === 'T') {
        // ground tile
        ctx.fillStyle = '#6b3';
        ctx.fillRect(sx, sy, tileSize, tileSize);
        ctx.strokeStyle = '#3a2';
        ctx.strokeRect(sx, sy, tileSize, tileSize);
      } else if (ch === 'C') {
        // coin
        ctx.fillStyle = 'gold';
        ctx.beginPath();
        ctx.arc(sx + tileSize/2, sy + tileSize/2, tileSize/6, 0, Math.PI*2);
        ctx.fill();
        ctx.strokeStyle = '#aa7';
        ctx.stroke();
      } else if (ch === 'G') {
        // goal flag
        ctx.fillStyle = '#fff';
        ctx.fillRect(sx + tileSize*0.35, sy + tileSize*0.1, tileSize*0.2, tileSize*0.8);
        ctx.fillStyle = 'blue';
        ctx.beginPath();
        ctx.moveTo(sx + tileSize*0.55, sy + tileSize*0.1);
        ctx.lineTo(sx + tileSize*0.9, sy + tileSize*0.3);
        ctx.lineTo(sx + tileSize*0.55, sy + tileSize*0.5);
        ctx.fill();
      }
    }
  }

  // draw player
  player.draw(ctx);
}

async function loadLevel(idx) {
  const res = await fetch('levels.json');
  const json = await res.json();
  const lvl = json.levels[idx];
  levelData = {
    width: lvl.width,
    height: lvl.height,
    tileSize: lvl.tileSize || 32,
    tiles: lvl.tiles.slice()
  };
  tileSize = levelData.tileSize;
  coins = 0;
  document.getElementById('coins').textContent = coins;
  document.getElementById('level').textContent = lvl.id || (idx+1);

  // place player at first empty space near left
  let px = 64, py = 0;
  for (let y=0;y<levelData.height;y++){
    if (levelData.tiles[y].indexOf('T')!==-1) { px = 64; py = (y-2)*tileSize; break; }
  }
  player = new Player(px, py);

  cameraX = 0;
}

// start
loadLevel(0).then(()=>requestAnimationFrame(gameLoop));
