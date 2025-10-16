// V6: V5 base + block visuals (colors/opacity/texture), destructible blocks, regen button
const canvas = document.getElementById('pong-canvas');
const ctx = canvas.getContext('2d');

// DOM
const pauseBtn = document.getElementById('pause-btn');
const restartBtn = document.getElementById('restart-btn');
const startBtn = document.getElementById('start-btn');
const fullscreenBtn = document.getElementById('fullscreen-btn');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlaySub = document.getElementById('overlay-sub');
const overlayStart = document.getElementById('overlay-start');
const overlayRestart = document.getElementById('overlay-restart');
const countdownEl = document.getElementById('countdown');
const scoreLimitSelect = document.getElementById('score-limit');
const difficultySelect = document.getElementById('difficulty');
const soundToggle = document.getElementById('sound-toggle');
const statusDiff = document.getElementById('status-diff');
const statusSound = document.getElementById('status-sound');

// blocks UI
const toggleBlocks = document.getElementById('toggle-blocks');
const blocksCountInput = document.getElementById('blocks-count');
const blocksHitsInput = document.getElementById('blocks-hits');
const blocksColorInput = document.getElementById('blocks-color');
const blocksOpacityInput = document.getElementById('blocks-opacity');
const regenBlocksBtn = document.getElementById('regen-blocks');

// blocks state
let blocksActive = false;
let blocksCount = 3;
let blocksHits = 2;
let blocksColor = '#666666';
let blocksOpacity = 0.9;
let blocks = []; // each: {x,y,w,h,hp,maxHp,color,opacity}

// constants
const PADDLE_WIDTH = 12;
let PADDLE_HEIGHT = 80;
let BALL_RADIUS = 10;
const PLAYER_X = 30;
let AI_X = 0; // computed

let playerY = 0, aiY = 0;
let ball = null;
let playerScore = 0, aiScore = 0;
let isPaused = true, gameOver = false;
let soundEnabled = true;
let lastServer = 'player';

let upPressed=false, downPressed=false, isDragging=false;
let audioCtx = null;

const MAX_BALL_SPEED = 12;

// responsive canvas
function resizeCanvas(){
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
}
function ensureCanvasInitialSize(){
    if (!canvas.style.width){
        canvas.style.width = canvas.getAttribute('width') + 'px';
        canvas.style.height = canvas.getAttribute('height') + 'px';
    }
}

// audio
function ensureAudio(){ if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
function playBeep(freq=440,duration=0.08,type='sine',gain=0.02){ if (!soundEnabled) return; try{ ensureAudio(); const o=audioCtx.createOscillator(); const g=audioCtx.createGain(); o.type=type; o.frequency.value=freq; g.gain.value=gain; o.connect(g); g.connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime+duration);}catch(e){} }
const playHit = ()=>playBeep(900,0.04,'square',0.03);
const playScore = ()=>playBeep(220,0.12,'sine',0.05);

// ball
function createBall(direction=null){
    const speed = 5;
    const angle = (Math.random()*0.6-0.3);
    const dir = direction==='left'?-1:direction==='right'?1:(Math.random()>0.5?1:-1);
    return { x: canvas.width/2, y: canvas.height/2, vx: dir*speed*Math.cos(angle), vy: speed*Math.sin(angle) };
}

function clampSpeed(){ if (!ball) return; const mag = Math.hypot(ball.vx, ball.vy); if (mag > MAX_BALL_SPEED){ const s = MAX_BALL_SPEED / mag; ball.vx *= s; ball.vy *= s; } }

