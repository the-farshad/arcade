(function () {
  const HI_KEY = 'arcade-2048-hi';
  const N = 4;
  const board = document.getElementById('board');
  const scoreEl = document.getElementById('score');
  const hiEl = document.getElementById('hi');
  const bestEl = document.getElementById('best');

  let grid, score, hi, lastSnapshot;
  let lastSpawn = null;   // {r, c}
  let lastMerges = [];    // [{r, c}]

  // ---------- model ----------

  function emptyGrid() {
    return Array.from({ length: N }, () => Array(N).fill(0));
  }

  function emptyCells(g) {
    const out = [];
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (!g[r][c]) out.push([r, c]);
    return out;
  }

  function spawn(g) {
    const empties = emptyCells(g);
    if (!empties.length) { lastSpawn = null; return; }
    const [r, c] = empties[(Math.random() * empties.length) | 0];
    g[r][c] = Math.random() < 0.9 ? 2 : 4;
    lastSpawn = { r, c };
  }

  function clone(g) { return g.map(row => row.slice()); }

  function rotateCW(g) {
    const out = emptyGrid();
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) out[c][N - 1 - r] = g[r][c];
    return out;
  }

  function compressLeft(row) {
    const filtered = row.filter(v => v);
    let gained = 0;
    for (let i = 0; i < filtered.length - 1; i++) {
      if (filtered[i] === filtered[i + 1]) {
        filtered[i] *= 2;
        gained += filtered[i];
        filtered.splice(i + 1, 1);
      }
    }
    while (filtered.length < N) filtered.push(0);
    return { row: filtered, gained };
  }

  function moveLeft(g) {
    let gained = 0, changed = false;
    for (let r = 0; r < N; r++) {
      const before = g[r].join(',');
      const { row, gained: gn } = compressLeft(g[r]);
      g[r] = row;
      gained += gn;
      if (g[r].join(',') !== before) changed = true;
    }
    return { changed, gained };
  }

  function move(dir) {
    let g = clone(grid);
    for (let i = 0; i < dir; i++) g = rotateCW(g);
    const before = clone(g);
    const { changed, gained } = moveLeft(g);
    if (!changed) return false;
    // detect merges (in rotated space): cells whose value doubled vs before
    const merges = [];
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      if (g[r][c] && before[r][c] && g[r][c] === before[r][c] * 2) merges.push([r, c]);
    }
    // rotate g back; rotate merge positions back too
    for (let i = 0; i < (4 - dir) % 4; i++) g = rotateCW(g);
    // rotate each merge coord back: applying rotateCW (4-dir)%4 times
    function rotPoint(r, c, times) {
      for (let i = 0; i < times; i++) { const nr = c, nc = N - 1 - r; r = nr; c = nc; }
      return [r, c];
    }
    lastMerges = merges.map(([r, c]) => {
      const [nr, nc] = rotPoint(r, c, (4 - dir) % 4);
      return { r: nr, c: nc };
    });
    lastSnapshot = { grid: clone(grid), score };
    grid = g;
    score += gained;
    spawn(grid);
    if (score > hi) { hi = score; try { localStorage.setItem(HI_KEY, String(hi)); } catch {} }
    return true;
  }

  function canMove() {
    if (emptyCells(grid).length) return true;
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      if (r + 1 < N && grid[r][c] === grid[r + 1][c]) return true;
      if (c + 1 < N && grid[r][c] === grid[r][c + 1]) return true;
    }
    return false;
  }

  function bestTile() {
    let best = 0;
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (grid[r][c] > best) best = grid[r][c];
    return best;
  }

  // ---------- view ----------

  function render() {
    board.innerHTML = '';
    const mergeSet = new Set(lastMerges.map(m => m.r + ',' + m.c));
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const v = grid[r][c];
      const el = document.createElement('div');
      if (v) {
        el.className = 't2048-tile v' + v;
        el.textContent = v;
        if (lastSpawn && lastSpawn.r === r && lastSpawn.c === c) el.classList.add('spawn');
        else if (mergeSet.has(r + ',' + c)) el.classList.add('merge');
      } else {
        el.className = 't2048-cell';
      }
      board.appendChild(el);
    }
    scoreEl.textContent = score;
    hiEl.textContent = hi;
    bestEl.textContent = bestTile();
  }

  function gameOver() {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:relative;display:inline-block';
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;background:rgba(0,0,0,.55);color:#fff;border-radius:6px;font-size:1.5em;z-index:10';
    overlay.innerHTML = '<div>Game over</div><div style="font-size:.7em;opacity:.85;margin-top:6px">Score ' + score + ' &middot; press New Game</div>';
    board.style.position = 'relative';
    board.appendChild(overlay);
  }

  function reset() {
    grid = emptyGrid();
    score = 0;
    lastSpawn = null;
    lastMerges = [];
    spawn(grid);
    spawn(grid);
    lastSnapshot = null;
    render();
  }

  function tryMove(dir) {
    if (move(dir)) {
      render();
      if (!canMove()) gameOver();
    }
  }

  // ---------- input ----------

  // Direction mapping: rotateCW(g) maps original (r,c)->(c,N-1-r); applying
  // 1 CW rotation then moveLeft is equivalent to a DOWN move on the original
  // (and 3 CW rotations + moveLeft is UP). So:
  //   0 = left, 1 = down, 2 = right, 3 = up
  document.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (k === 'arrowleft' || k === 'a')  { tryMove(0); e.preventDefault(); }
    if (k === 'arrowdown' || k === 's')  { tryMove(1); e.preventDefault(); }
    if (k === 'arrowright' || k === 'd') { tryMove(2); e.preventDefault(); }
    if (k === 'arrowup' || k === 'w')    { tryMove(3); e.preventDefault(); }
    if (k === 'u') doUndo();
  });

  let touchStart = null;
  board.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, { passive: true });
  board.addEventListener('touchend', (e) => {
    if (!touchStart || e.changedTouches.length === 0) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.x, dy = t.clientY - touchStart.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
    // swipe right=2, left=0, down=1, up=3 (matches keyboard mapping)
    if (Math.abs(dx) > Math.abs(dy)) tryMove(dx > 0 ? 2 : 0);
    else tryMove(dy > 0 ? 1 : 3);
    touchStart = null;
  });

  function doUndo() {
    if (!lastSnapshot) return;
    grid = lastSnapshot.grid;
    score = lastSnapshot.score;
    lastSnapshot = null;
    render();
  }

  document.getElementById('new').addEventListener('click', reset);
  document.getElementById('undo').addEventListener('click', doUndo);

  try { hi = parseInt(localStorage.getItem(HI_KEY), 10) || 0; } catch { hi = 0; }
  reset();
})();
