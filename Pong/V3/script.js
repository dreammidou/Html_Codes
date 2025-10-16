const canvas = document.getElementById("pong-canvas");
const ctx = canvas.getContext("2d");

// make canvas size responsive to device pixel ratio and container
function resizeCanvas() {
    // keep logical size for game, but scale for high-DPI
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// initialize canvas CSS size if not set
function ensureCanvasInitialSize() {
    if (!canvas.style.width) {
        canvas.style.width = canvas.width + 'px';
        canvas.style.height = canvas.height + 'px';
    }
}

// DOM controls
const pauseBtn = document.getElementById('pause-btn');
const restartBtn = document.getElementById('restart-btn');
const startBtn = document.getElementById('start-btn');
const fullscreenBtn = document.getElementById('fullscreen-btn');
const scoreLimitSelect = document.getElementById('score-limit');
const difficultySelect = document.getElementById('difficulty');
const soundToggle = document.getElementById('sound-toggle');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayRestart = document.getElementById('overlay-restart');

// Game constants
const PADDLE_WIDTH = 12;
let PADDLE_HEIGHT = 80;
let BALL_RADIUS = 10;
const PLAYER_X = 30;
let AI_X = canvas.width - 30 - PADDLE_WIDTH;

// State
let playerY = 0;
let aiY = 0;
let ball = null;

let playerScore = 0;
let aiScore = 0;
let isPaused = true; // start paused until user presses Start
let gameOver = false;
let soundEnabled = true;

// Controls
let upPressed = false;
let downPressed = false;
let isDragging = false;

// Audio
let audioCtx = null;

function ensureAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function playBeep(freq = 440, duration = 0.08, type = 'sine', gain = 0.02) {
    if (!soundEnabled) return;
    try {
        ensureAudio();
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.type = type;
        o.frequency.value = freq;
        g.gain.value = gain;
        o.connect(g);
        g.connect(audioCtx.destination);
        o.start();
        o.stop(audioCtx.currentTime + duration);
    } catch (e) {
        // ignore audio errors
    }
}

function playHit() { playBeep(900, 0.04, 'square', 0.03); }
function playScore() { playBeep(220, 0.12, 'sine', 0.05); }

function createBall(direction = null) {
    const speed = 5;
    const angle = (Math.random() * 0.6 - 0.3); // -0.3..0.3
    const dir = direction === 'left' ? -1 : direction === 'right' ? 1 : (Math.random() > 0.5 ? 1 : -1);
    return {
        x: canvas.width / 2,
        y: canvas.height / 2,
        vx: dir * speed * Math.cos(angle),
        vy: speed * Math.sin(angle)
    };
}

// Mouse / pointer support: allow dragging the player's paddle
canvas.addEventListener('pointerdown', e => {
    const rect = canvas.getBoundingClientRect();
    const y = e.clientY - rect.top;
    // if pointer is near paddle, capture and drag
    if (Math.abs(y - (playerY + PADDLE_HEIGHT / 2)) < 150) {
        isDragging = true;
        canvas.setPointerCapture(e.pointerId);
        updatePlayerFromY(y);
    }
});
canvas.addEventListener('pointermove', e => {
    if (!isDragging) return;
    const rect = canvas.getBoundingClientRect();
    const y = e.clientY - rect.top;
    updatePlayerFromY(y);
});
canvas.addEventListener('pointerup', e => {
    isDragging = false;
});

canvas.addEventListener("mousemove", e => {
    if (isDragging) return; // pointermove handles drag
    const rect = canvas.getBoundingClientRect();
    const mouseY = e.clientY - rect.top;
    // Center paddle on mouse
    playerY = mouseY - PADDLE_HEIGHT / 2;
    // Clamp paddle within canvas
    playerY = Math.max(0, Math.min(canvas.height - PADDLE_HEIGHT, playerY));
});

function updatePlayerFromY(mouseY) {
    playerY = mouseY - PADDLE_HEIGHT / 2;
    playerY = Math.max(0, Math.min(canvas.height - PADDLE_HEIGHT, playerY));
}

// Keyboard controls
window.addEventListener('keydown', e => {
    if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') upPressed = true;
    if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') downPressed = true;
    // Space toggles pause
    if (e.code === 'Space') {
        // if game over, restart; if paused, unpause
        if (gameOver) restartGame();
        else togglePause();
    }
});
window.addEventListener('keyup', e => {
    if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') upPressed = false;
    if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') downPressed = false;
});

pauseBtn.addEventListener('click', togglePause);
restartBtn.addEventListener('click', restartGame);
overlayRestart.addEventListener('click', restartGame);
scoreLimitSelect.addEventListener('change', () => {
    // Apply new score limit mid-game (doesn't reset scores)
});
startBtn.addEventListener('click', () => {
    if (gameOver) restartGame();
    isPaused = false;
    overlay.classList.add('hidden');
    ensureAudio();
});
fullscreenBtn.addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else canvas.requestFullscreen().catch(()=>{});
});
difficultySelect.addEventListener('change', () => {
    // nothing immediate; AI will read difficulty each frame
});
soundToggle.addEventListener('change', () => {
    soundEnabled = soundToggle.value === 'on';
    if (soundEnabled) ensureAudio();
});