// generate random blocks avoiding paddles and center — each block gets hp and visual settings
function generateBlocks(){ blocks = []; const w = Math.max(28, Math.floor(canvas.width * 0.06)); const h = Math.max(18, Math.floor(canvas.height * 0.06)); const padding = 20; const maxAttempts = 400; let attempts = 0; while(blocks.length < blocksCount && attempts++ < maxAttempts){ const x = Math.floor(padding + Math.random() * (canvas.width - padding*2 - w)); const y = Math.floor(padding + Math.random() * (canvas.height - padding*2 - h)); // avoid near player/AI paddles areas
    if (x < PLAYER_X + 160) continue; if (x + w > canvas.width - 160) continue; // avoid center overlap
    let ok = true; for (const b of blocks){ if (!(x + w < b.x || x > b.x + b.w || y + h < b.y || y > b.y + b.h)) { ok = false; break; } }
    if (!ok) continue; blocks.push({x,y,w,h,hp:blocksHits,maxHp:blocksHits,color:blocksColor,opacity:blocksOpacity}); }
}

// draw textured block
function drawBlock(b){ // create simple diagonal hatch texture using an offscreen canvas
    const patternCanvas = document.createElement('canvas'); patternCanvas.width = 24; patternCanvas.height = 12; const pctx = patternCanvas.getContext('2d');
    pctx.fillStyle = hexToRgba(b.color, b.opacity);
    pctx.fillRect(0,0,patternCanvas.width,patternCanvas.height);
    pctx.strokeStyle = hexToRgba('#000000', Math.max(0.06, 0.12 - (b.maxHp - b.hp)*0.02));
    pctx.lineWidth = 1;
    pctx.beginPath(); pctx.moveTo(0,12); pctx.lineTo(24,0); pctx.stroke();
    const pattern = ctx.createPattern(patternCanvas,'repeat');
    ctx.fillStyle = pattern;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    // overlay to show HP (bar)
    const barW = Math.max(6, Math.floor(b.w * 0.8)); const barH = 6; const bx = b.x + (b.w - barW)/2; const by = b.y + b.h - barH - 4;
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(bx-1, by-1, barW+2, barH+2);
    const percent = b.hp / b.maxHp; ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(bx, by, barW, barH);
    ctx.fillStyle = hexToRgba('#fff', Math.max(0.6, 0.3 + percent*0.7)); ctx.fillRect(bx, by, Math.floor(barW*percent), barH);
}

function hexToRgba(hex, alpha){ const c = hex.replace('#',''); const r = parseInt(c.substring(0,2),16); const g = parseInt(c.substring(2,4),16); const b = parseInt(c.substring(4,6),16); return `rgba(${r},${g},${b},${alpha})`; }

// predictive AI: reuse existing function
function predictBallYAtX(targetX){ if (!ball) return canvas.height/2; let x = ball.x, y = ball.y, vx = ball.vx, vy = ball.vy; const H = canvas.height; const MAX_ITERS = 2000; let it = 0; if (Math.abs(vx) < 0.001) return H/2; while(it++ < MAX_ITERS){ let t; if (vx > 0){ if (x >= targetX) break; t = (targetX - x) / vx; } else { if (x <= targetX) break; t = (targetX - x) / vx; } if (t > 0 && Math.abs(t) < 1){ y += vy * t; x += vx * t; break; } const dt = 1; x += vx * dt; y += vy * dt; if (y < 0){ y = -y; vy *= -1; } if (y > H){ y = 2*H - y; vy *= -1; } if ((vx > 0 && x >= targetX) || (vx < 0 && x <= targetX)) break; } return Math.max(0, Math.min(canvas.height, y)); }

// input handling (same as V5)
canvas.addEventListener('pointerdown', e=>{ const rect = canvas.getBoundingClientRect(); const y = e.clientY - rect.top; if (Math.abs(y - (playerY + PADDLE_HEIGHT/2)) < 150){ isDragging=true; canvas.setPointerCapture(e.pointerId); updatePlayerFromY(y);} });
canvas.addEventListener('pointermove', e=>{ if (!isDragging) return; const rect = canvas.getBoundingClientRect(); updatePlayerFromY(e.clientY - rect.top); });
canvas.addEventListener('pointerup', e=>{ isDragging=false; });
canvas.addEventListener('mousemove', e=>{ if (isDragging) return; const rect=canvas.getBoundingClientRect(); const mouseY = e.clientY-rect.top; playerY = mouseY - PADDLE_HEIGHT/2; playerY = Math.max(0, Math.min(canvas.height - PADDLE_HEIGHT, playerY)); });
function updatePlayerFromY(y){ playerY = y - PADDLE_HEIGHT/2; playerY = Math.max(0, Math.min(canvas.height - PADDLE_HEIGHT, playerY)); }

