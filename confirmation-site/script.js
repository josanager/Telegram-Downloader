(function () {
  const c = document.getElementById('particles-bg');
  if (!c) return;
  const ctx = c.getContext('2d');
  let w = 0;
  let h = 0;
  const resize = () => {
    w = c.width = window.innerWidth;
    h = c.height = window.innerHeight;
  };
  resize();
  window.addEventListener('resize', resize);

  const pts = Array.from({ length: 54 }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    r: Math.random() * 2 + 0.5,
    dx: (Math.random() - 0.5) * 0.25,
    dy: (Math.random() - 0.5) * 0.25,
    a: Math.random() * 0.35 + 0.08
  }));

  (function draw() {
    ctx.clearRect(0, 0, w, h);
    pts.forEach((p) => {
      p.x += p.dx;
      p.y += p.dy;
      if (p.x < 0) p.x = w;
      if (p.x > w) p.x = 0;
      if (p.y < 0) p.y = h;
      if (p.y > h) p.y = 0;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,55,55,${p.a})`;
      ctx.fill();
    });
    requestAnimationFrame(draw);
  })();
})();
