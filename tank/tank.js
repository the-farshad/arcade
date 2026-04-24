(function () {
  const canvas = document.getElementById('tank');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const TANK = 22, BULLET = 4, SPEED = 1.6, ROT = 0.06, BULLET_SPEED = 4.5, TARGET = 5;

  // walls (block grid)
  const BLOCK = 30;
  let walls = [];

  let p1, p2, bullets, scores, round, mode, raf;
  let running = false, paused = false;
  const keys = {};

  function buildMap() {
    walls = [];
    // border
    for (let x = 0; x < W; x += BLOCK) walls.push(rect(x, 0, BLOCK, BLOCK));
    for (let x = 0; x < W; x += BLOCK) walls.push(rect(x, H - BLOCK, BLOCK, BLOCK));
    for (let y = BLOCK; y < H - BLOCK; y += BLOCK) walls.push(rect(0, y, BLOCK, BLOCK));
    for (let y = BLOCK; y < H - BLOCK; y += BLOCK) walls.push(rect(W - BLOCK, y, BLOCK, BLOCK));
    // a few interior obstacles
    walls.push(rect(BLOCK * 4, BLOCK * 3, BLOCK * 2, BLOCK));
    walls.push(rect(BLOCK * 4, BLOCK * 3, BLOCK, BLOCK * 4));
    walls.push(rect(BLOCK * 14, BLOCK * 3, BLOCK * 2, BLOCK));
    walls.push(rect(BLOCK * 15, BLOCK * 3, BLOCK, BLOCK * 4));
    walls.push(rect(BLOCK * 9, BLOCK * 6, BLOCK * 2, BLOCK));
    walls.push(rect(BLOCK * 7, BLOCK * 9, BLOCK * 6, BLOCK));
  }

  function rect(x, y, w, h) { return { x, y, w, h }; }

  function reset(soft) {
    if (!soft) { scores = [0, 0]; round = 1; }
    p1 = { x: BLOCK * 2 + 12, y: H / 2, a: 0, cool: 0 };
    p2 = { x: W - BLOCK * 2 - 12, y: H / 2, a: Math.PI, cool: 0 };
    bullets = [];
    updateHud();
    draw();
  }

  function updateHud() {
    document.getElementById('s1').textContent = scores[0];
    document.getElementById('s2').textContent = scores[1];
    document.getElementById('round').textContent = round;
  }

  function color(name) {
    return getComputedStyle(document.documentElement).getPropertyValue('--' + name).trim() || '#fff';
  }

  function tankRect(t) { return { x: t.x - TANK/2, y: t.y - TANK/2, w: TANK, h: TANK }; }

  function rectOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function collidesWalls(t) {
    const r = tankRect(t);
    for (const w of walls) if (rectOverlap(r, w)) return true;
    return false;
  }

  function moveTank(t, fwd, rot) {
    if (rot) t.a += rot * ROT;
    if (fwd) {
      const nx = t.x + Math.cos(t.a) * SPEED * fwd;
      const ny = t.y + Math.sin(t.a) * SPEED * fwd;
      const test = { x: nx, y: t.y, a: t.a };
      if (!collidesWalls(test)) t.x = nx;
      const test2 = { x: t.x, y: ny, a: t.a };
      if (!collidesWalls(test2)) t.y = ny;
    }
  }

  function fire(t, owner) {
    if (t.cool > 0) return;
    t.cool = 30;
    bullets.push({
      x: t.x + Math.cos(t.a) * (TANK / 2 + 4),
      y: t.y + Math.sin(t.a) * (TANK / 2 + 4),
      vx: Math.cos(t.a) * BULLET_SPEED,
      vy: Math.sin(t.a) * BULLET_SPEED,
      owner,
      bounces: 1,
    });
  }

  function ai(t, target) {
    // turn toward target
    const dx = target.x - t.x, dy = target.y - t.y;
    const want = Math.atan2(dy, dx);
    let diff = want - t.a;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    moveTank(t, 1, Math.sign(diff));
    if (Math.abs(diff) < 0.15 && Math.random() < 0.04) fire(t, 1);
  }

  function step() {
    if (p1.cool > 0) p1.cool--;
    if (p2.cool > 0) p2.cool--;

    // p1 input
    moveTank(p1,
      (keys['w'] ? 1 : 0) + (keys['s'] ? -1 : 0),
      (keys['d'] ? 1 : 0) + (keys['a'] ? -1 : 0)
    );
    if (keys[' ']) fire(p1, 0);

    // p2 input or AI
    if (mode === '2p') {
      moveTank(p2,
        (keys['arrowup'] ? 1 : 0) + (keys['arrowdown'] ? -1 : 0),
        (keys['arrowright'] ? 1 : 0) + (keys['arrowleft'] ? -1 : 0)
      );
      if (keys['enter']) fire(p2, 1);
    } else {
      ai(p2, p1);
    }

    // bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.x += b.vx; b.y += b.vy;
      // wall bounce
      let hit = false;
      for (const w of walls) {
        if (b.x > w.x && b.x < w.x + w.w && b.y > w.y && b.y < w.y + w.h) {
          if (b.bounces <= 0) { bullets.splice(i, 1); hit = true; break; }
          // figure side
          const overlapX = Math.min(b.x - w.x, w.x + w.w - b.x);
          const overlapY = Math.min(b.y - w.y, w.y + w.h - b.y);
          if (overlapX < overlapY) b.vx *= -1; else b.vy *= -1;
          b.x += b.vx; b.y += b.vy;
          b.bounces--;
          hit = true;
          break;
        }
      }
      if (hit) continue;
      // off-screen safety
      if (b.x < 0 || b.x > W || b.y < 0 || b.y > H) { bullets.splice(i, 1); continue; }
      // hit tank?
      const targets = [p1, p2];
      for (let ti = 0; ti < targets.length; ti++) {
        if (ti === b.owner) continue;
        const t = targets[ti];
        const dx = b.x - t.x, dy = b.y - t.y;
        if (dx * dx + dy * dy < (TANK / 2) * (TANK / 2)) {
          scores[b.owner]++;
          updateHud();
          if (scores[b.owner] >= TARGET) {
            running = false;
            cancelAnimationFrame(raf);
            draw();
            drawCenter((b.owner === 0 ? 'P1' : (mode === '2p' ? 'P2' : 'AI')) + ' wins',
                       scores[0] + ' — ' + scores[1]);
            return;
          }
          round++;
          reset(true);
          return;
        }
      }
    }
  }

  function drawTank(t, c) {
    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.rotate(t.a);
    ctx.fillStyle = c;
    ctx.fillRect(-TANK/2, -TANK/2, TANK, TANK);
    ctx.fillStyle = color('btn-bg-strong');
    ctx.fillRect(0, -3, TANK/2 + 6, 6);
    ctx.restore();
  }

  function drawCenter(top, bottom) {
    ctx.fillStyle = 'rgba(0,0,0,.55)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '32px VT323, monospace';
    ctx.fillText(top, W/2, H/2 - 12);
    ctx.font = '20px VT323, monospace';
    ctx.fillText(bottom, W/2, H/2 + 18);
  }

  function draw() {
    ctx.fillStyle = color('btn-bg-strong');
    ctx.fillRect(0, 0, W, H);
    // walls
    ctx.fillStyle = color('btn-border');
    for (const w of walls) ctx.fillRect(w.x, w.y, w.w, w.h);
    // tanks
    drawTank(p1, color('fg'));
    drawTank(p2, color('accent'));
    // bullets
    ctx.fillStyle = color('fg');
    for (const b of bullets) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, BULLET, 0, Math.PI * 2);
      ctx.fill();
    }
    if (paused) drawCenter('Paused', 'press P or Pause');
  }

  function loop() {
    if (!running || paused) return;
    step();
    draw();
    if (running) raf = requestAnimationFrame(loop);
  }

  function start() {
    running = true; paused = false;
    cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
  }
  function togglePause() {
    if (!running && !paused) return;
    if (running) { running = false; paused = true; draw(); }
    else { paused = false; running = true; raf = requestAnimationFrame(loop); }
  }

  document.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
    if (e.key.toLowerCase() === 'p') togglePause();
    if (['arrowup','arrowdown','arrowleft','arrowright',' '].includes(e.key.toLowerCase())) e.preventDefault();
  });
  document.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

  document.getElementById('play').addEventListener('click', start);
  document.getElementById('pause').addEventListener('click', togglePause);
  document.getElementById('reset').addEventListener('click', () => { reset(false); cancelAnimationFrame(raf); running = false; });

  document.querySelectorAll('.seg[data-control="mode"] button').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.seg[data-control="mode"] button').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      mode = b.dataset.value;
      reset(false);
    });
  });

  new MutationObserver(() => draw())
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  mode = 'ai';
  buildMap();
  reset(false);
})();