window.addEventListener('keydown', e=>{ if (e.key==='w'||e.key==='W'||e.key==='ArrowUp') upPressed=true; if (e.key==='s'||e.key==='S'||e.key==='ArrowDown') downPressed=true; if (e.code==='Space'){ if (gameOver) restartGame(); else togglePause(); } });
window.addEventListener('keyup', e=>{ if (e.key==='w'||e.key==='W'||e.key==='ArrowUp') upPressed=false; if (e.key==='s'||e.key==='S'||e.key==='ArrowDown') downPressed=false; });

pauseBtn.addEventListener('click', togglePause);
restartBtn.addEventListener('click', restartGame);
startBtn.addEventListener('click', ()=>{ if (gameOver) restartGame(); startServe(); });
overlayStart.addEventListener('click', ()=>startServe());
overlayRestart.addEventListener('click', restartGame);
fullscreenBtn.addEventListener('click', ()=>{ if (document.fullscreenElement) document.exitFullscreen(); else canvas.requestFullscreen().catch(()=>{}); });

// --- Missing control functions (pause/start/restart/serve) ---
function togglePause(){
    if (gameOver) return; // no toggling during game over
    isPaused = !isPaused;
    pauseBtn.textContent = isPaused ? 'Resume' : 'Pause';
}

function restartGame(){
    playerScore = 0; aiScore = 0; gameOver = false; isPaused = true;
    pauseBtn.textContent = 'Resume';
    overlay.classList.remove('hidden');
    overlayTitle.textContent = 'Ready to play';
    overlaySub.textContent = 'Press Start / Serve to begin.';
    // regenerate blocks if active
    if (toggleBlocks && toggleBlocks.checked) generateBlocks(); else blocks = [];
    ball = createBall();
    saveSettings();
}

function startServe(){
    // hide overlay and resume
    overlay.classList.add('hidden');
    isPaused = false;
    pauseBtn.textContent = 'Pause';
    if (!ball) ball = createBall();
}

function resetBall(){
    // put ball in center and pause for serve
    ball = createBall();
    isPaused = true;
    pauseBtn.textContent = 'Resume';
    overlay.classList.remove('hidden');
    overlayTitle.textContent = 'Serve';
    overlaySub.textContent = 'Press Start / Serve to continue.';
}

