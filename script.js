const canvas = document.getElementById("gameCanvas");
const context = canvas.getContext("2d");
const startBtn = document.getElementById("startBtn");
const restartBtn = document.getElementById("restartBtn");
const overlay = document.getElementById("overlay");
const overlayText = document.getElementById("overlayText");
const difficultySelect = document.getElementById("difficulty");
const playerScoreEl = document.getElementById("playerScore");
const cpuScoreEl = document.getElementById("cpuScore");

const width = canvas.width;
const height = canvas.height;

const paddleWidth = 16;
const paddleHeight = 110;
const ballRadius = 12;

const player = { x: 24, y: height / 2 - paddleHeight / 2, dy: 0, score: 0 };
const cpu = { x: width - 24 - paddleWidth, y: height / 2 - paddleHeight / 2, dy: 0, score: 0 };
const ball = { x: width / 2, y: height / 2, vx: 0, vy: 0, speed: 0 };

let animationFrame;
let gameRunning = false;
let activeSettings = null;

const difficultySettings = {
  easy: { cpuSkill: 0.06, startSpeed: 5.5, hitBoost: 1.0, maxSpeed: 12 },
  medium: { cpuSkill: 0.1, startSpeed: 7.0, hitBoost: 1.3, maxSpeed: 14 },
  hard: { cpuSkill: 0.16, startSpeed: 8.0, hitBoost: 1.6, maxSpeed: 16 },
};

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playTone(freq, duration = 0.08, type = "sine", volume = 0.16) {
  const oscillator = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime);
  gain.gain.setValueAtTime(volume, audioCtx.currentTime);
  oscillator.connect(gain);
  gain.connect(audioCtx.destination);
  oscillator.start();
  oscillator.stop(audioCtx.currentTime + duration);
}

function getSettings() {
  return difficultySettings[difficultySelect.value] || difficultySettings.medium;
}

function resetBall(winner) {
  ball.x = width / 2;
  ball.y = height / 2;
  const angle = (Math.random() * Math.PI) / 4 - Math.PI / 8;
  const direction = winner === "player" ? -1 : 1;
  ball.speed = activeSettings.startSpeed;
  ball.vx = direction * ball.speed * Math.cos(angle);
  ball.vy = ball.speed * Math.sin(angle);
}

function drawRect(x, y, w, h, color) {
  context.fillStyle = color;
  context.fillRect(x, y, w, h);
}

function drawBall() {
  context.save();
  context.shadowColor = "rgba(91,209,255,0.6)";
  context.shadowBlur = 14;
  context.shadowOffsetX = 0;
  context.shadowOffsetY = 0;
  context.beginPath();
  context.arc(ball.x, ball.y, ballRadius, 0, Math.PI * 2);
  context.fillStyle = "#5bd1ff";
  context.fill();
  context.closePath();
  context.restore();
}

function drawNet() {
  context.strokeStyle = "rgba(91,209,255,0.35)";
  context.lineWidth = 4;
  context.setLineDash([18, 18]);
  context.beginPath();
  context.moveTo(width / 2, 0);
  context.lineTo(width / 2, height);
  context.stroke();
  context.setLineDash([]);
}