function togglePause() {
    if (gameOver) return;
    isPaused = !isPaused;
    pauseBtn.textContent = isPaused ? 'Resume' : 'Pause';
    // resume audio context on user gesture
    if (!isPaused) ensureAudio();
}

function restartGame() {
    playerScore = 0;
    aiScore = 0;
    ball = createBall();
    playerY = canvas.height / 2 - PADDLE_HEIGHT / 2;
    aiY = canvas.height / 2 - PADDLE_HEIGHT / 2;
    isPaused = true;
    gameOver = false;
    pauseBtn.textContent = 'Pause';
    overlay.classList.add('hidden');
}

function drawRect(x, y, w, h, color="#fff") {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
}

function drawCircle(x, y, r, color="#fff") {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fill();
}

function drawText(text, x, y, color="#fff") {
    ctx.fillStyle = color;
    ctx.font = "32px Arial";
    ctx.textAlign = 'center';
    ctx.fillText(text, x, y);
}

function resetBall() {
    ball = createBall();
}

function updateBall() {
    ball.x += ball.vx;
    ball.y += ball.vy;

    // Top/bottom collision
    if (ball.y - BALL_RADIUS < 0) {
        ball.y = BALL_RADIUS;
        ball.vy *= -1;
    } else if (ball.y + BALL_RADIUS > canvas.height) {
        ball.y = canvas.height - BALL_RADIUS;
        ball.vy *= -1;
    }

    // Left paddle collision (player)
    if (
        ball.x - BALL_RADIUS < PLAYER_X + PADDLE_WIDTH &&
        ball.y > playerY &&
        ball.y < playerY + PADDLE_HEIGHT
    ) {
        ball.x = PLAYER_X + PADDLE_WIDTH + BALL_RADIUS; // Prevent sticking
    ball.vx *= -1.05; // Add some speed
        // Add spin based on where hit
        let hitPos = (ball.y - playerY - PADDLE_HEIGHT / 2) / (PADDLE_HEIGHT / 2);
        ball.vy += hitPos * 2;
        playHit();
    }

    // Right paddle collision (AI)
    if (
        ball.x + BALL_RADIUS > AI_X &&
        ball.y > aiY &&
        ball.y < aiY + PADDLE_HEIGHT
    ) {
        ball.x = AI_X - BALL_RADIUS; // Prevent sticking
    ball.vx *= -1.05;
        let hitPos = (ball.y - aiY - PADDLE_HEIGHT / 2) / (PADDLE_HEIGHT / 2);
        ball.vy += hitPos * 2;
        playHit();
    }

    // Left wall - AI scores
    if (ball.x - BALL_RADIUS < 0) {
        aiScore++;
        playScore();
        resetBall();
        checkWin();
    }

    // Right wall - Player scores
    if (ball.x + BALL_RADIUS > canvas.width) {
        playerScore++;
        playScore();
        resetBall();
        checkWin();
    }
}

