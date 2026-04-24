(function () {
  const HI_KEY = 'arcade-snake-hi';
  const canvas = document.getElementById('snake');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const hiEl = document.getElementById('hi');
  const lenEl = document.getElementById('len');
  const playBtn = document.getElementById('play');
  const pauseBtn = document.getElementById('pause');
  const resetBtn = document.getElementById('reset');

  const COLS = 25, ROWS = 25;
  const cell = canvas.width / COLS;

  let snake, dir, queuedDir, food, score, hi, ticks, speed, alive, paused, started;
  let wrapMode = 'wrap';
  let raf, lastStep;

  function readHi() {
    try { return parseInt(localStorage.getItem(HI_KEY), 10) || 0; }
    catch { return 0; }
  }
  function writeHi(v) {
    try { localStorage.setItem(HI_KEY, String(v)); } catch (e) {}
  }

  function reset() {
    snake = [{x: 12, y: 12}, {x: 11, y: 12}, {x: 10, y: 12}];
    dir = {x: 1, y: 0};
    queuedDir = dir;
    score = 0;
    speed = 9; // steps per second
    ticks = 0;
    alive = true;
    paused = false;
    started = false;
    placeFood();
    updateHud();
    draw();
  }

  function placeFood() {
    const occupied = new Set(snake.map(s => s.x + ',' + s.y));
    let x, y;
    do {
      x = (Math.random() * COLS) | 0;
      y = (Math.random() * ROWS) | 0;
    } while (occupied.has(x + ',' + y));
    food = { x, y };
  }

  function updateHud() {
    scoreEl.textContent = score;
    hiEl.textContent = hi;
    lenEl.textContent = snake.length;
  }

  function step() {
    dir = queuedDir;
    let nx = snake[0].x + dir.x;
    let ny = snake[0].y + dir.y;
    if (wrapMode === 'wrap') {
      nx = (nx + COLS) % COLS;
      ny = (ny + ROWS) % ROWS;
    } else {
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) { gameOver(); return; }
    }
    if (snake.some(s => s.x === nx && s.y === ny)) { gameOver(); return; }

    snake.unshift({x: nx, y: ny});
    if (nx === food.x && ny === food.y) {
      score += 10;
      if (score > hi) { hi = score; writeHi(hi); }
      if (snake.length % 5 === 0) speed = Math.min(20, speed + 0.5);
      placeFood();
    } else {
      snake.pop();
    }
    updateHud();
  }

  function gameOver() {
    alive = false;
    cancelAnimationFrame(raf);
    draw();
    drawCenter('Game over', 'Score ' + score + (score >= hi ? ' (best!)' : ''));
  }

  function drawCenter(top, bottom) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '32px VT323, monospace';
    ctx.fillText(top, canvas.width / 2, canvas.height / 2 - 12);
    ctx.font = '20px VT323, monospace';
    ctx.fillText(bottom, canvas.width / 2, canvas.height / 2 + 18);
  }

  function color(name) {
    return getComputedStyle(document.documentElement).getPropertyValue('--' + name).trim() || '#fff';
  }

  function draw() {
    ctx.fillStyle = color('btn-bg-strong');
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // grid
    ctx.fillStyle = color('btn-bg');
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if ((x + y) % 2) ctx.fillRect(x * cell, y * cell, cell, cell);
      }
    }
    // food
    ctx.fillStyle = color('accent');
    ctx.beginPath();
    ctx.arc(food.x * cell + cell / 2, food.y * cell + cell / 2, cell / 2 - 2, 0, Math.PI * 2);
    ctx.fill();
    // snake
    snake.forEach((s, i) => {
      ctx.fillStyle = i === 0 ? color('fg') : color('accent');
      ctx.fillRect(s.x * cell + 1, s.y * cell + 1, cell - 2, cell - 2);
    });
  }

  function loop(ts) {
    if (!alive || paused) return;
    if (!lastStep) lastStep = ts;
    if (ts - lastStep >= 1000 / speed) {
      step();
      lastStep = ts;
      draw();
    }
    if (alive) raf = requestAnimationFrame(loop);
  }

  function start() {
    if (!alive) reset();
    started = true;
    paused = false;
    lastStep = 0;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  function togglePause() {
    if (!started || !alive) return;
    paused = !paused;
    if (!paused) {
      lastStep = 0;
      raf = requestAnimationFrame(loop);
    } else {
      drawCenter('Paused', 'press P or Pause');
    }
  }

  function setDir(dx, dy) {
    if (!started) start();
    if (snake.length > 1 && (dir.x + dx === 0 && dir.y + dy === 0)) return;
    queuedDir = { x: dx, y: dy };
  }

  // ---------- input ----------

  document.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (k === 'arrowup' || k === 'w')    { setDir(0, -1); e.preventDefault(); }
    if (k === 'arrowdown' || k === 's')  { setDir(0,  1); e.preventDefault(); }
    if (k === 'arrowleft' || k === 'a')  { setDir(-1, 0); e.preventDefault(); }
    if (k === 'arrowright' || k === 'd') { setDir(1, 0); e.preventDefault(); }
    if (k === 'p') togglePause();
  });

  // touch: swipe
  let touchStart = null;
  canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  }, { passive: true });
  canvas.addEventListener('touchend', (e) => {
    if (!touchStart || e.changedTouches.length === 0) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.x;
    const dy = t.clientY - touchStart.y;
    if (Math.abs(dx) < 20 && Math.abs(dy) < 20) {
      if (!started) start();
      else togglePause();
    } else if (Math.abs(dx) > Math.abs(dy)) {
      setDir(dx > 0 ? 1 : -1, 0);
    } else {
      setDir(0, dy > 0 ? 1 : -1);
    }
    touchStart = null;
  });

  playBtn.addEventListener('click', () => { if (!alive) reset(); start(); });
  pauseBtn.addEventListener('click', togglePause);
  resetBtn.addEventListener('click', () => { reset(); cancelAnimationFrame(raf); });

  document.querySelectorAll('.seg[data-control="walls"] button').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.seg[data-control="walls"] button').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      wrapMode = b.dataset.value;
    });
  });

  // re-draw on theme change so colors update
  new MutationObserver(() => { if (alive) draw(); else { reset(); } })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  hi = readHi();
  reset();
})();
