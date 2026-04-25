(function () {
  // Brick Game style Tank: 10-col × 20-row grid, blocky pixels.
  const HI_KEY = 'arcade-tank-hi';
  const canvas = document.getElementById('tank');
  const ctx = canvas.getContext('2d');
  const COLS = 13, ROWS = 20;
  const CELL = canvas.width / COLS;

  // Tank shapes (3x3 grids). 1 = lit pixel.
  const PLAYER_SHAPE = [
    [0,1,0],
    [1,1,1],
    [1,0,1],
  ];
  const ENEMY_SHAPE = [
    [1,0,1],
    [1,1,1],
    [0,1,0],
  ];

  let player;        // {x: column of left edge of 3x3 footprint}
  let enemies;       // [{x, y}]
  let bullets;       // [{x, y, fromPlayer}]  y in cell rows (player bullets go up, enemy bullets go down)
  let walls;         // [{x, y, hp}]  static destructible bricks
  let score, hi, lives, frame, level, gameover, paused, running;
  let raf;
  let spawnTimer = 0;
  const keys = {};

  try { hi = parseInt(localStorage.getItem(HI_KEY), 10) || 0; } catch { hi = 0; }

  function color(name) {
    return getComputedStyle(document.documentElement).getPropertyValue('--' + name).trim() || '#fff';
  }

  // ---------- collisions ----------

  function shapeCells(x, y, shape) {
    const out = [];
    for (let r = 0; r < shape.length; r++)
      for (let c = 0; c < shape[r].length; c++)
        if (shape[r][c]) out.push([x + c, y + r]);
    return out;
  }

  function inBounds(x, y) { return x >= 0 && x < COLS && y >= 0 && y < ROWS; }

  function tankFootprint(t, shape) {
    const cells = shapeCells(t.x, t.y, shape);
    return cells.filter(([x, y]) => inBounds(x, y));
  }

  function tankHits(t, shape, x, y) {
    return tankFootprint(t, shape).some(([cx, cy]) => cx === x && cy === y);
  }

  function tanksOverlap(a, ashape, b, bshape) {
    const A = new Set(tankFootprint(a, ashape).map(([x, y]) => x + ',' + y));
    return tankFootprint(b, bshape).some(([x, y]) => A.has(x + ',' + y));
  }

  function blockedAt(x, y, ignoreEnemy) {
    if (!inBounds(x, y)) return true;
    if (walls.some(w => w.x === x && w.y === y)) return true;
    for (const e of enemies) {
      if (e === ignoreEnemy) continue;
      if (tankHits(e, ENEMY_SHAPE, x, y)) return true;
    }
    return false;
  }

  // ---------- spawning ----------

  function spawnEnemy() {
    // try a few random columns
    for (let tries = 0; tries < 8; tries++) {
      const x = 1 + Math.floor(Math.random() * (COLS - 4));
      const candidate = { x, y: 0, fireCool: 30 + Math.floor(Math.random() * 60) };
      const overlaps = tankFootprint(candidate, ENEMY_SHAPE).some(([cx, cy]) =>
        walls.some(w => w.x === cx && w.y === cy) ||
        enemies.some(e => tankHits(e, ENEMY_SHAPE, cx, cy))
      );
      if (!overlaps) { enemies.push(candidate); return; }
    }
  }

  function buildWalls() {
    walls = [];
    // a few random brick obstacles
    const n = 10 + level * 2;
    for (let i = 0; i < n; i++) {
      const x = 1 + Math.floor(Math.random() * (COLS - 2));
      const y = 5 + Math.floor(Math.random() * (ROWS - 10));
      // don't pile on player or enemies start
      if (y < 4) continue;
      if (y > ROWS - 5) continue;
      if (!walls.some(w => w.x === x && w.y === y)) walls.push({ x, y, hp: 1 });
    }
  }

  function reset(soft) {
    player = { x: Math.floor(COLS / 2) - 1, y: ROWS - 3, fireCool: 0 };
    enemies = [];
    bullets = [];
    if (!soft) { score = 0; lives = 3; level = 1; }
    buildWalls();
    spawnTimer = 0;
    frame = 0;
    gameover = false;
    paused = false;
    updateHud();
    draw();
  }

  function updateHud() {
    document.getElementById('s1').textContent = score;
    document.getElementById('s2').textContent = lives;
    document.getElementById('round').textContent = level;
    const hiEl = document.getElementById('hi');
    if (hiEl) hiEl.textContent = hi;
  }

  // ---------- step ----------

  function tryMovePlayer(dx) {
    const newX = player.x + dx;
    const cells = shapeCells(newX, player.y, PLAYER_SHAPE);
    for (const [cx, cy] of cells) {
      if (!inBounds(cx, cy)) return;
      if (walls.some(w => w.x === cx && w.y === cy)) return;
      if (enemies.some(e => tankHits(e, ENEMY_SHAPE, cx, cy))) return;
    }
    player.x = newX;
  }

  function fire(t, fromPlayer) {
    if (t.fireCool > 0) return;
    t.fireCool = fromPlayer ? 12 : 60;
    // bullet starts at the tip of the barrel
    if (fromPlayer) {
      bullets.push({ x: t.x + 1, y: t.y - 1, fromPlayer: true });
    } else {
      bullets.push({ x: t.x + 1, y: t.y + 3, fromPlayer: false });
    }
  }

  function step() {
    frame++;
    // cooldowns
    if (player.fireCool > 0) player.fireCool--;
    enemies.forEach(e => { if (e.fireCool > 0) e.fireCool--; });

    // continuous player input
    if (keys['arrowleft'] || keys['a']) { if (frame % 4 === 0) tryMovePlayer(-1); }
    if (keys['arrowright'] || keys['d']) { if (frame % 4 === 0) tryMovePlayer(1); }
    if (keys[' '] || keys['arrowup'] || keys['w']) fire(player, true);

    // bullets advance every 2 frames
    if (frame % 2 === 0) {
      for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.y += b.fromPlayer ? -1 : 1;
        if (!inBounds(b.x, b.y)) { bullets.splice(i, 1); continue; }
        // hit wall?
        const wIdx = walls.findIndex(w => w.x === b.x && w.y === b.y);
        if (wIdx >= 0) { walls.splice(wIdx, 1); bullets.splice(i, 1); continue; }
        // hit player?
        if (!b.fromPlayer && tankHits(player, PLAYER_SHAPE, b.x, b.y)) {
          bullets.splice(i, 1);
          loseLife();
          return;
        }
        // hit enemy?
        if (b.fromPlayer) {
          const eIdx = enemies.findIndex(e => tankHits(e, ENEMY_SHAPE, b.x, b.y));
          if (eIdx >= 0) {
            enemies.splice(eIdx, 1);
            bullets.splice(i, 1);
            score += 10 * level;
            if (score > hi) { hi = score; try { localStorage.setItem(HI_KEY, String(hi)); } catch {} }
            updateHud();
          }
        }
      }
    }

    // enemies advance — slower with more enemies on screen
    const moveEvery = Math.max(20, 50 - level * 5);
    if (frame % moveEvery === 0) {
      for (const e of enemies) {
        // try down, else stop and shoot
        const blocked = shapeCells(e.x, e.y + 1, ENEMY_SHAPE).some(([cx, cy]) =>
          !inBounds(cx, cy) || walls.some(w => w.x === cx && w.y === cy) ||
          tankHits(player, PLAYER_SHAPE, cx, cy) ||
          enemies.some(other => other !== e && tankHits(other, ENEMY_SHAPE, cx, cy))
        );
        if (!blocked) e.y += 1;
        // collision with player tank kills the player
        if (tanksOverlap(e, ENEMY_SHAPE, player, PLAYER_SHAPE)) { loseLife(); return; }
        if (e.y + 2 >= ROWS) { loseLife(); return; }
      }
    }

    // enemies fire
    for (const e of enemies) {
      // only fire if roughly aligned with player horizontally and below
      if (e.x === player.x && Math.random() < 0.02) fire(e, false);
    }

    // spawn
    spawnTimer++;
    const spawnEvery = Math.max(40, 110 - level * 8);
    if (spawnTimer >= spawnEvery && enemies.length < 3 + level) {
      spawnEnemy();
      spawnTimer = 0;
    }

    // level up every 100 score
    const newLevel = 1 + Math.floor(score / 100);
    if (newLevel > level) {
      level = newLevel;
      buildWalls();
      updateHud();
    }
  }

  function loseLife() {
    lives--;
    updateHud();
    if (lives <= 0) {
      gameover = true;
      running = false;
      cancelAnimationFrame(raf);
      draw();
      drawCenter('Game over', 'Score ' + score + (score >= hi ? ' (best!)' : ''));
      return;
    }
    enemies = [];
    bullets = [];
    player.x = Math.floor(COLS / 2) - 1;
    player.y = ROWS - 3;
    player.fireCool = 0;
    spawnTimer = 0;
    draw();
  }

  // ---------- draw ----------

  function draw() {
    // bg
    ctx.fillStyle = color('btn-bg-strong');
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // grid dots (faint)
    ctx.fillStyle = color('btn-bg');
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        ctx.fillRect(c * CELL + CELL / 2 - 1, r * CELL + CELL / 2 - 1, 2, 2);
      }
    }
    // walls
    ctx.fillStyle = color('btn-border');
    for (const w of walls) drawCell(w.x, w.y);
    // bullets
    ctx.fillStyle = color('accent');
    for (const b of bullets) drawCell(b.x, b.y);
    // player
    ctx.fillStyle = color('fg');
    for (const [cx, cy] of tankFootprint(player, PLAYER_SHAPE)) drawCell(cx, cy);
    // enemies
    ctx.fillStyle = color('accent');
    for (const e of enemies) for (const [cx, cy] of tankFootprint(e, ENEMY_SHAPE)) drawCell(cx, cy);
    if (paused) drawCenter('Paused', 'press P or Pause');
  }

  function drawCell(x, y) {
    ctx.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2);
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

  function loop() {
    if (!running || paused || gameover) return;
    step();
    draw();
    raf = requestAnimationFrame(loop);
  }

  function start() {
    if (gameover) reset(false);
    running = true; paused = false;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }
  function togglePause() {
    if (!running && !paused) return;
    if (running) { running = false; paused = true; draw(); }
    else { paused = false; running = true; raf = requestAnimationFrame(loop); }
  }

  document.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
    if (e.key.toLowerCase() === 'p') togglePause();
    if (['arrowup','arrowdown','arrowleft','arrowright',' ','w','a','s','d','p'].includes(e.key.toLowerCase())) e.preventDefault();
  });
  document.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

  // touch: tap left/right/center of canvas
  canvas.addEventListener('touchstart', (e) => {
    const r = canvas.getBoundingClientRect();
    const x = (e.touches[0].clientX - r.left) / r.width;
    if (x < 0.35) keys['arrowleft'] = true;
    else if (x > 0.65) keys['arrowright'] = true;
    else fire(player, true);
    e.preventDefault();
  }, { passive: false });
  canvas.addEventListener('touchend', () => {
    keys['arrowleft'] = false;
    keys['arrowright'] = false;
  });

  document.getElementById('play').addEventListener('click', start);
  document.getElementById('pause').addEventListener('click', togglePause);
  document.getElementById('reset').addEventListener('click', () => { reset(false); cancelAnimationFrame(raf); running = false; });

  new MutationObserver(() => draw())
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  reset(false);
})();
