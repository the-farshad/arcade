(function () {
  // Brick Game style Aircraft: vertical scroller with stars, enemy planes drift down.
  const HI_KEY = 'arcade-aircraft-hi';
  const canvas = document.getElementById('ac');
  const ctx = canvas.getContext('2d');
  const COLS = 13, ROWS = 20;
  const CELL = canvas.width / COLS;

  // 3x3 plane shapes — pointed nose
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

  let player, enemies, bullets, stars;
  let score, hi, lives, frame, level, gameover, paused, running;
  let raf, spawnTimer = 0;
  const keys = {};

  try { hi = parseInt(localStorage.getItem(HI_KEY), 10) || 0; } catch { hi = 0; }

  function color(name) {
    return getComputedStyle(document.documentElement).getPropertyValue('--' + name).trim() || '#fff';
  }

  function shapeCells(x, y, shape) {
    const out = [];
    for (let r = 0; r < shape.length; r++)
      for (let c = 0; c < shape[r].length; c++)
        if (shape[r][c]) out.push([x + c, y + r]);
    return out;
  }

  function inBounds(x, y) { return x >= 0 && x < COLS && y >= 0 && y < ROWS; }

  function shipFootprint(t, shape) {
    return shapeCells(t.x, t.y, shape).filter(([x, y]) => inBounds(x, y));
  }

  function shipHits(t, shape, x, y) {
    return shipFootprint(t, shape).some(([cx, cy]) => cx === x && cy === y);
  }

  function shipsOverlap(a, ashape, b, bshape) {
    const A = new Set(shipFootprint(a, ashape).map(([x, y]) => x + ',' + y));
    return shipFootprint(b, bshape).some(([x, y]) => A.has(x + ',' + y));
  }

  function spawnEnemy() {
    for (let tries = 0; tries < 6; tries++) {
      const x = 1 + Math.floor(Math.random() * (COLS - 4));
      const candidate = { x, y: 0, fireCool: 60 + Math.floor(Math.random() * 80) };
      const overlaps = shipFootprint(candidate, ENEMY_SHAPE).some(([cx, cy]) =>
        enemies.some(e => shipHits(e, ENEMY_SHAPE, cx, cy))
      );
      if (!overlaps) { enemies.push(candidate); return; }
    }
  }

  function makeStars() {
    stars = [];
    const n = 18;
    for (let i = 0; i < n; i++) stars.push({
      x: Math.random() * COLS,
      y: Math.random() * ROWS,
      vy: 0.05 + Math.random() * 0.15,
    });
  }

  function reset(soft) {
    player = { x: Math.floor(COLS / 2) - 1, y: ROWS - 3, fireCool: 0 };
    enemies = [];
    bullets = [];
    if (!soft) { score = 0; lives = 3; level = 1; }
    spawnTimer = 0;
    frame = 0;
    gameover = false;
    paused = false;
    makeStars();
    updateHud();
    draw();
  }

  function updateHud() {
    document.getElementById('score').textContent = score;
    document.getElementById('hi').textContent = hi;
    document.getElementById('lives').textContent = lives;
    document.getElementById('level').textContent = level;
  }

  function tryMovePlayer(dx) {
    const newX = player.x + dx;
    const cells = shapeCells(newX, player.y, PLAYER_SHAPE);
    for (const [cx, cy] of cells) {
      if (!inBounds(cx, cy)) return;
    }
    player.x = newX;
  }

  function fire(t, fromPlayer) {
    if (t.fireCool > 0) return;
    t.fireCool = fromPlayer ? 8 : 70; // player can rapid-fire
    if (fromPlayer) bullets.push({ x: t.x + 1, y: t.y - 1, fromPlayer: true });
    else bullets.push({ x: t.x + 1, y: t.y + 3, fromPlayer: false });
  }

  function step() {
    frame++;
    if (player.fireCool > 0) player.fireCool--;
    enemies.forEach(e => { if (e.fireCool > 0) e.fireCool--; });

    // stars
    for (const s of stars) {
      s.y += s.vy;
      if (s.y >= ROWS) { s.y = 0; s.x = Math.random() * COLS; }
    }

    if (keys['arrowleft'] || keys['a']) { if (frame % 3 === 0) tryMovePlayer(-1); }
    if (keys['arrowright'] || keys['d']) { if (frame % 3 === 0) tryMovePlayer(1); }
    if (keys[' '] || keys['arrowup'] || keys['w']) fire(player, true);

    // bullets advance every frame (faster than tank)
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.y += b.fromPlayer ? -1 : 1;
      if (!inBounds(b.x, b.y)) { bullets.splice(i, 1); continue; }
      if (!b.fromPlayer && shipHits(player, PLAYER_SHAPE, b.x, b.y)) {
        bullets.splice(i, 1);
        loseLife();
        return;
      }
      if (b.fromPlayer) {
        const eIdx = enemies.findIndex(e => shipHits(e, ENEMY_SHAPE, b.x, b.y));
        if (eIdx >= 0) {
          enemies.splice(eIdx, 1);
          bullets.splice(i, 1);
          score += 10 * level;
          if (score > hi) { hi = score; try { localStorage.setItem(HI_KEY, String(hi)); } catch {} }
          updateHud();
        }
      }
    }

    const moveEvery = Math.max(12, 30 - level * 2);
    if (frame % moveEvery === 0) {
      for (const e of enemies) {
        e.y += 1;
        if (shipsOverlap(e, ENEMY_SHAPE, player, PLAYER_SHAPE)) { loseLife(); return; }
        if (e.y + 2 >= ROWS) { loseLife(); return; }
      }
    }

    // enemies fire when aligned
    for (const e of enemies) {
      if (e.x === player.x && Math.random() < 0.015) fire(e, false);
    }

    spawnTimer++;
    const spawnEvery = Math.max(25, 70 - level * 5);
    if (spawnTimer >= spawnEvery && enemies.length < 4 + level) {
      spawnEnemy();
      spawnTimer = 0;
    }

    const newLevel = 1 + Math.floor(score / 100);
    if (newLevel > level) { level = newLevel; updateHud(); }
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
    player.fireCool = 0;
    spawnTimer = 0;
    draw();
  }

  function draw() {
    ctx.fillStyle = color('btn-bg-strong');
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // stars
    ctx.fillStyle = color('btn-bg');
    for (const s of stars) {
      ctx.fillRect(Math.floor(s.x) * CELL + CELL / 2 - 1, Math.floor(s.y) * CELL + CELL / 2 - 1, 2, 2);
    }

    // bullets
    ctx.fillStyle = color('accent');
    for (const b of bullets) drawCell(b.x, b.y);

    // player
    ctx.fillStyle = color('fg');
    for (const [cx, cy] of shipFootprint(player, PLAYER_SHAPE)) drawCell(cx, cy);

    // enemies
    ctx.fillStyle = color('accent');
    for (const e of enemies) for (const [cx, cy] of shipFootprint(e, ENEMY_SHAPE)) drawCell(cx, cy);

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
