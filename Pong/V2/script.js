const canvas = document.getElementById("pong-canvas");
const ctx = canvas.getContext("2d");

// DOM controls
const pauseBtn = document.getElementById('pause-btn');
const restartBtn = document.getElementById('restart-btn');
const scoreLimitSelect = document.getElementById('score-limit');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayRestart = document.getElementById('overlay-restart');

// Game constants
const PADDLE_WIDTH = 12;
const PADDLE_HEIGHT = 80;
const BALL_RADIUS = 10;
const PLAYER_X = 30;
const AI_X = canvas.width - 30 - PADDLE_WIDTH;

// State
let playerY = canvas.height / 2 - PADDLE_HEIGHT / 2;
let aiY = canvas.height / 2 - PADDLE_HEIGHT / 2;
let ball = createBall();

let playerScore = 0;
let aiScore = 0;
let isPaused = false;
let gameOver = false;

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

function createBall() {
    return {
        x: canvas.width / 2,
        y: canvas.height / 2,
        vx: 5 * (Math.random() > 0.5 ? 1 : -1),
        vy: 3 * (Math.random() > 0.5 ? 1 : -1)
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
    if (e.code === 'Space') togglePause();
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
    isPaused = false;
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
    if (ball.y - BALL_RADIUS < 0 || ball.y + BALL_RADIUS > canvas.height) {
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
    let center = aiY + PADDLE_HEIGHT / 2;
    if (center < ball.y - 10) {
        aiY += 4;
    } else if (center > ball.y + 10) {
        aiY -= 4;
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
gameLoop();