// V4 improvements: settings saved, serve countdown, predictive AI, speed clamp, responsive fonts
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

function clampSpeed(){
    const mag = Math.hypot(ball.vx, ball.vy);
    if (mag > MAX_BALL_SPEED){
        const s = MAX_BALL_SPEED / mag;
        ball.vx *= s; ball.vy *= s;
    }
}

// predictive AI: simulate to find Y where ball crosses targetX
function predictBallYAtX(targetX){
    // use a simple simulation with small dt steps, capped iterations
    let x = ball.x, y = ball.y, vx = ball.vx, vy = ball.vy;
    const H = canvas.height;
    const MAX_ITERS = 2000;
    let it = 0;
    // if vx is 0, return center
    if (Math.abs(vx) < 0.001) return H/2;
    while(it++ < MAX_ITERS){
        // time to next vertical wall
        let t;
        if (vx > 0){ // moving right
            if (x >= targetX) break;
            // choose dt to advance to either targetX or next vertical collision
            t = (targetX - x) / vx;
        } else {
            if (x <= targetX) break;
            t = (targetX - x) / vx;
        }
        // if t small and positive, advance directly
        if (t > 0 && Math.abs(t) < 1){
            y += vy * t; x += vx * t; break;
        }
        // step by a small delta (scaled to speed)
        const dt = 1; // coarse step
        x += vx * dt; y += vy * dt;
        // reflect off top/bottom
        if (y < 0){ y = -y; vy *= -1; }
        if (y > H){ y = 2*H - y; vy *= -1; }
        // if we crossed targetX, break
        if ((vx > 0 && x >= targetX) || (vx < 0 && x <= targetX)) break;
    }
    return Math.max(0, Math.min(canvas.height, y));
}

// input
canvas.addEventListener('pointerdown', e=>{
    const rect = canvas.getBoundingClientRect();
    const y = e.clientY - rect.top; if (Math.abs(y - (playerY + PADDLE_HEIGHT/2)) < 150){ isDragging=true; canvas.setPointerCapture(e.pointerId); updatePlayerFromY(y);} });
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

// settings (localStorage)
function loadSettings(){ const diff = localStorage.getItem('pong:difficulty'); if (diff) difficultySelect.value = diff; const sound = localStorage.getItem('pong:sound'); if (sound) soundToggle.value = sound; const limit = localStorage.getItem('pong:limit'); if (limit) scoreLimitSelect.value = limit; applySettings(); }
function saveSettings(){ localStorage.setItem('pong:difficulty', difficultySelect.value); localStorage.setItem('pong:sound', soundToggle.value); localStorage.setItem('pong:limit', scoreLimitSelect.value); applySettings(); }
function applySettings(){ statusDiff.textContent = difficultySelect.value; statusSound.textContent = soundToggle.value === 'on' ? 'On' : 'Off'; soundEnabled = soundToggle.value === 'on'; }
difficultySelect.addEventListener('change', ()=>{ saveSettings(); }); soundToggle.addEventListener('change', ()=>{ saveSettings(); if (soundEnabled) ensureAudio(); }); scoreLimitSelect.addEventListener('change', saveSettings);

// game functions
function togglePause(){ if (gameOver) return; isPaused = !isPaused; pauseBtn.textContent = isPaused ? 'Resume' : 'Pause'; if (!isPaused) ensureAudio(); }

function restartGame(){ playerScore=0; aiScore=0; ball = createBall(); playerY = (canvas.height/2) - PADDLE_HEIGHT/2; aiY = playerY; isPaused = true; gameOver=false; pauseBtn.textContent='Pause'; overlay.classList.remove('hidden'); overlayTitle.textContent='Ready to play'; overlaySub.textContent='Press Start or spacebar to serve.'; }

