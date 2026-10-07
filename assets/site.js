/* Progressive enhancement: navigation and article content work without JS. */
(() => {
  'use strict';
  const root = document.documentElement;
  const themeButton = document.querySelector('[data-theme-toggle]');
  const syncThemeLabel = () => {
    const isDark = root.dataset.theme === 'dark';
    if (themeButton) {
      themeButton.setAttribute('aria-label', isDark ? '切换为浅色模式' : '切换为深色模式');
      themeButton.setAttribute('title', isDark ? '切换为浅色模式' : '切换为深色模式');
      themeButton.setAttribute('aria-pressed', String(isDark));
    }
  };
  syncThemeLabel();
  themeButton?.addEventListener('click', () => {
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('notebook-theme', root.dataset.theme); } catch (_) {}
    syncThemeLabel();
  });
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  media.addEventListener?.('change', event => {
    let preference = null;
    try { preference = localStorage.getItem('notebook-theme'); } catch (_) {}
    if (!preference) { root.dataset.theme = event.matches ? 'dark' : 'light'; syncThemeLabel(); }
  });

  let toastTimer;
  const showToast = message => {
    const toast = document.querySelector('[data-toast]');
    if (!toast) return;
    clearTimeout(toastTimer); toast.textContent = message; toast.hidden = false;
    toastTimer = setTimeout(() => { toast.hidden = true; }, 3300);
  };
  document.querySelector('[data-copy-link]')?.addEventListener('click', async () => {
    if (location.protocol === 'file:') {
      showToast('当前是本地预览；发布后可复制在线文章链接。'); return;
    }
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(location.href);
      showToast('文章链接已复制。');
    } catch (_) { showToast('浏览器未允许复制，请从地址栏复制链接。'); }
  });
  document.querySelector('[data-print]')?.addEventListener('click', () => window.print());

  const search = document.querySelector('[data-note-search]');
  const clearSearch = document.querySelector('[data-clear-search]');
  const cards = [...document.querySelectorAll('[data-note-card]')];
  const noteData = document.querySelector('#note-search-data');
  let index = [];
  if (noteData) { try { index = JSON.parse(noteData.textContent); } catch (_) {} }
  const applySearch = () => {
    const term = (search?.value || '').normalize('NFKC').toLocaleLowerCase().trim();
    const terms = term.split(/\s+/).filter(Boolean);
    let found = 0;
    for (const card of cards) {
      const data = index.find(item => item.slug === card.dataset.slug);
      const text = (data?.text || card.textContent).normalize('NFKC').toLocaleLowerCase();
      const matches = terms.every(word => text.includes(word));
      card.hidden = !matches; if (matches) found++;
    }
    const empty = document.querySelector('[data-no-results]');
    if (empty) empty.hidden = found > 0;
    const status = document.querySelector('[data-search-status]');
    if (status) {
      const grouped = cards.some(card => card.dataset.noteKind === 'topic');
      status.textContent = term
        ? (grouped ? `找到 ${found} 个相关条目` : `找到 ${found} 篇相关笔记`)
        : (grouped ? `共 ${cards.length} 个条目（笔记与专题）` : `已收录 ${cards.length} 篇笔记`);
    }
    if (clearSearch) clearSearch.hidden = !term;
  };
  search?.addEventListener('input', applySearch);
  clearSearch?.addEventListener('click', () => { search.value = ''; applySearch(); search.focus(); });
  document.addEventListener('keydown', event => {
    const editable = /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName) || event.target.isContentEditable;
    if (event.key === '/' && search && !editable && !event.metaKey && !event.ctrlKey && !event.altKey) {
      event.preventDefault(); search.focus();
    }
    if (event.key === 'Escape' && document.activeElement === search) {
      search.value = ''; applySearch(); search.blur();
    }
  });
  const tocLinks = [...document.querySelectorAll('.toc a')];
  const article = document.querySelector('.article-body');
  const headings = article ? [...article.querySelectorAll('h2[id],h3[id]')] : [];
  const progress = document.querySelector('[data-reading-progress]');
  const backTop = document.querySelector('[data-back-top]');
  let scheduled = false;
  const updateScroll = () => {
    scheduled = false;
    if (backTop) backTop.hidden = window.scrollY < 450;
    if (!article) return;
    const articleTop = article.getBoundingClientRect().top + window.scrollY;
    const end = articleTop + article.offsetHeight - window.innerHeight;
    const start = Math.max(0, articleTop - 160);
    const percent = Math.min(1, Math.max(0, (window.scrollY - start) / Math.max(1, end - start)));
    if (progress) progress.style.transform = `scaleX(${percent})`;
    let current = headings[0]?.id;
    for (const heading of headings) {
      if (heading.getBoundingClientRect().top <= 155) current = heading.id;
    }
    for (const link of tocLinks) {
      const active = link.hash === `#${current}`;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current');
    }
  };
  window.addEventListener('scroll', () => {
    if (!scheduled) { requestAnimationFrame(updateScroll); scheduled = true; }
  }, {passive:true});
  window.addEventListener('resize', updateScroll, {passive:true});
  updateScroll();
  backTop?.addEventListener('click', () => {
    window.scrollTo({top:0, behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
    document.querySelector('h1')?.focus({preventScroll:true});
  });
})();
