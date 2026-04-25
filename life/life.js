(function () {
  const canvas = document.getElementById('life');
  const ctx = canvas.getContext('2d');
  const CELL = 10;
  const COLS = canvas.width / CELL;
  const ROWS = canvas.height / CELL;

  let grid = makeGrid();
  let next = makeGrid();
  let gen = 0;
  let running = false;
  let speed = 10; // gen/sec
  let raf, lastStep = 0;
  let painting = false;
  let paintValue = 1;

  function makeGrid() {
    return new Uint8Array(COLS * ROWS);
  }
  function idx(x, y) { return y * COLS + x; }

  function color(name) {
    return getComputedStyle(document.documentElement).getPropertyValue('--' + name).trim() || '#fff';
  }

  function draw() {
    ctx.fillStyle = color('btn-bg-strong');
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = color('accent');
    let alive = 0;
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (grid[idx(x, y)]) {
          ctx.fillRect(x * CELL + 1, y * CELL + 1, CELL - 1, CELL - 1);
          alive++;
        }
      }
    }
    document.getElementById('gen').textContent = gen;
    document.getElementById('alive').textContent = alive;
  }

  function step() {
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const nx = (x + dx + COLS) % COLS;
            const ny = (y + dy + ROWS) % ROWS;
            n += grid[idx(nx, ny)];
          }
        }
        const cur = grid[idx(x, y)];
        next[idx(x, y)] = (cur && (n === 2 || n === 3)) || (!cur && n === 3) ? 1 : 0;
      }
    }
    [grid, next] = [next, grid];
    gen++;
  }

  function loop(ts) {
    if (!running) return;
    if (!lastStep) lastStep = ts;
    if (ts - lastStep >= 1000 / speed) {
      step();
      draw();
      lastStep = ts;
    }
    raf = requestAnimationFrame(loop);
  }

  function play() {
    if (running) return;
    running = true;
    document.getElementById('play').textContent = 'Pause';
    lastStep = 0;
    raf = requestAnimationFrame(loop);
  }
  function pause() {
    running = false;
    document.getElementById('play').textContent = 'Play';
    cancelAnimationFrame(raf);
  }
  function toggle() { running ? pause() : play(); }

  function clear() {
    grid.fill(0);
    gen = 0;
    draw();
  }

  function random() {
    for (let i = 0; i < grid.length; i++) grid[i] = Math.random() < 0.28 ? 1 : 0;
    gen = 0;
    draw();
  }

  function plant(cells, ox, oy) {
    clear();
    for (const [dx, dy] of cells) {
      const x = ox + dx, y = oy + dy;
      if (x >= 0 && y >= 0 && x < COLS && y < ROWS) grid[idx(x, y)] = 1;
    }
    draw();
  }

  const PRESETS = {
    glider: [[1,0],[2,1],[0,2],[1,2],[2,2]],
    lwss: [[1,0],[4,0],[0,1],[0,2],[4,2],[0,3],[1,3],[2,3],[3,3]],
    pulsar: [
      [2,0],[3,0],[4,0],[8,0],[9,0],[10,0],
      [0,2],[5,2],[7,2],[12,2],
      [0,3],[5,3],[7,3],[12,3],
      [0,4],[5,4],[7,4],[12,4],
      [2,5],[3,5],[4,5],[8,5],[9,5],[10,5],
      [2,7],[3,7],[4,7],[8,7],[9,7],[10,7],
      [0,8],[5,8],[7,8],[12,8],
      [0,9],[5,9],[7,9],[12,9],
      [0,10],[5,10],[7,10],[12,10],
      [2,12],[3,12],[4,12],[8,12],[9,12],[10,12],
    ],
    'r-pentomino': [[1,0],[2,0],[0,1],[1,1],[1,2]],
    acorn: [[1,0],[3,1],[0,2],[1,2],[4,2],[5,2],[6,2]],
    gosper: [
      [0,4],[0,5],[1,4],[1,5],
      [10,4],[10,5],[10,6],[11,3],[11,7],[12,2],[12,8],[13,2],[13,8],
      [14,5],[15,3],[15,7],[16,4],[16,5],[16,6],[17,5],
      [20,2],[20,3],[20,4],[21,2],[21,3],[21,4],[22,1],[22,5],
      [24,0],[24,1],[24,5],[24,6],
      [34,2],[34,3],[35,2],[35,3],
    ],
  };

  // ---------- input ----------

  function cellFromEvent(e) {
    const r = canvas.getBoundingClientRect();
    const cx = (e.clientX - r.left) * (canvas.width / r.width);
    const cy = (e.clientY - r.top) * (canvas.height / r.height);
    return [Math.floor(cx / CELL), Math.floor(cy / CELL)];
  }

  canvas.addEventListener('mousedown', (e) => {
    const [x, y] = cellFromEvent(e);
    if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return;
    paintValue = grid[idx(x, y)] ? 0 : 1;
    grid[idx(x, y)] = paintValue;
    painting = true;
    draw();
  });
  document.addEventListener('mouseup', () => { painting = false; });
  canvas.addEventListener('mousemove', (e) => {
    if (!painting) return;
    const [x, y] = cellFromEvent(e);
    if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return;
    grid[idx(x, y)] = paintValue;
    draw();
  });
  canvas.addEventListener('touchstart', (e) => {
    const t = e.touches[0]; if (!t) return;
    const [x, y] = cellFromEvent(t);
    if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return;
    paintValue = grid[idx(x, y)] ? 0 : 1;
    grid[idx(x, y)] = paintValue;
    painting = true;
    draw();
    e.preventDefault();
  }, { passive: false });
  canvas.addEventListener('touchmove', (e) => {
    if (!painting) return;
    const t = e.touches[0]; if (!t) return;
    const [x, y] = cellFromEvent(t);
    if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return;
    grid[idx(x, y)] = paintValue;
    draw();
    e.preventDefault();
  }, { passive: false });
  canvas.addEventListener('touchend', () => { painting = false; });

  document.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (k === 'p') { toggle(); e.preventDefault(); }
    if (k === 's') { step(); draw(); e.preventDefault(); }
  });

  document.getElementById('play').addEventListener('click', toggle);
  document.getElementById('step').addEventListener('click', () => { step(); draw(); });
  document.getElementById('random').addEventListener('click', random);
  document.getElementById('clear').addEventListener('click', clear);

  const speedEl = document.getElementById('speed');
  const speedVal = document.getElementById('speed-val');
  speedEl.addEventListener('input', () => {
    speed = parseInt(speedEl.value, 10);
    speedVal.textContent = speed;
  });

  document.getElementById('preset').addEventListener('change', (e) => {
    const p = PRESETS[e.target.value];
    if (!p) return;
    const w = Math.max(...p.map(([x]) => x)) + 1;
    const h = Math.max(...p.map(([, y]) => y)) + 1;
    plant(p, ((COLS - w) / 2) | 0, ((ROWS - h) / 2) | 0);
    e.target.value = '';
  });

  new MutationObserver(() => draw())
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  // initial: a glider
  plant(PRESETS.glider, 5, 5);
})();
