// Continuous motion for index page letters, buttons, text
const letters = document.querySelectorAll('#title .letter');
const btn = document.getElementById('enterBtn');
const logo = document.getElementById('pdLogo');

let t = 0;
function loop() {
  t += 0.02;
  letters.forEach((l, i) => {
    const y = Math.sin(t + i * 0.6) * 6;
    const r = Math.cos(t + i * 0.4) * 4;
    l.style.transform = `translateY(${y}px) rotate(${r}deg)`;
  });
  if (btn) {
    btn.style.transform = `translateY(${Math.sin(t * 1.2) * 8}px)`;
  }
  if (logo) {
    logo.style.transform = `translateY(${Math.cos(t * 0.8) * 5}px) rotate(${Math.sin(t * 0.5) * 2}deg)`;
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
