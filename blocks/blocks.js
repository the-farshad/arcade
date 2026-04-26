(function () {
  const HI_KEY = 'arcade-blocks-hi';
  const canvas = document.getElementById('bk');
  const ctx = canvas.getContext('2d');
  const COLS = 10, ROWS = 20, CELL = 30;

  const SHAPES = {
    I: { color: '#3ab4f2', cells: [[0,1],[1,1],[2,1],[3,1]] },
    O: { color: '#f7d046', cells: [[0,0],[1,0],[0,1],[1,1]] },
    T: { color: '#a44ce0', cells: [[1,0],[0,1],[1,1],[2,1]] },
    S: { color: '#5dd962', cells: [[1,0],[2,0],[0,1],[1,1]] },
    Z: { color: '#ff5c5c', cells: [[0,0],[1,0],[1,1],[2,1]] },
    J: { color: '#3a6df0', cells: [[0,0],[0,1],[1,1],[2,1]] },
    L: { color: '#ff9f1c', cells: [[2,0],[0,1],[1,1],[2,1]] },
  };

  let board, current, bag = [];
  let score = 0, lines = 0, level = 1, hi = 0;
  let dropMs = 700;
  let lastDrop = 0;
  let running = false, paused = false, gameover = false;
  let raf;

  try { hi = parseInt(localStorage.getItem(HI_KEY), 10) || 0; } catch { hi = 0; }

  function newBoard() { return Array.from({ length: ROWS }, () => Array(COLS).fill(null)); }

  function refillBag() {
    bag = ['I','O','T','S','Z','J','L'];
    for (let i = bag.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
  }
  function nextPiece() {
    if (!bag.length) refillBag();
    const k = bag.pop();
    const s = SHAPES[k];
    return {
      type: k,
      color: s.color,
      cells: s.cells.map(c => c.slice()),
      x: Math.floor((COLS - 4) / 2),
      y: -1,
      rot: 0,
    };
  }

  function rotateCells(cells, dir) {
    // rotate around center (1.5, 1.5) for I we approximate
    return cells.map(([x, y]) => dir > 0 ? [-y + 2, x] : [y, -x + 2]);
  }

  function valid(piece, dx = 0, dy = 0, cells = piece.cells) {
    for (const [cx, cy] of cells) {
      const x = piece.x + cx + dx, y = piece.y + cy + dy;
      if (x < 0 || x >= COLS || y >= ROWS) return false;
      if (y >= 0 && board[y][x]) return false;
    }
    return true;
  }

  function lock(piece) {
    for (const [cx, cy] of piece.cells) {
      const x = piece.x + cx, y = piece.y + cy;
      if (y < 0) { gameover = true; return; }
      board[y][x] = piece.color;
    }
    clearLines();
  }

  function clearLines() {
    let cleared = 0;
    for (let y = ROWS - 1; y >= 0; y--) {
      if (board[y].every(c => c)) {
        board.splice(y, 1);
        board.unshift(Array(COLS).fill(null));
        cleared++;
        y++;
      }
    }
    if (cleared) {
      const points = [0, 100, 300, 500, 800][cleared] * level;
      score += points;
      if (score > hi) { hi = score; try { localStorage.setItem(HI_KEY, String(hi)); } catch {} }
      lines += cleared;
      const newLevel = 1 + Math.floor(lines / 10);
      if (newLevel !== level) {
        level = newLevel;
        dropMs = Math.max(80, 700 - (level - 1) * 60);
      }
    }
    updateHud();
  }

  function updateHud() {
    document.getElementById('score').textContent = score;
    document.getElementById('hi').textContent = hi;
    document.getElementById('lines').textContent = lines;
    document.getElementById('level').textContent = level;
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
        if ((x + y) % 2) ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
      }
    }
    // locked board
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (board[y][x]) drawCell(x, y, board[y][x]);
      }
    }
    if (current) {
      // ghost
      let gy = 0;
      while (valid(current, 0, gy + 1)) gy++;
      for (const [cx, cy] of current.cells) {
        const x = current.x + cx, y = current.y + cy + gy;
        if (y >= 0) drawCell(x, y, current.color, 0.25);
      }
      // active
      for (const [cx, cy] of current.cells) {
        const x = current.x + cx, y = current.y + cy;
        if (y >= 0) drawCell(x, y, current.color);
      }
    }
    if (gameover) drawCenter('Game over', 'Score ' + score);
    else if (paused) drawCenter('Paused', 'press P or Pause');
  }

  function drawCell(x, y, col, alpha) {
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.fillStyle = col;
    ctx.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2);
    ctx.globalAlpha = 1;
  }

  function drawCenter(top, bottom) {
    ctx.fillStyle = 'rgba(0,0,0,.6)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '28px VT323, monospace';
    ctx.fillText(top, canvas.width / 2, canvas.height / 2 - 12);
    ctx.font = '16px VT323, monospace';
    ctx.fillText(bottom, canvas.width / 2, canvas.height / 2 + 14);
  }

  function step(ts) {
    if (!running || paused || gameover) return;
    if (!lastDrop) lastDrop = ts;
    if (ts - lastDrop >= dropMs) {
      tryDrop();
      lastDrop = ts;
    }
    draw();
    raf = requestAnimationFrame(step);
  }

  function tryDrop() {
    if (valid(current, 0, 1)) { current.y += 1; }
    else { lock(current); current = nextPiece(); }
  }

  function hardDrop() {
    let dy = 0;
    while (valid(current, 0, dy + 1)) dy++;
    current.y += dy;
    score += dy * 2;
    lock(current);
    current = nextPiece();
    updateHud();
    draw();
  }

  function reset() {
    board = newBoard();
    bag = [];
    current = nextPiece();
    score = 0; lines = 0; level = 1; dropMs = 700;
    gameover = false;
    paused = false;
    updateHud();
    draw();
  }

  function start() {
    if (gameover) reset();
    running = true;
    paused = false;
    lastDrop = 0;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(step);
  }
  function togglePause() {
    if (!running) return;
    paused = !paused;
    if (!paused) { lastDrop = 0; raf = requestAnimationFrame(step); }
    else draw();
  }

  document.addEventListener('keydown', (e) => {
    if (!current || gameover) return;
    const k = e.key.toLowerCase();
    if (k === 'arrowleft' || k === 'a')  { if (valid(current, -1)) current.x--; e.preventDefault(); }
    if (k === 'arrowright' || k === 'd') { if (valid(current,  1)) current.x++; e.preventDefault(); }
    if (k === 'arrowdown' || k === 's')  { tryDrop(); score += 1; updateHud(); e.preventDefault(); }
    if (k === 'arrowup' || k === 'w') {
      const rotated = rotateCells(current.cells, 1);
      // wall kicks: try offsets
      for (const dx of [0, -1, 1, -2, 2]) {
        if (valid(current, dx, 0, rotated)) { current.cells = rotated; current.x += dx; break; }
      }
      e.preventDefault();
    }
    if (k === ' ') { hardDrop(); e.preventDefault(); }
    if (k === 'p') { togglePause(); e.preventDefault(); }
    draw();
  });

  // touch — tap to rotate, swipe horizontally to move, swipe down for hard drop
  let touchStart = null, touchAnchorX = 0, touchHardDropped = false;
  canvas.addEventListener('touchstart', (e) => {
    if (!current || gameover) return;
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    touchStart = { x: t.clientX, y: t.clientY, t: Date.now(), moved: false };
    touchAnchorX = t.clientX;
    touchHardDropped = false;
  }, { passive: true });

  canvas.addEventListener('touchmove', (e) => {
    if (!touchStart || !current || gameover || paused || !running || touchHardDropped) return;
    const t = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const cellPx = rect.width / COLS;
    const dy = t.clientY - touchStart.y;
    let dx = t.clientX - touchAnchorX;

    while (dx > cellPx) {
      if (valid(current, 1)) current.x++;
      touchAnchorX += cellPx;
      dx -= cellPx;
      touchStart.moved = true;
    }
    while (dx < -cellPx) {
      if (valid(current, -1)) current.x--;
      touchAnchorX -= cellPx;
      dx += cellPx;
      touchStart.moved = true;
    }

    if (dy > rect.height * 0.18 && Date.now() - touchStart.t < 500) {
      hardDrop();
      touchHardDropped = true;
      touchStart.moved = true;
    }

    draw();
    e.preventDefault();
  }, { passive: false });

  canvas.addEventListener('touchend', (e) => {
    if (!touchStart) return;
    const dur = Date.now() - touchStart.t;
    if (!touchStart.moved && !touchHardDropped && current && !gameover && running && !paused && dur < 300) {
      const rotated = rotateCells(current.cells, 1);
      for (const dx of [0, -1, 1, -2, 2]) {
        if (valid(current, dx, 0, rotated)) { current.cells = rotated; current.x += dx; break; }
      }
      draw();
    }
    touchStart = null;
  });

  document.getElementById('play').addEventListener('click', start);
  document.getElementById('pause').addEventListener('click', togglePause);
  document.getElementById('reset').addEventListener('click', () => { reset(); cancelAnimationFrame(raf); running = false; });

  new MutationObserver(() => draw())
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  reset();
})();