function draw() {
  context.clearRect(0, 0, width, height);
  drawRect(0, 0, width, height, "rgba(16,22,32,0.95)");
  drawNet();
  drawRect(player.x, player.y, paddleWidth, paddleHeight, "#5bd1ff");
  drawRect(cpu.x, cpu.y, paddleWidth, paddleHeight, "#8dc6ff");
  drawBall();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function updateSpeed(amount = 0) {
  const nextSpeed = Math.min(activeSettings.maxSpeed, Math.max(ball.speed + amount, activeSettings.startSpeed));
  const angle = Math.atan2(ball.vy, ball.vx);
  const direction = Math.sign(ball.vx) || 1;
  ball.speed = nextSpeed;
  ball.vx = direction * nextSpeed * Math.cos(angle);
  ball.vy = nextSpeed * Math.sin(angle);
}

function showOverlay(message) {
  overlayText.textContent = message;
  overlay.classList.remove("hidden");
}

function hideOverlay() {
  overlay.classList.add("hidden");
}

function endGame(message) {
  gameRunning = false;
  showOverlay(message);
  playTone(160, 0.3, "sawtooth", 0.23);
}

function isBallOverlappingPaddle(paddle) {
  return (
    ball.x - ballRadius < paddle.x + paddleWidth &&
    ball.x + ballRadius > paddle.x &&
    ball.y + ballRadius > paddle.y &&
    ball.y - ballRadius < paddle.y + paddleHeight
  );
}

function bounceFromPaddle(paddle, isLeft) {
  if (!isBallOverlappingPaddle(paddle)) return false;
  if (isLeft && ball.vx > 0) return false;
  if (!isLeft && ball.vx < 0) return false;

  const relativeY = (ball.y - (paddle.y + paddleHeight / 2)) / (paddleHeight / 2);
  const bounceAngle = relativeY * (Math.PI / 4);
  const speed = Math.min(activeSettings.maxSpeed, Math.max(ball.speed + activeSettings.hitBoost, activeSettings.startSpeed));
  ball.speed = speed;

  const direction = isLeft ? 1 : -1;
  ball.vx = direction * Math.cos(bounceAngle) * speed;
  ball.vy = Math.sin(bounceAngle) * speed;

  ball.x = isLeft ? paddle.x + paddleWidth + ballRadius + 2 : paddle.x - ballRadius - 2;
  return true;
}

function update() {
  player.y = clamp(player.y + player.dy, 0, height - paddleHeight);

  const cpuTarget = ball.y - paddleHeight / 2;
  const cpuSpeed = activeSettings.cpuSkill * 8 + 2;
  cpu.y = clamp(cpu.y + clamp(cpuTarget - cpu.y, -cpuSpeed, cpuSpeed), 0, height - paddleHeight);

  ball.x += ball.vx;
  ball.y += ball.vy;

  if (ball.y - ballRadius < 0) {
    ball.y = ballRadius;
    ball.vy = Math.abs(ball.vy);
    playTone(520, 0.06, "triangle", 0.1);
  } else if (ball.y + ballRadius > height) {
    ball.y = height - ballRadius;
    ball.vy = -Math.abs(ball.vy);
    playTone(520, 0.06, "triangle", 0.1);
  }

  const hitLeft = bounceFromPaddle(player, true);
  const hitRight = bounceFromPaddle(cpu, false);

  if (hitLeft) {
    playTone(660, 0.08, "sine", 0.15);
  }
  if (hitRight) {
    playTone(520, 0.08, "sine", 0.12);
  }

  if (ball.x - ballRadius < 0) {
    cpu.score += 1;
    cpuScoreEl.textContent = cpu.score;
    endGame("Missed the ball! Game Over");
    return;
  }

  if (ball.x + ballRadius > width) {
    player.score += 1;
    playerScoreEl.textContent = player.score;
    resetBall("player");
    playTone(760, 0.1, "triangle", 0.16);
    return;
  }

  if (isBallOverlappingPaddle(player)) {
    ball.x = player.x + paddleWidth + ballRadius + 2;
    ball.vx = Math.max(Math.abs(ball.vx), activeSettings.startSpeed);
  }

  if (isBallOverlappingPaddle(cpu)) {
    ball.x = cpu.x - ballRadius - 2;
    ball.vx = -Math.max(Math.abs(ball.vx), activeSettings.startSpeed);
  }
}

function loop() {
  if (!gameRunning) return;
  update();
  draw();
  animationFrame = requestAnimationFrame(loop);
}

function startGame() {
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }

  player.score = 0;
  cpu.score = 0;
  playerScoreEl.textContent = "0";
  cpuScoreEl.textContent = "0";
  player.y = height / 2 - paddleHeight / 2;
  cpu.y = height / 2 - paddleHeight / 2;
  player.dy = 0;
  activeSettings = getSettings();
  resetBall(Math.random() > 0.5 ? "player" : "cpu");
  hideOverlay();
  gameRunning = true;
  cancelAnimationFrame(animationFrame);
  loop();
}

window.addEventListener("keydown", (event) => {
  if (event.key === "w" || event.key === "W" || event.key === "ArrowUp") {
    player.dy = -10;
  }
  if (event.key === "s" || event.key === "S" || event.key === "ArrowDown") {
    player.dy = 10;
  }
});

window.addEventListener("keyup", (event) => {
  if (["w", "W", "s", "S", "ArrowUp", "ArrowDown"].includes(event.key)) {
    player.dy = 0;
  }
});

startBtn.addEventListener("click", startGame);
restartBtn.addEventListener("click", startGame);

draw();
context.font = "700 24px Inter, sans-serif";
context.fillStyle = "rgba(255,255,255,0.12)";
context.textAlign = "center";
context.fillText("Press Start to Play", width / 2, height / 2);
