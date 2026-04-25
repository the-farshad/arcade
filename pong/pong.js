(function () {
  const HI_KEY = 'arcade-pong-hi';
  const canvas = document.getElementById('pong');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const PADDLE_H = 70, PADDLE_W = 10, BALL = 9, MARGIN = 16;
  const TARGET = 7;

  let scoreL = 0, scoreR = 0;
  let paddleL, paddleR;
  let ball;
  let mode = 'ai-easy';
  let raf, running = false, paused = false, finished = false;
  const keys = {};

  document.getElementById('target').textContent = TARGET;

  function reset(scoreReset) {
    paddleL = { y: H / 2 - PADDLE_H / 2, vy: 0 };
    paddleR = { y: H / 2 - PADDLE_H / 2, vy: 0 };
    serve(Math.random() < 0.5 ? -1 : 1);
    if (scoreReset) { scoreL = 0; scoreR = 0; finished = false; }
    updateHud();
    draw();
  }

  function serve(dir) {
    const angle = (Math.random() - 0.5) * 0.6; // small vertical
    const speed = 4.5;
    ball = {
      x: W / 2, y: H / 2,
      vx: dir * speed * Math.cos(angle),
      vy: speed * Math.sin(angle) + (Math.random() - 0.5) * 1.5,
      r: BALL,
    };
  }

  function updateHud() {
    document.getElementById('score-l').textContent = scoreL;
    document.getElementById('score-r').textContent = scoreR;
  }

  function color(name) {
    return getComputedStyle(document.documentElement).getPropertyValue('--' + name).trim() || '#fff';
  }

  function aiSpeed() {
    return mode === 'ai-easy' ? 3 : mode === 'ai-med' ? 4.5 : 6;
  }
  function aiNoise() {
    return mode === 'ai-easy' ? 50 : mode === 'ai-med' ? 20 : 6;
  }

  function step() {
    // input — left
    if (mode === '2p') {
      paddleL.vy = (keys['w'] ? -1 : 0) + (keys['s'] ? 1 : 0);
      paddleR.vy = (keys['arrowup'] ? -1 : 0) + (keys['arrowdown'] ? 1 : 0);
      paddleR.y += paddleR.vy * 6;
    } else {
      paddleL.vy = (keys['w'] ? -1 : 0) + (keys['s'] ? 1 : 0);
      // AI for right paddle
      const target = ball.y + (Math.random() - 0.5) * aiNoise();
      const dy = target - (paddleR.y + PADDLE_H / 2);
      const sp = aiSpeed();
      paddleR.y += Math.max(-sp, Math.min(sp, dy));
    }
    paddleL.y += paddleL.vy * 6;
    paddleL.y = Math.max(0, Math.min(H - PADDLE_H, paddleL.y));
    paddleR.y = Math.max(0, Math.min(H - PADDLE_H, paddleR.y));

    // ball
    ball.x += ball.vx;
    ball.y += ball.vy;
    if (ball.y - ball.r < 0) { ball.y = ball.r; ball.vy *= -1; }
    if (ball.y + ball.r > H) { ball.y = H - ball.r; ball.vy *= -1; }

    // paddle hit — left
    if (ball.x - ball.r < MARGIN + PADDLE_W && ball.x > MARGIN) {
      if (ball.y > paddleL.y && ball.y < paddleL.y + PADDLE_H && ball.vx < 0) {
        ball.vx = Math.abs(ball.vx) * 1.05;
        const off = (ball.y - (paddleL.y + PADDLE_H / 2)) / (PADDLE_H / 2);
        ball.vy += off * 2;
      }
    }
    // paddle hit — right
    if (ball.x + ball.r > W - MARGIN - PADDLE_W && ball.x < W - MARGIN) {
      if (ball.y > paddleR.y && ball.y < paddleR.y + PADDLE_H && ball.vx > 0) {
        ball.vx = -Math.abs(ball.vx) * 1.05;
        const off = (ball.y - (paddleR.y + PADDLE_H / 2)) / (PADDLE_H / 2);
        ball.vy += off * 2;
      }
    }
    // cap speed
    const max = 11;
    ball.vx = Math.max(-max, Math.min(max, ball.vx));
    ball.vy = Math.max(-max, Math.min(max, ball.vy));

    // score
    if (ball.x < -20) { scoreR++; updateHud(); checkWin('right'); serve(1); }
    if (ball.x > W + 20) { scoreL++; updateHud(); checkWin('left'); serve(-1); saveHi(); }
  }

  function saveHi() {
    try {
      const cur = parseInt(localStorage.getItem(HI_KEY), 10) || 0;
      if (scoreL > cur) localStorage.setItem(HI_KEY, String(scoreL));
    } catch (e) {}
  }

  function checkWin(side) {
    if (scoreL >= TARGET || scoreR >= TARGET) {
      finished = true;
      running = false;
      cancelAnimationFrame(raf);
      draw();
      const win = scoreL > scoreR ? 'You win!' : (mode === '2p' ? 'Right wins!' : 'AI wins.');
      drawCenter(win, scoreL + ' — ' + scoreR);
    }
  }

  function drawCenter(top, bottom) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '32px VT323, monospace';
    ctx.fillText(top, W / 2, H / 2 - 12);
    ctx.font = '20px VT323, monospace';
    ctx.fillText(bottom, W / 2, H / 2 + 18);
  }

  function draw() {
    ctx.fillStyle = color('btn-bg-strong');
    ctx.fillRect(0, 0, W, H);
    // mid line
    ctx.fillStyle = color('rule');
    for (let y = 6; y < H; y += 16) ctx.fillRect(W / 2 - 1, y, 2, 8);
    // paddles
    ctx.fillStyle = color('fg');
    ctx.fillRect(MARGIN, paddleL.y, PADDLE_W, PADDLE_H);
    ctx.fillStyle = color('accent');
    ctx.fillRect(W - MARGIN - PADDLE_W, paddleR.y, PADDLE_W, PADDLE_H);
    // ball
    ctx.fillStyle = color('fg');
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();
  }

  function loop() {
    if (!running) return;
    step();
    draw();
    raf = requestAnimationFrame(loop);
  }

  function start() {
    if (finished) reset(true);
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

  // input
  document.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
    if (e.key.toLowerCase() === 'p') togglePause();
    if (['arrowup','arrowdown','w','s','p'].includes(e.key.toLowerCase())) e.preventDefault();
  });
  document.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

  // touch — drag inside left half controls left paddle
  canvas.addEventListener('touchmove', (e) => {
    const t = e.touches[0];
    const r = canvas.getBoundingClientRect();
    const y = (t.clientY - r.top) * (H / r.height);
    paddleL.y = Math.max(0, Math.min(H - PADDLE_H, y - PADDLE_H / 2));
    e.preventDefault();
  }, { passive: false });

  document.getElementById('play').addEventListener('click', start);
  document.getElementById('pause').addEventListener('click', togglePause);
  document.getElementById('reset').addEventListener('click', () => { reset(true); cancelAnimationFrame(raf); running = false; });

  document.querySelectorAll('.seg[data-control="mode"] button').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.seg[data-control="mode"] button').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      mode = b.dataset.value;
      reset(true);
    });
  });

  new MutationObserver(() => draw())
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  reset(true);
})();
