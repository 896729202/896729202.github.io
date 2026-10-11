/* Progressive enhancement: every table and legacy anchor works without JS. */
(() => {
  'use strict';
  const root = document.querySelector('[data-rk-root]');
  if (!root) return;
  const rankScope = root.querySelector('#latest-rank-scope');
  if (rankScope) {
    rankScope.addEventListener('change', () => {
      const protocol = rankScope.value === 'protocol';
      for (const cell of root.querySelectorAll('[data-latest-metric]')) {
        // Both rank sets come from the original report; display values are rounded.
        const rank = Number(protocol ? cell.dataset.protocolRank : cell.dataset.globalRank);
        const value = cell.querySelector('.rk-value');
        value.classList.toggle('rk-rank-1', rank === 1);
        value.classList.toggle('rk-rank-2', rank === 2);
        value.textContent = cell.dataset.displayValue + (rank === 1 ? ' ①' : rank === 2 ? ' ②' : '');
        const label = rank === 1 || rank === 2 ? `；${protocol ? '同输入协议' : '全部留出方法'}第 ${rank} 名` : '';
        cell.setAttribute('aria-label', cell.dataset.labelBase + label);
      }
      root.querySelector('#latest-rank-description').textContent = protocol
        ? '每个数据集、每项指标，分别在逐场景优化和两帧上下文方法内部标记第一与第二；源视图诊断不参与。'
        : '每个数据集、每项指标，在全部完整留出方法中标记第一与第二。';
    });
  }
  const families = [...root.querySelectorAll('[data-rk-family]')];
  const groups = [...root.querySelectorAll('[data-rk-tabs]')];
  const remembered = new Map();
  const targetOf = link => document.getElementById(link.hash.slice(1));
  for (const [i, nav] of groups.entries()) {
    nav.setAttribute('role', 'tablist');
    [...nav.querySelectorAll('a')].forEach((link, j) => {
      const panel = targetOf(link);
      if (!panel) throw new Error('Missing ranking panel: ' + link.hash);
      link.id = `rk-tab-${i}-${j}`;
      link.setAttribute('role', 'tab');
      link.setAttribute('aria-controls', panel.id);
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', link.id);
    });
  }
  function select(nav, panel) {
    if (!nav || !panel) return;
    for (const link of nav.querySelectorAll('a')) {
      const p = targetOf(link);
      const chosen = p === panel;
      p.hidden = !chosen;
      link.setAttribute('aria-selected', String(chosen));
      link.tabIndex = chosen ? 0 : -1;
    }
  }
  function activate(target) {
    if (!target) return;
    const family = target.closest('[data-rk-family]');
    if (family) {
      select(root.querySelector('[data-rk-tabs="family"]'), family);
      const dataset = target.closest('[data-rk-dataset]') ||
        remembered.get(family.id) || family.querySelector('[data-rk-dataset]');
      select(family.querySelector('[data-rk-tabs="dataset"]'), dataset);
      remembered.set(family.id, dataset);
    }
    for (let p = target.parentElement; p && p !== root; p = p.parentElement) {
      if (p.tagName === 'DETAILS') p.open = true;
    }
  }
  function hashTarget() {
    try { return document.getElementById(decodeURIComponent(location.hash.slice(1))); }
    catch (_) { return null; }
  }
  function onHash(scroll) {
    const target = hashTarget();
    if (target && root.contains(target)) {
      activate(target);
      if (scroll) requestAnimationFrame(() => target.scrollIntoView({block: 'start'}));
    }
  }
  for (const family of families) {
    const first = family.querySelector('[data-rk-dataset]');
    select(family.querySelector('[data-rk-tabs="dataset"]'), first);
    remembered.set(family.id, first);
  }
  // Initialize history tabs without opening their parent disclosure.
  select(root.querySelector('[data-rk-tabs="family"]'), families[0]);
  root.dataset.enhanced = 'true';
  onHash(true);
  for (const nav of groups) {
    nav.addEventListener('click', event => {
      const link = event.target.closest('a');
      if (!link || !nav.contains(link) || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      activate(targetOf(link));
      try { history.replaceState(null, '', link.hash); } catch (_) { /* file preview */ }
    });
    nav.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      const tabs = [...nav.querySelectorAll('a')];
      let n = tabs.indexOf(document.activeElement);
      if (n < 0) return;
      event.preventDefault();
      if (event.key === 'Home') n = 0;
      else if (event.key === 'End') n = tabs.length - 1;
      else n = (n + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      tabs[n].click(); tabs[n].focus({preventScroll:true});
      tabs[n].scrollIntoView({block:'nearest', inline:'nearest'});
    });
  }
  window.addEventListener('hashchange', () => onHash(true));
  window.addEventListener('beforeprint', () => families.forEach(f => {
    f.hidden = false; f.querySelectorAll('[data-rk-dataset]').forEach(p => {p.hidden = false;});
  }));
  window.addEventListener('afterprint', () => {
    const target = hashTarget();
    if (target) activate(target);
    else select(root.querySelector('[data-rk-tabs="family"]'), families[0]);
  });
})();
