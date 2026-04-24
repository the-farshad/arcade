(function () {
  const HI_KEY = 'arcade-breakout-hi';
  const canvas = document.getElementById('bk');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  const PADDLE_W = 90, PADDLE_H = 10;
  const BALL_R = 6;
  const BRICK_ROWS = 6, BRICK_COLS = 10;
  const BRICK_H = 18, BRICK_GAP = 4;
  const BRICK_TOP = 50;
  const COLORS = ['#e63946', '#f4a261', '#e9c46a', '#2a9d8f', '#264653', '#9b5de5'];

  let paddleX, ballX, ballY, ballVX, ballVY;
  let bricks = [];
  let score = 0, lives = 3, level = 1, hi = 0;
  let running = false, paused = false, attached = true;
  let raf;
  const keys = {};

  try { hi = parseInt(localStorage.getItem(HI_KEY), 10) || 0; } catch { hi = 0; }

  function makeBricks() {
    const totalGap = (BRICK_COLS + 1) * BRICK_GAP;
    const w = (W - totalGap) / BRICK_COLS;
    bricks = [];
    for (let r = 0; r < BRICK_ROWS; r++) {
      for (let c = 0; c < BRICK_COLS; c++) {
        bricks.push({
          x: BRICK_GAP + c * (w + BRICK_GAP),
          y: BRICK_TOP + r * (BRICK_H + BRICK_GAP),
          w, h: BRICK_H,
          color: COLORS[r % COLORS.length],
          alive: true,
        });
      }
    }
  }

  function reset(soft) {
    paddleX = (W - PADDLE_W) / 2;
    attachBall();
    if (!soft) { score = 0; lives = 3; level = 1; makeBricks(); }
    updateHud();
    draw();
  }

  function attachBall() {
    attached = true;
    ballX = paddleX + PADDLE_W / 2;
    ballY = H - 30 - BALL_R;
    const speed = 4 + level * 0.4;
    ballVX = speed * (Math.random() < 0.5 ? -1 : 1) * 0.7;
    ballVY = -speed;
  }

  function nextLevel() {
    level++;
    makeBricks();
    attachBall();
    updateHud();
  }

  function updateHud() {
    document.getElementById('score').textContent = score;
    document.getElementById('hi').textContent = hi;
    document.getElementById('lives').textContent = lives;
    document.getElementById('level').textContent = level;
  }

  function color(name) {
    return getComputedStyle(document.documentElement).getPropertyValue('--' + name).trim() || '#fff';
  }

  function step() {
    // paddle
    const pSpeed = 7;
    if (keys['arrowleft'] || keys['a']) paddleX -= pSpeed;
    if (keys['arrowright'] || keys['d']) paddleX += pSpeed;
    paddleX = Math.max(0, Math.min(W - PADDLE_W, paddleX));

    if (attached) { ballX = paddleX + PADDLE_W / 2; return; }

    // ball
    ballX += ballVX;
    ballY += ballVY;

    // walls
    if (ballX - BALL_R < 0) { ballX = BALL_R; ballVX *= -1; }
    if (ballX + BALL_R > W) { ballX = W - BALL_R; ballVX *= -1; }
    if (ballY - BALL_R < 0) { ballY = BALL_R; ballVY *= -1; }
    if (ballY > H + 20) {
      lives--;
      if (lives <= 0) { gameOver(); return; }
      attachBall();
      updateHud();
      return;
    }

    // paddle collision
    const py = H - 30;
    if (ballY + BALL_R >= py && ballY + BALL_R <= py + PADDLE_H + 4 && ballVY > 0) {
      if (ballX > paddleX && ballX < paddleX + PADDLE_W) {
        ballY = py - BALL_R;
        const off = (ballX - (paddleX + PADDLE_W / 2)) / (PADDLE_W / 2);
        const speed = Math.sqrt(ballVX * ballVX + ballVY * ballVY);
        const angle = off * 1.05; // up to ~60deg
        ballVX = speed * Math.sin(angle);
        ballVY = -Math.abs(speed * Math.cos(angle));
      }
    }

    // bricks
    for (const b of bricks) {
      if (!b.alive) continue;
      if (ballX + BALL_R > b.x && ballX - BALL_R < b.x + b.w &&
          ballY + BALL_R > b.y && ballY - BALL_R < b.y + b.h) {
        b.alive = false;
        score += 10;
        if (score > hi) { hi = score; try { localStorage.setItem(HI_KEY, String(hi)); } catch {} }
        // bounce direction: compare overlap
        const overlapX = Math.min(ballX + BALL_R - b.x, b.x + b.w - (ballX - BALL_R));
        const overlapY = Math.min(ballY + BALL_R - b.y, b.y + b.h - (ballY - BALL_R));
        if (overlapX < overlapY) ballVX *= -1; else ballVY *= -1;
        updateHud();
        if (bricks.every(br => !br.alive)) { nextLevel(); return; }
        break;
      }
    }
  }

  function gameOver() {
    running = false;
    cancelAnimationFrame(raf);
    draw();
    drawCenter('Game over', 'Score ' + score + (score >= hi ? ' (best!)' : ''));
  }

  function drawCenter(top, bottom) {
    ctx.fillStyle = 'rgba(0,0,0,.55)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '32px VT323, monospace';
    ctx.fillText(top, W / 2, H / 2 - 12);
    ctx.font = '20px VT323, monospace';
    ctx.fillText(bottom, W / 2, H / 2 + 18);
  }

  function draw() {
    ctx.fillStyle = color('btn-bg-strong');
    ctx.fillRect(0, 0, W, H);

    // bricks
    for (const b of bricks) {
      if (!b.alive) continue;
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
    }
    // paddle
    ctx.fillStyle = color('fg');
    ctx.fillRect(paddleX, H - 30, PADDLE_W, PADDLE_H);
    // ball
    ctx.beginPath();
    ctx.arc(ballX, ballY, BALL_R, 0, Math.PI * 2);
    ctx.fillStyle = color('accent');
    ctx.fill();
  }

  function loop() {
    if (!running) return;
    step();
    draw();
    if (running) raf = requestAnimationFrame(loop);
  }

  function start() {
    if (lives <= 0) reset(false);
    running = true;
    paused = false;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }
  function togglePause() {
    if (!running && !paused) return;
    if (running) { running = false; paused = true; drawCenter('Paused', 'press P or Pause'); }
    else { paused = false; running = true; raf = requestAnimationFrame(loop); }
  }

  document.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
    if (e.key === ' ') { attached = false; e.preventDefault(); }
    if (e.key.toLowerCase() === 'p') togglePause();
    if (['arrowleft','arrowright'].includes(e.key.toLowerCase())) e.preventDefault();
  });
  document.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

  function moveTo(clientX) {
    const r = canvas.getBoundingClientRect();
    const x = (clientX - r.left) * (W / r.width);
    paddleX = Math.max(0, Math.min(W - PADDLE_W, x - PADDLE_W / 2));
  }
  canvas.addEventListener('mousemove', (e) => moveTo(e.clientX));
  canvas.addEventListener('touchmove', (e) => { if (e.touches[0]) moveTo(e.touches[0].clientX); e.preventDefault(); }, { passive: false });
  canvas.addEventListener('click', () => { attached = false; if (!running) start(); });

  document.getElementById('play').addEventListener('click', start);
  document.getElementById('pause').addEventListener('click', togglePause);
  document.getElementById('reset').addEventListener('click', () => { reset(false); cancelAnimationFrame(raf); running = false; });

  new MutationObserver(() => draw())
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  reset(false);
})();