function startServe(){ // alternate server
    overlay.classList.remove('hidden'); countdownEl.style.display='block';
    let n=3; countdownEl.textContent = n; overlayTitle.textContent = 'Get ready';
    const t = setInterval(()=>{
        n--; if (n>0){ countdownEl.textContent = n; } else { clearInterval(t); countdownEl.style.display='none'; overlay.classList.add('hidden'); // serve
            const dir = lastServer === 'player' ? 'right' : 'left'; lastServer = lastServer==='player' ? 'ai' : 'player'; ball = createBall(dir); isPaused = false; ensureAudio(); }
    }, 700);
}

function resetBall(){ ball = createBall(); }

function updateBall(){ if (!ball) return; ball.x += ball.vx; ball.y += ball.vy;
    // vertical collisions
    if (ball.y - BALL_RADIUS < 0){ ball.y = BALL_RADIUS; ball.vy *= -1; }
    else if (ball.y + BALL_RADIUS > canvas.height){ ball.y = canvas.height - BALL_RADIUS; ball.vy *= -1; }
    // player paddle
    if (ball.x - BALL_RADIUS < PLAYER_X + PADDLE_WIDTH && ball.y > playerY && ball.y < playerY + PADDLE_HEIGHT){ ball.x = PLAYER_X + PADDLE_WIDTH + BALL_RADIUS; ball.vx *= -1.07; let hitPos = (ball.y - playerY - PADDLE_HEIGHT/2)/(PADDLE_HEIGHT/2); ball.vy += hitPos*2; playHit(); }
    // ai paddle
    if (ball.x + BALL_RADIUS > AI_X && ball.y > aiY && ball.y < aiY + PADDLE_HEIGHT){ ball.x = AI_X - BALL_RADIUS; ball.vx *= -1.07; let hitPos = (ball.y - aiY - PADDLE_HEIGHT/2)/(PADDLE_HEIGHT/2); ball.vy += hitPos*2; playHit(); }
    clampSpeed();
    // scores
    if (ball.x - BALL_RADIUS < 0){ aiScore++; playScore(); checkWin(); resetBall(); }
    if (ball.x + BALL_RADIUS > canvas.width){ playerScore++; playScore(); checkWin(); resetBall(); }
}

function checkWin(){ const limit = parseInt(scoreLimitSelect.value,10)||5; if (playerScore>=limit||aiScore>=limit){ gameOver=true; isPaused=true; pauseBtn.textContent='Pause'; overlay.classList.remove('hidden'); overlayTitle.textContent = playerScore>aiScore ? 'Player wins!' : 'AI wins!'; overlaySub.textContent = 'Press Restart to play again.'; } }

function updateAI(){ const diff = difficultySelect.value||'normal'; let speed=4, reaction=0.92; if (diff==='easy'){ speed=3; reaction=0.78 } if (diff==='hard'){ speed=6; reaction=0.995 }
    // predictive when ball heading to AI
    let center = aiY + PADDLE_HEIGHT/2;
    let targetY = canvas.height/2;
    if (ball && ball.vx > 0){ targetY = predictBallYAtX(canvas.width - 30 - PADDLE_WIDTH); }
    const delta = targetY - center;
    if (Math.abs(delta) > 6){ aiY += Math.sign(delta) * speed * reaction; }
    aiY = Math.max(0, Math.min(canvas.height - PADDLE_HEIGHT, aiY));
}

function drawRect(x,y,w,h,color='#fff'){ ctx.fillStyle=color; ctx.fillRect(x,y,w,h); }
function drawCircle(x,y,r,color='#fff'){ ctx.fillStyle=color; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.closePath(); ctx.fill(); }
function drawText(text,x,y,color='#fff',size){ ctx.fillStyle=color; ctx.font = (size||Math.max(12, Math.floor((canvas.width/ (window.devicePixelRatio||1)) * 0.04))) + 'px Arial'; ctx.textAlign='center'; ctx.fillText(text,x,y); }

function draw(){ ctx.clearRect(0,0,canvas.width,canvas.height);
    // net
    for (let y=0;y<canvas.height;y+=30){ drawRect(canvas.width/2-2,y,4,18,'#666'); }
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