// settings (localStorage) — extended for blocks appearance and hits
function loadSettings(){ const diff = localStorage.getItem('pong:difficulty'); if (diff) difficultySelect.value = diff; const sound = localStorage.getItem('pong:sound'); if (sound) soundToggle.value = sound; const limit = localStorage.getItem('pong:limit'); if (limit) scoreLimitSelect.value = limit; const b = localStorage.getItem('pong:blocks'); if (b==='1' && toggleBlocks) toggleBlocks.checked = true; const bc = localStorage.getItem('pong:blocksCount'); if (bc && blocksCountInput) blocksCountInput.value = bc; const bh = localStorage.getItem('pong:blocksHits'); if (bh && blocksHitsInput) blocksHitsInput.value = bh; const bcCol = localStorage.getItem('pong:blocksColor'); if (bcCol && blocksColorInput) blocksColorInput.value = bcCol; const boc = localStorage.getItem('pong:blocksOpacity'); if (boc && blocksOpacityInput) blocksOpacityInput.value = boc; applySettings(); }
function saveSettings(){ localStorage.setItem('pong:difficulty', difficultySelect.value); localStorage.setItem('pong:sound', soundToggle.value); localStorage.setItem('pong:limit', scoreLimitSelect.value); localStorage.setItem('pong:blocks', toggleBlocks && toggleBlocks.checked ? '1' : '0'); localStorage.setItem('pong:blocksCount', blocksCountInput ? String(parseInt(blocksCountInput.value,10)||3) : '3'); localStorage.setItem('pong:blocksHits', blocksHitsInput ? String(parseInt(blocksHitsInput.value,10)||2) : '2'); localStorage.setItem('pong:blocksColor', blocksColorInput ? blocksColorInput.value : '#666'); localStorage.setItem('pong:blocksOpacity', blocksOpacityInput ? blocksOpacityInput.value : '0.9'); applySettings(); }
function applySettings(){ statusDiff.textContent = difficultySelect.value; statusSound.textContent = soundToggle.value === 'on' ? 'On' : 'Off'; soundEnabled = soundToggle.value === 'on'; // blocks
    blocksActive = toggleBlocks && toggleBlocks.checked; blocksCount = blocksCountInput ? parseInt(blocksCountInput.value,10)||3 : 3; blocksHits = blocksHitsInput ? parseInt(blocksHitsInput.value,10)||2 : 2; blocksColor = blocksColorInput ? blocksColorInput.value : '#666'; blocksOpacity = blocksOpacityInput ? parseFloat(blocksOpacityInput.value) : 0.9; if (blocksActive) generateBlocks(); else blocks = []; }

// wire simple change events to save/apply settings
if (difficultySelect) difficultySelect.addEventListener('change', saveSettings);
if (soundToggle) soundToggle.addEventListener('change', saveSettings);
if (scoreLimitSelect) scoreLimitSelect.addEventListener('change', saveSettings);
if (toggleBlocks) toggleBlocks.addEventListener('change', saveSettings);
if (blocksCountInput) blocksCountInput.addEventListener('change', saveSettings);
if (blocksHitsInput) blocksHitsInput.addEventListener('change', saveSettings);
if (blocksColorInput) blocksColorInput.addEventListener('input', saveSettings);
if (blocksOpacityInput) blocksOpacityInput.addEventListener('input', saveSettings);

// regen button
if (regenBlocksBtn) regenBlocksBtn.addEventListener('click', ()=>{ if (!toggleBlocks || !toggleBlocks.checked) { if (toggleBlocks) toggleBlocks.checked = true; } // ensure counts read
    blocksCount = blocksCountInput ? parseInt(blocksCountInput.value,10)||3 : 3; blocksHits = blocksHitsInput ? parseInt(blocksHitsInput.value,10)||2 : 2; blocksColor = blocksColorInput ? blocksColorInput.value : '#666'; blocksOpacity = blocksOpacityInput ? parseFloat(blocksOpacityInput.value) : 0.9; generateBlocks(); saveSettings(); });

// generate texture pattern cache (simple), cached per color/opacity
const patternCache = new Map();
function getPatternFor(color,opacity){ const key = color+"@"+opacity; if (patternCache.has(key)) return patternCache.get(key); const pc = document.createElement('canvas'); pc.width=24; pc.height=12; const pctx = pc.getContext('2d'); pctx.fillStyle = hexToRgba(color, opacity); pctx.fillRect(0,0,pc.width,pc.height); pctx.strokeStyle = hexToRgba('#000', Math.max(0.06, 0.12)); pctx.lineWidth = 1; pctx.beginPath(); pctx.moveTo(0,12); pctx.lineTo(24,0); pctx.stroke(); const pat = ctx.createPattern(pc,'repeat'); patternCache.set(key,pat); return pat; }