function checkWin() {
    const limit = parseInt(scoreLimitSelect.value, 10) || 5;
    if (playerScore >= limit || aiScore >= limit) {
        gameOver = true;
        isPaused = true;
        pauseBtn.textContent = 'Pause';
        overlay.classList.remove('hidden');
        overlayTitle.textContent = playerScore > aiScore ? 'Player wins!' : 'AI wins!';
    }
}

function updateAI() {
    // Simple AI: move paddle towards ball
    const diff = difficultySelect ? difficultySelect.value : 'normal';
    let reaction = 0.95; // how closely AI tracks ball (1 = perfect)
    let speed = 4;
    if (diff === 'easy') { reaction = 0.75; speed = 3; }
    if (diff === 'normal') { reaction = 0.92; speed = 4; }
    if (diff === 'hard') { reaction = 0.99; speed = 6; }

    let center = aiY + PADDLE_HEIGHT / 2;
    // only move if ball is moving towards AI or within center region
    if (Math.abs(center - ball.y) > 6) {
        if (center < ball.y) aiY += speed * reaction;
        else aiY -= speed * reaction;
    }
    // Clamp paddle within canvas
    aiY = Math.max(0, Math.min(canvas.height - PADDLE_HEIGHT, aiY));
}

function draw() {
    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw net
    for (let y = 0; y < canvas.height; y += 30) {
        drawRect(canvas.width / 2 - 2, y, 4, 18, "#888");
    }

    // Draw paddles
    drawRect(PLAYER_X, playerY, PADDLE_WIDTH, PADDLE_HEIGHT, "#0ff");
    drawRect(AI_X, aiY, PADDLE_WIDTH, PADDLE_HEIGHT, "#f00");

    // Draw ball
    drawCircle(ball.x, ball.y, BALL_RADIUS, "#fff");

    // Draw scores
    drawText(playerScore, canvas.width / 4, 50);
    drawText(aiScore, canvas.width * 3 / 4, 50);
}

function gameLoop() {
    if (!isPaused) {
        // keyboard movement
        const speed = 6;
        if (upPressed) playerY -= speed;
        if (downPressed) playerY += speed;
        // clamp
        playerY = Math.max(0, Math.min(canvas.height - PADDLE_HEIGHT, playerY));

        updateBall();
        updateAI();
    }
    draw();
    requestAnimationFrame(gameLoop);
}

// Start
// Set initial sizes and start loop
function init() {
    ensureCanvasInitialSize();
    resizeCanvas();
    // recalc constants based on canvas logical height
    PADDLE_HEIGHT = Math.max(48, Math.floor(canvas.height / (devicePixelRatio ? devicePixelRatio : 1) * 0.16));
    BALL_RADIUS = Math.max(6, Math.floor(PADDLE_HEIGHT * 0.12));
    AI_X = canvas.width / (window.devicePixelRatio || 1) - 30 - PADDLE_WIDTH;
    playerY = canvas.height / (window.devicePixelRatio || 1) / 2 - PADDLE_HEIGHT / 2;
    aiY = canvas.height / (window.devicePixelRatio || 1) / 2 - PADDLE_HEIGHT / 2;
    ball = createBall();
    window.addEventListener('resize', () => {
        resizeCanvas();
        // reposition paddles proportionally
        playerY = Math.max(0, Math.min(canvas.height - PADDLE_HEIGHT, playerY));
        aiY = Math.max(0, Math.min(canvas.height - PADDLE_HEIGHT, aiY));
    });
    gameLoop();
}

init();
