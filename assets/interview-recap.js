(() => {
  const key = 'dji-recap-2026-11-12-v1';
  const checks = [...document.querySelectorAll('[data-review]')];
  const panels = [...document.querySelectorAll('.recap-deep')];
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch (_) {}
  const update = () => {
    document.getElementById('recap-progress').textContent = `已复盘 ${checks.filter(x => x.checked).length} / ${checks.length}`;
  };
  checks.forEach(input => {
    input.checked = saved[input.dataset.review] === true;
    input.addEventListener('change', () => {
      saved[input.dataset.review] = input.checked;
      try { localStorage.setItem(key, JSON.stringify(saved)); } catch (_) {}
      update();
    });
  });
  document.querySelector('[data-recap-expand]').addEventListener('click', () => panels.forEach(x => x.open = true));
  document.querySelector('[data-recap-collapse]').addEventListener('click', () => panels.forEach(x => x.open = false));
  let beforePrint = [];
  window.addEventListener('beforeprint', () => { beforePrint = panels.map(x => x.open); panels.forEach(x => x.open = true); });
  window.addEventListener('afterprint', () => panels.forEach((x, i) => x.open = beforePrint[i] || false));
  update();
})();