// update ball — with block hp handling
function updateBall(){ if (!ball) return; ball.x += ball.vx; ball.y += ball.vy;
    // vertical collisions
    if (ball.y - BALL_RADIUS < 0){ ball.y = BALL_RADIUS; ball.vy *= -1; }
    else if (ball.y + BALL_RADIUS > canvas.height){ ball.y = canvas.height - BALL_RADIUS; ball.vy *= -1; }
    // player paddle
    if (ball.x - BALL_RADIUS < PLAYER_X + PADDLE_WIDTH && ball.y > playerY && ball.y < playerY + PADDLE_HEIGHT){ ball.x = PLAYER_X + PADDLE_WIDTH + BALL_RADIUS; ball.vx *= -1.07; let hitPos = (ball.y - playerY - PADDLE_HEIGHT/2)/(PADDLE_HEIGHT/2); ball.vy += hitPos*2; playHit(); }
    // ai paddle
    if (ball.x + BALL_RADIUS > AI_X && ball.y > aiY && ball.y < aiY + PADDLE_HEIGHT){ ball.x = AI_X - BALL_RADIUS; ball.vx *= -1.07; let hitPos = (ball.y - aiY - PADDLE_HEIGHT/2)/(PADDLE_HEIGHT/2); ball.vy += hitPos*2; playHit(); }
    // blocks collision
    if (toggleBlocks && toggleBlocks.checked && blocks.length){ for (let i=0;i<blocks.length;i++){ const b = blocks[i]; if (ball.x + BALL_RADIUS > b.x && ball.x - BALL_RADIUS < b.x + b.w && ball.y + BALL_RADIUS > b.y && ball.y - BALL_RADIUS < b.y + b.h){ const px = Math.min(ball.x + BALL_RADIUS - b.x, b.x + b.w - (ball.x - BALL_RADIUS)); const py = Math.min(ball.y + BALL_RADIUS - b.y, b.y + b.h - (ball.y - BALL_RADIUS)); if (px < py){ if (ball.x < b.x) ball.x = b.x - BALL_RADIUS; else ball.x = b.x + b.w + BALL_RADIUS; ball.vx *= -1.05; } else { if (ball.y < b.y) ball.y = b.y - BALL_RADIUS; else ball.y = b.y + b.h + BALL_RADIUS; ball.vy *= -1.05; } // damage block
            b.hp -= 1; if (b.hp <= 0){ // destroy
                blocks.splice(i,1);
            }
            playHit();
            break; } } }
    clampSpeed();
    // scores
    if (ball.x - BALL_RADIUS < 0){ aiScore++; playScore(); checkWin(); resetBall(); }
    if (ball.x + BALL_RADIUS > canvas.width){ playerScore++; playScore(); checkWin(); resetBall(); }
}

function checkWin(){ const limit = parseInt(scoreLimitSelect.value,10)||5; if (playerScore>=limit||aiScore>=limit){ gameOver=true; isPaused=true; pauseBtn.textContent='Pause'; overlay.classList.remove('hidden'); overlayTitle.textContent = playerScore>aiScore ? 'Player wins!' : 'AI wins!'; overlaySub.textContent = 'Press Restart to play again.'; } }

function updateAI(){ const diff = difficultySelect.value||'normal'; let speed=4, reaction=0.92; if (diff==='easy'){ speed=3; reaction=0.78 } if (diff==='hard'){ speed=6; reaction=0.995 }
    let center = aiY + PADDLE_HEIGHT/2;
    let targetY = canvas.height/2;
    if (ball && ball.vx > 0){ targetY = predictBallYAtX(canvas.width - 30 - PADDLE_WIDTH); }
    const delta = targetY - center;
    if (Math.abs(delta) > 6){ aiY += Math.sign(delta) * speed * reaction; }
    aiY = Math.max(0, Math.min(canvas.height - PADDLE_HEIGHT, aiY)); }

