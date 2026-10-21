export function readTheme() {
  try {
    const t = localStorage.getItem('vsk.theme');
    if (t) return t;
  } catch {
    /* storage unavailable */
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'dark' ? '#0a1f52' : '#0b2a6f');
  try {
    localStorage.setItem('vsk.theme', t);
  } catch {
    /* storage unavailable */
  }
}
