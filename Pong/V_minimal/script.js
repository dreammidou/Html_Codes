const canvas = document.getElementById("pong-canvas");
const ctx = canvas.getContext("2d");

// Game constants
const PADDLE_WIDTH = 12;
const PADDLE_HEIGHT = 80;
const BALL_RADIUS = 10;
const PLAYER_X = 30;
const AI_X = canvas.width - 30 - PADDLE_WIDTH;

// State
let playerY = canvas.height / 2 - PADDLE_HEIGHT / 2;
let aiY = canvas.height / 2 - PADDLE_HEIGHT / 2;
let ball = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    vx: 5 * (Math.random() > 0.5 ? 1 : -1),
    vy: 3 * (Math.random() > 0.5 ? 1 : -1)
};

let playerScore = 0;
let aiScore = 0;

canvas.addEventListener("mousemove", e => {
    const rect = canvas.getBoundingClientRect();
    const mouseY = e.clientY - rect.top;
    // Center paddle on mouse
    playerY = mouseY - PADDLE_HEIGHT / 2;
    // Clamp paddle within canvas
    playerY = Math.max(0, Math.min(canvas.height - PADDLE_HEIGHT, playerY));
});

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
    ctx.fillText(text, x, y);
}

function resetBall() {
    ball.x = canvas.width / 2;
    ball.y = canvas.height / 2;
    ball.vx = 5 * (Math.random() > 0.5 ? 1 : -1);
    ball.vy = 3 * (Math.random() > 0.5 ? 1 : -1);
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
    }

    // Left wall - AI scores
    if (ball.x - BALL_RADIUS < 0) {
        aiScore++;
        resetBall();
    }

    // Right wall - Player scores
    if (ball.x + BALL_RADIUS > canvas.width) {
        playerScore++;
        resetBall();
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
    updateBall();
    updateAI();
    draw();
    requestAnimationFrame(gameLoop);
}

gameLoop();