function drawRect(x,y,w,h,color='#fff'){ ctx.fillStyle=color; ctx.fillRect(x,y,w,h); }
function drawCircle(x,y,r,color='#fff'){ ctx.fillStyle=color; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.closePath(); ctx.fill(); }
function drawText(text,x,y,color='#fff',size){ ctx.fillStyle=color; ctx.font = (size||Math.max(12, Math.floor((canvas.width/ (window.devicePixelRatio||1)) * 0.04))) + 'px Arial'; ctx.textAlign='center'; ctx.fillText(text,x,y); }

function draw(){ ctx.clearRect(0,0,canvas.width,canvas.height);
    // net
    for (let y=0;y<canvas.height;y+=30){ drawRect(canvas.width/2-2,y,4,18,'#666'); }
    // blocks
    if (toggleBlocks && toggleBlocks.checked && blocks.length){ for (const b of blocks){ // draw textured block
            ctx.save(); const pat = getPatternFor(b.color, b.opacity); if (pat) ctx.fillStyle = pat; else ctx.fillStyle = hexToRgba(b.color,b.opacity); ctx.fillRect(b.x,b.y,b.w,b.h); // HP overlay and border
            ctx.strokeStyle = hexToRgba('#000',0.25); ctx.lineWidth=1; ctx.strokeRect(b.x+0.5,b.y+0.5,b.w-1,b.h-1); // HP bar
            const barW = Math.max(6, Math.floor(b.w * 0.8)); const barH = 6; const bx = b.x + (b.w - barW)/2; const by = b.y + b.h - barH - 4; ctx.fillStyle='rgba(0,0,0,0.45)'; ctx.fillRect(bx-1, by-1, barW+2, barH+2); const percent = b.hp / b.maxHp; ctx.fillStyle='rgba(255,255,255,0.12)'; ctx.fillRect(bx, by, barW, barH); ctx.fillStyle = hexToRgba('#fff', Math.max(0.6, 0.3 + percent*0.7)); ctx.fillRect(bx, by, Math.floor(barW*percent), barH); ctx.restore(); } }
    // paddles
    drawRect(PLAYER_X, playerY, PADDLE_WIDTH, PADDLE_HEIGHT, '#0ff');
    drawRect(AI_X, aiY, PADDLE_WIDTH, PADDLE_HEIGHT, '#f66');
    // ball
    if (ball) drawCircle(ball.x, ball.y, BALL_RADIUS, '#fff');
    // scores
    drawText(playerScore, canvas.width/4, 50, '#fff');
    drawText(aiScore, canvas.width*3/4, 50, '#fff');
}

function gameLoop(){ if (!isPaused){ const speed = 6; if (upPressed) playerY -= speed; if (downPressed) playerY += speed; playerY = Math.max(0, Math.min(canvas.height - PADDLE_HEIGHT, playerY)); updateBall(); updateAI(); } draw(); requestAnimationFrame(gameLoop); }

function init(){ ensureCanvasInitialSize(); resizeCanvas(); PADDLE_HEIGHT = Math.max(40, Math.floor(canvas.height * 0.16)); BALL_RADIUS = Math.max(6, Math.floor(PADDLE_HEIGHT * 0.12)); AI_X = canvas.width - 30 - PADDLE_WIDTH; playerY = canvas.height/2 - PADDLE_HEIGHT/2; aiY = playerY; ball = createBall(); loadSettings(); overlay.classList.remove('hidden'); gameLoop(); window.addEventListener('resize', ()=>{ resizeCanvas(); PADDLE_HEIGHT = Math.max(40, Math.floor(canvas.height * 0.16)); BALL_RADIUS = Math.max(6, Math.floor(PADDLE_HEIGHT * 0.12)); AI_X = canvas.width - 30 - PADDLE_WIDTH; playerY = Math.max(0, Math.min(canvas.height - PADDLE_HEIGHT, playerY)); aiY = Math.max(0, Math.min(canvas.height - PADDLE_HEIGHT, aiY)); }); }

init();
