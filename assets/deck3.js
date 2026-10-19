/* 링구아 고등 내신 강의본 3판 — 지문마다 판 셋(① 주제문 · ② 어법 · 어휘 · ③ 전체) · 오른쪽 칸 해석 ↔ 구조도 (외부 스크립트 0)
   데이터 = window.DECK3(build/build_3pan.py 가 원고에서 지음). 무대 1600×900 을 창에 맞춰 줄이고 늘린다.
   넘김: → · Space · PageDown · Enter · 화면 클릭 = 다음 판 / ← · PageUp · Backspace = 이전 판 / 1 · 2 · 3 = 그 판 / Home · End
   T = 해석 ↔ 구조도 · F = 전체 화면 · Esc = 자세히 닫기. 어법 칩 · 어휘를 누르면 그 자리의 규칙 · 틀린 꼴(뜻 · 유의어)이 뜬다.
   주소 끝 #2 · #2.map 으로 바로 간다(지문이 한 화면을 넘으면 그 판 안에서 → 가 먼저 아래로 넘긴다). */
(function () {
  'use strict';
  var D = window.DECK3, M = D.meta;
  var W = 1600, H = 900;
  var RM = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var LAYERS = { topic: ['L1'], gram: ['L2'], all: ['L1', 'L2', 'L3'] };
  var SIDES = [{ key: 'ko', name: '해석' }, { key: 'map', name: '구조도' }];
  var state = { b: 0, side: 'ko', pop: null };

  /* ------------------------------------------------------------ 작은 도구 */
  function h(tag, attrs) {
    var el = document.createElement(tag), i, k;
    attrs = attrs || {};
    for (k in attrs) {
      if (!Object.prototype.hasOwnProperty.call(attrs, k) || attrs[k] == null || attrs[k] === false) continue;
      if (k === 'class') el.className = attrs[k];
      else if (k === 'text') el.textContent = attrs[k];
      else el.setAttribute(k, attrs[k]);
    }
    for (i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  }
  function add(el, kid) {
    if (kid == null || kid === false) return;
    if (Array.isArray(kid)) { kid.forEach(function (k) { add(el, k); }); return; }
    el.appendChild(typeof kid === 'string' || typeof kid === 'number' ? document.createTextNode(String(kid)) : kid);
  }
  function svg(path, cls, vb) {
    var ns = 'http://www.w3.org/2000/svg', s = document.createElementNS(ns, 'svg'), p = document.createElementNS(ns, 'path');
    s.setAttribute('viewBox', vb || '0 0 24 24'); s.setAttribute('aria-hidden', 'true'); if (cls) s.setAttribute('class', cls);
    p.setAttribute('d', path); s.appendChild(p); return s;
  }
  var ICON = {
    star: 'M12 2.8l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 16.8l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z',
    down: 'M12 3v16m-6-6 6 6 6-6', x: 'M6 6l12 12M18 6 6 18', prev: 'm15 18-6-6 6-6', next: 'm9 18 6-6-6-6'
  };
  function star() { return svg(ICON.star, 'ico-star'); }
  function each(sel, fn, root) { Array.prototype.forEach.call((root || document).querySelectorAll(sel), fn); }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function scale() { return document.getElementById('stage').getBoundingClientRect().width / W; }

  /* 근거 문구를 글 노드에서 찾아 감싼다(여러 조각에 걸쳐도) — deck.js 와 같은 규칙 */
  function normQ(s) { return s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"'); }
  /* 낱말 경계에서 시작 · 끝나는 자리만(「them」 이 「mathematical」 안에서 잡히지 않게) */
  function findWord(text, q) {
    var i = text.indexOf(q), w = /[a-z0-9]/;
    while (i >= 0) {
      var b = i > 0 ? text[i - 1] : ' ', e = text[i + q.length] || ' ';
      if (!(w.test(q[0]) && w.test(b)) && !(w.test(q[q.length - 1]) && w.test(e))) return i;
      i = text.indexOf(q, i + 1);
    }
    return -1;
  }
  function wrapQuote(root, quote, cls) {
    if (!root || !quote) return false;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), nodes = [], text = '', n;
    while ((n = walker.nextNode())) { nodes.push({ n: n, a: text.length }); text += n.nodeValue; }
    var at = findWord(normQ(text).toLowerCase(), normQ(quote).toLowerCase());
    if (at < 0) return false;
    var end = at + quote.length, made = [];
    nodes.forEach(function (o) {
      var a = Math.max(at, o.a), b = Math.min(end, o.a + o.n.nodeValue.length);
      if (a >= b) return;
      var r = document.createRange();
      r.setStart(o.n, a - o.a); r.setEnd(o.n, b - o.a);
      var span = h('span', { class: cls });
      r.surroundContents(span);
      made.push(span);
    });
    return made.length ? made : false;
  }
  function fit(scope, box, name, max, min) {
    var v = max;
    for (; v >= min; v -= 0.5) {
      scope.style.setProperty(name, v + 'px');
      if (box.scrollHeight <= box.clientHeight + 1) break;
    }
    var over = v < min;
    if (over) scope.style.setProperty(name, min + 'px');
    box.classList.toggle('scroll', over);
    return over ? 'scroll' : String(v);
  }

  /* ------------------------------------------------------------ 지문(한 번만 놓고 층만 바꾼다) */
  var G = {}, V = {};
  D.grammar.forEach(function (g) { G[g.id] = g; });
  D.vocab.forEach(function (v, i) { V['v' + i] = v; });
  function keyKind(n) { return n === D.topic ? 'topic' : (n === D.gist ? 'gist' : null); }
  function keyTab(n) {
    var k = keyKind(n);
    return k === 'topic' ? '주제문' : (k === 'gist' ? '요지' : null);
  }
  function passage() {
    var pt = h('div', { class: 'ptext', id: 'ptext' });
    D.sents.forEach(function (s, i) {
      var tb = h('span', { class: 'tb' + (keyKind(s.n) ? ' key' : ''), 'data-n': s.n });
      D.runs[i].forEach(function (r) {
        if (r.c === 'g') tb.appendChild(h('span', { class: 'g', 'data-id': r.id, role: 'button', tabindex: '-1', 'aria-label': r.t + ' 어법 자세히' }, r.t));
        else if (r.c === 'v') tb.appendChild(h('span', { class: 'v', 'data-id': r.id, role: 'button', tabindex: '-1', 'aria-label': r.t + ' 뜻 자세히' }, r.t));
        else if (r.c === 'c') tb.appendChild(h('span', { class: 'cn', 'data-rel': r.lab || '' }, r.t));
        else tb.appendChild(document.createTextNode(r.t));
      });
      pt.appendChild(h('span', { class: 's', 'data-n': s.n }, h('span', { class: 'sn', 'aria-label': '문장 ' + s.n }, String(s.n)), tb));
      pt.appendChild(document.createTextNode(' '));
    });
    function tb(n) { return pt.querySelector('.tb[data-n="' + n + '"]'); }
    (D.hl || []).forEach(function (x) { wrapQuote(tb(x.sent), x.text, 'hlx'); });
    (D.ref || []).forEach(function (r, i) {
      var a = wrapQuote(tb(r.sent), r.text, 'rf'), b = wrapQuote(tb(r.to_sent), r.to, 'rfa');
      [a, b].forEach(function (x) { if (x) x[x.length - 1].setAttribute('data-rn', String(i + 1)); });
    });
    /* 꼬리표는 문구를 다 감싼 뒤에 붙인다(꼬리표 글이 문구 찾기에 섞이지 않게) */
    D.sents.forEach(function (s) {
      var t = keyTab(s.n);
      if (t) { var b = tb(s.n); b.insertBefore(h('span', { class: 'ttab', 'aria-hidden': 'true' }, keyKind(s.n) === 'gist' ? star() : null, t), b.firstChild); }
    });
    var gi = 0, vi = 0;
    each('.g', function (el) {
      var g = G[el.getAttribute('data-id')];
      el.style.setProperty('--i', gi++);
      el.appendChild(h('span', { class: 'glab' + (g.imp >= 2 || g.deck ? ' hot' : ''), 'aria-hidden': 'true' },
        h('b', null, g.chip), g.wrong.map(function (w) { return h('s', null, w); })));
    }, pt);
    each('.v', function (el) {
      var v = V[el.getAttribute('data-id')];
      el.style.setProperty('--i', vi++);
      el.appendChild(h('span', { class: 'vgl', 'aria-hidden': 'true' }, v.gloss));
    }, pt);
    each('[data-rn]', function (el) {
      el.appendChild(h('span', { class: 'rna', 'aria-hidden': 'true' }, h('span', { class: 'rnb' }, el.getAttribute('data-rn'))));
    }, pt);
    each('.cn', function (el) { if (el.getAttribute('data-rel')) el.appendChild(h('span', { class: 'clab', 'aria-hidden': 'true' }, el.getAttribute('data-rel'))); }, pt);
    return pt;
  }

  /* ------------------------------------------------------------ 오른쪽: 해석 · 구조도 */
  function koPanel() {
    var kol = h('div', { class: 'kol' });
    D.sents.forEach(function (s) {
      var t = keyTab(s.n);
      kol.appendChild(h('div', { class: 'kr' + (t ? ' key' : ''), 'data-n': s.n },
        h('span', { class: 'n-chip', 'aria-label': '문장 ' + s.n }, String(s.n)),
        h('span', { class: 'kt' }, t ? h('span', { class: 'ktab' }, keyKind(s.n) === 'gist' ? star() : null, t) : null, s.ko)));
    });
    return h('div', { class: 'pnl ko', 'data-side': 'ko', role: 'region', 'aria-label': '해석' }, kol);
  }
  function mapPanel() {
    var map = h('div', { class: 'map' }), F = D.flow;
    F.boxes.forEach(function (b, i) {
      if (i > 0) map.appendChild(h('div', { class: 'mlink' }, svg(ICON.down), F.arrows[i - 1] ? h('i', null, F.arrows[i - 1]) : null));
      var rng = '문장 ' + b.sents[0] + (b.sents[1] !== b.sents[0] ? '~' + b.sents[1] : '');
      map.appendChild(h('div', { class: 'mbox' + (b.star ? ' star' : ''), 'data-a': b.sents[0], 'data-b': b.sents[1] },
        h('span', { class: 'bn' }, String(i + 1)), h('span', { class: 'bl' }, b.label, b.star ? star() : null), h('span', { class: 'br' }, rng),
        h('div', { class: 'bt' }, b.text)));
    });
    if (M.gist_ko) map.appendChild(h('div', { class: 'mgist' }, h('b', null, '요지'), h('span', null, M.gist_ko)));
    return h('div', { class: 'pnl map', 'data-side': 'map', role: 'region', 'aria-label': '구조도' }, map);
  }

  /* ------------------------------------------------------------ 틀 */
  var root, view;
  function chrome() {
    var stage = document.getElementById('stage');
    var chip = M.grade + ' · ' + String(M.year).slice(2) + '년 ' + M.month + '월 · ' + M.item_no + '번';
    var bseg = h('div', { class: 'bseg', id: 'bseg', role: 'group', 'aria-label': '판 고르기' });
    D.boards.forEach(function (b, i) {
      bseg.appendChild(h('button', { type: 'button', 'data-b': i, 'aria-pressed': 'false' }, h('span', { class: 'no' }, b.no), b.name, h('span', { class: 'kbd' }, String(i + 1))));
    });
    var hdr = h('header', { id: 'hdr' },
      h('a', { class: 'brand', href: '../index.html', title: '지문 목록' }, h('img', { src: '../assets/img/lingua_mark.png', alt: '링구아' }), h('b', null, '링구아 고등 내신'), h('span', null, '강의본')),
      h('div', { class: 'hsep' }), h('span', { class: 'pchip' }, chip),
      h('div', { id: 'htitle' }, M.orig_type ? h('span', { class: 'ty' }, M.orig_type) : null, h('span', { class: 'tt' }, M.title_ko || '')),
      bseg, h('button', { class: 'tbtn', id: 'bFs', type: 'button' }, '전체 화면', h('span', { class: 'kbd' }, 'F')));
    view = h('main', { id: 'view' });
    view.appendChild(h('img', { id: 'wm', src: '../assets/img/watermark.png', alt: '', 'aria-hidden': 'true' }));
    var nG = D.grammar.length, nV = D.vocab.length;
    var lhead = h('div', { class: 'chead' }, h('span', { class: 'lb' }, '지문'),
      h('span', { class: 'cnt k1' }, h('b', { class: 'c-tp' }, '주제문 ' + (D.topic || '―')), D.gist && D.gist !== D.topic ? h('b', { class: 'c-tp' }, '· 요지 ' + D.gist) : null),
      h('span', { class: 'cnt k2' }, h('b', { class: 'c-gr' }, '어법 ' + nG), '·', h('b', { class: 'c-voc' }, '어휘 ' + nV)));
    var sseg = h('div', { class: 'seg', id: 'sseg', role: 'group', 'aria-label': '오른쪽 칸' });
    SIDES.forEach(function (s, i) { sseg.appendChild(h('button', { type: 'button', 'data-side': s.key }, s.name, i === 0 ? h('span', { class: 'kbd' }, 'T') : null)); });
    var rhead = h('div', { class: 'chead' }, h('span', { class: 'lb', id: 'sidelb' }, '해석'), h('div', { class: 'side' }, sseg));
    root = h('section', { class: 'b3' },
      h('div', { class: 'lcol', id: 'lcol' }, lhead, passage()),
      h('div', { class: 'rcol' }, rhead, h('div', { class: 'pbox' }, koPanel(), mapPanel())));
    view.appendChild(root);
    var ftr = h('footer', { id: 'ftr' }, h('div', { id: 'prog' }), h('div', { id: 'pgnum' }),
      h('div', { class: 'hint' }, h('span', null, h('span', { class: 'kbd' }, '1'), h('span', { class: 'kbd' }, '2'), h('span', { class: 'kbd' }, '3'), '판'),
        h('span', null, h('span', { class: 'kbd' }, 'T'), '해석 ↔ 구조도'), h('span', null, '칩을 누르면 자세히')),
      h('div', { id: 'nav' },
        h('button', { class: 'nbtn', id: 'prev', type: 'button', 'aria-label': '이전 판' }, svg(ICON.prev)),
        h('button', { class: 'nbtn pri', id: 'next', type: 'button' }, h('span', { id: 'nextTx' }, '다음'), svg(ICON.next))));
    add(stage, [hdr, view, ftr]);

    bseg.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) setBoard(+b.getAttribute('data-b')); });
    sseg.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) setSide(b.getAttribute('data-side')); });
    document.getElementById('next').onclick = next;
    document.getElementById('prev').onclick = prev;
    document.getElementById('bFs').onclick = fullscreen;
    view.addEventListener('click', onViewClick);
    view.addEventListener('mouseover', onHover);
    view.addEventListener('mouseleave', function () { hover(0); });
    view.addEventListener('keydown', function (e) {
      var m = e.target.closest && e.target.closest('.g,.v');
      if (m && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); e.stopPropagation(); openPop(m); }
    });
  }

  /* ------------------------------------------------------------ 판 · 칸 바꾸기 */
  function setBoard(i) {
    i = Math.max(0, Math.min(D.boards.length - 1, i));
    closePop();
    state.b = i;
    var lay = LAYERS[D.boards[i].key] || [];
    ['L1', 'L2', 'L3'].forEach(function (L) { root.classList.toggle(L, lay.indexOf(L) >= 0); });
    each('#bseg button', function (b) { b.setAttribute('aria-pressed', +b.getAttribute('data-b') === i ? 'true' : 'false'); });
    var on = lay.indexOf('L2') >= 0;
    each('.g,.v', function (m) { m.setAttribute('tabindex', on ? '0' : '-1'); }, root);
    var pt = document.getElementById('ptext'); if (pt) pt.scrollTop = 0;
    relayAll();
    ui();
  }
  function setSide(k) {
    state.side = k === 'map' ? 'map' : 'ko';
    each('.pnl', function (p) { p.classList.toggle('cur', p.getAttribute('data-side') === state.side); });
    each('#sseg button', function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-side') === state.side ? 'true' : 'false'); });
    document.getElementById('sidelb').textContent = state.side === 'map' ? '구조도' : '해석';
    ui();
  }
  function ui() {
    var n = D.boards.length;
    document.getElementById('pgnum').textContent = D.boards[state.b].full + ' · ' + (state.b + 1) + ' / ' + n;
    document.getElementById('prog').style.width = ((state.b + 1) / n * 100) + '%';
    document.getElementById('prev').disabled = state.b === 0 && !canScroll(-1);
    var last = state.b === n - 1;
    document.getElementById('next').disabled = last && !canScroll(1);
    document.getElementById('nextTx').textContent = canScroll(1) ? '아래로' : (last ? '끝' : D.boards[state.b + 1].full);
    try { history.replaceState(null, '', location.pathname + location.search + '#' + (state.b + 1) + (state.side === 'map' ? '.map' : '')); } catch (e) { /* file:// 일부 */ }
  }
  function canScroll(dir) {
    var pt = document.getElementById('ptext');
    if (!pt || !pt.classList.contains('scroll')) return false;
    return dir > 0 ? pt.scrollTop + pt.clientHeight < pt.scrollHeight - 2 : pt.scrollTop > 2;
  }
  function page(dir) { var pt = document.getElementById('ptext'); pt.scrollBy({ top: dir * pt.clientHeight * 0.85, behavior: RM ? 'auto' : 'smooth' }); setTimeout(ui, 450); }
  function next() { if (state.pop) return closePop(); if (canScroll(1)) return page(1); if (state.b < D.boards.length - 1) setBoard(state.b + 1); }
  function prev() { if (state.pop) return closePop(); if (canScroll(-1)) return page(-1); if (state.b > 0) setBoard(state.b - 1); }
  function fullscreen() { if (!document.fullscreenElement) { if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen(); } else document.exitFullscreen(); }

  /* ------------------------------------------------------------ 자세히(어법 · 어휘) */
  function closePop() {
    if (!state.pop) return;
    state.pop.el.remove();
    state.pop.mark.classList.remove('open');
    state.pop = null;
  }
  function openPop(mark) {
    if (!root.classList.contains('L2')) return;
    var same = state.pop && state.pop.mark === mark;
    closePop();
    if (same) return;
    var id = mark.getAttribute('data-id'), card;
    var x = h('button', { type: 'button', 'aria-label': '닫기' }, svg(ICON.x));
    if (G[id]) {
      var g = G[id];
      card = h('div', { class: 'pop', role: 'dialog', 'aria-label': g.text + ' 어법' },
        h('div', { class: 'ph' }, h('b', null, g.chip), h('i', null, '문장 ' + g.sent + ' · ' + g.cat), x),
        h('div', { class: 'pw' }, h('strong', null, g.right), g.wrong.length ? [h('em', null, '틀린 꼴'), g.wrong.map(function (w) { return h('s', null, w); })] : null),
        h('div', { class: 'pr' }, g.rule));
    } else {
      var v = V[id];
      card = h('div', { class: 'pop voc', role: 'dialog', 'aria-label': v.text + ' 뜻' },
        h('div', { class: 'ph' }, h('b', null, '어휘'), h('i', null, '문장 ' + v.sent), x),
        h('div', { class: 'pw' }, h('strong', null, v.text), h('span', null, v.ko)),
        (v.syn.length || v.ant.length) ? h('div', { class: 'pl' },
          v.syn.length ? [h('em', null, '유의어'), h('span', null, v.syn.join(', '))] : null,
          v.ant.length ? [h('em', null, '반의어'), h('span', null, v.ant.join(', '))] : null) : null);
    }
    var lcol = document.getElementById('lcol');
    lcol.appendChild(card);
    var sc = scale(), lr = lcol.getBoundingClientRect(), mr = mark.getBoundingClientRect();
    var left = (mr.left - lr.left) / sc, top = (mr.bottom - lr.top) / sc + 26;
    left = Math.max(0, Math.min(left, lcol.clientWidth - card.offsetWidth));
    if (top + card.offsetHeight > lcol.clientHeight) top = (mr.top - lr.top) / sc - card.offsetHeight - 30;
    card.style.left = left + 'px'; card.style.top = Math.max(0, top) + 'px';
    mark.classList.add('open');
    x.onclick = function (e) { e.stopPropagation(); closePop(); mark.focus(); };
    state.pop = { el: card, mark: mark };
  }
  function onViewClick(e) {
    if (e.target.closest('a,button,.pop')) return;
    var m = e.target.closest('.g,.v');
    if (m && root.classList.contains('L2')) { openPop(m); return; }
    if (state.pop) { closePop(); return; }
    next();
  }

  /* ------------------------------------------------------------ 문장 짚기(왼쪽 ↔ 오른쪽) */
  function hover(n) {
    each('.s', function (s) { s.classList.toggle('hov', +s.getAttribute('data-n') === n); }, root);
    each('.kr', function (r) { r.classList.toggle('hov', +r.getAttribute('data-n') === n); }, root);
    each('.mbox', function (b) { b.classList.toggle('hov', n > 0 && n >= +b.getAttribute('data-a') && n <= +b.getAttribute('data-b')); }, root);
  }
  function onHover(e) {
    var s = e.target.closest('.s,.kr');
    var b = e.target.closest('.mbox');
    if (s) hover(+s.getAttribute('data-n'));
    else if (b) hover(+b.getAttribute('data-a'));
    else hover(0);
  }

  /* ------------------------------------------------------------ 꼬리표 겹침 풀기 · 맞추기 */
  function relay(sel) {
    /* 같은 줄에서 앞 꼬리표와 겹치면 오른쪽으로 민다(글 자리는 그대로).
       자리는 틀(offset)로 잰다 — 판이 바뀌는 중의 움직임(transform)에 흔들리지 않게 */
    var sc = scale(), items = [];
    each(sel, function (el) { el.style.marginLeft = ''; }, root);
    each(sel, function (el) {
      if (!el.offsetParent || getComputedStyle(el).display === 'none') return;
      var pr = el.offsetParent.getBoundingClientRect(), w = el.offsetWidth;
      var left = pr.left / sc + el.offsetLeft - (el.classList.contains('vgl') ? w / 2 : 0);
      items.push({ el: el, top: Math.round(pr.top / sc), left: left, w: w });
    }, root);
    /* 줄로 묶기: 기준 높이에서 0.6em 안이면 같은 줄(꼬리표마다 붙는 자리 높이가 몇 px 다르다) */
    var tol = parseFloat(getComputedStyle(document.getElementById('ptext')).fontSize) * 0.6, lines = [];
    items.sort(function (a, b) { return a.top - b.top; });
    items.forEach(function (x) {
      var L = lines[lines.length - 1];
      if (L && x.top - L.top < tol) L.items.push(x); else lines.push({ top: x.top, items: [x] });
    });
    lines.forEach(function (L) {
      var prevR = null;
      L.items.sort(function (a, b) { return (a.left - b.left) || (+a.el.textContent || 0) - (+b.el.textContent || 0); }).forEach(function (x) {
        var left = x.left;
        if (prevR !== null && left < prevR + 6) { x.el.style.marginLeft = (prevR + 6 - left) + 'px'; left = prevR + 6; }
        prevR = left + x.w;
      });
    });
  }
  function relayAll() { relay('.glab,.clab,.rnb'); relay('.vgl'); }
  function fitAll() {
    var all = root.className;
    root.classList.add('L1', 'L2', 'L3', 'nofx');        // 재기는 모든 층을 켠 채 · 움직임 없이(층은 글 자리를 바꾸지 않는다)
    var lf = fit(root, document.getElementById('ptext'), '--fs', 30, 20);
    root.setAttribute('data-fit', lf);
    each('.pnl', function (p) {
      var k = p.getAttribute('data-side');
      p.setAttribute('data-fit', fit(root, p, k === 'map' ? '--mf' : '--ko', k === 'map' ? 24 : 23, 15));
    }, root);
    root.className = all + ' nofx';
    void root.offsetHeight;
    root.classList.remove('nofx');
  }

  /* ------------------------------------------------------------ 검사 손잡이(_review 캡처 · 넘침 · 겹침) */
  function rects(sel) {
    var out = [];
    each(sel, function (el) { var r = el.getBoundingClientRect(); if (r.width && r.height && getComputedStyle(el).opacity !== '0') out.push({ el: el, r: r }); }, root);
    return out;
  }
  function hit(a, b) { return a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1; }
  function collisions() {
    var labs = rects('.glab,.vgl,.clab,.ttab,.rnb'), out = [];
    for (var i = 0; i < labs.length; i++) {
      for (var j = i + 1; j < labs.length; j++) {
        if (hit(labs[i].r, labs[j].r)) out.push([labs[i].el.textContent, labs[j].el.textContent]);
      }
    }
    var lr = document.getElementById('ptext').getBoundingClientRect();
    labs.forEach(function (x) { if (x.r.left < lr.left - 1 || x.r.right > lr.right + 1 || x.r.top < lr.top - 1 || x.r.bottom > lr.bottom + 1) out.push(['밖', x.el.textContent]); });
    return out;
  }
  function overflow() {
    var out = [];
    each('.ptext,.pnl,.mbox,.kr,.chead,#htitle,.bseg', function (b) {
      if (b.classList.contains('scroll')) { out.push({ what: 'scroll', cls: b.className }); return; }
      if (b.scrollHeight > b.clientHeight + 2 || b.scrollWidth > b.clientWidth + 2) out.push({ what: 'box', cls: b.className, sh: b.scrollHeight, ch: b.clientHeight, sw: b.scrollWidth, cw: b.clientWidth });
    });
    var t = $('#htitle .tt'); if (t && t.scrollWidth > t.clientWidth + 1) out.push({ what: 'title-ellipsis', text: t.textContent });
    var vr = view.getBoundingClientRect();
    each('*', function (n) {
      if (!n.firstChild || n.closest('svg') || n.closest('.pnl:not(.cur)') || getComputedStyle(n).visibility === 'hidden') return;
      var r = n.getBoundingClientRect(); if (!r.width || !r.height) return;
      if (r.right > vr.right + 1 || r.bottom > vr.bottom + 1 || r.left < vr.left - 1 || r.top < vr.top - 1) out.push({ what: 'out-of-view', cls: n.className, text: (n.textContent || '').slice(0, 40) });
    }, root);
    return out.slice(0, 20);
  }
  window.__deck3 = {
    boards: D.boards.map(function (b) { return b.key; }),
    go: function (b, side) { setBoard(b); if (side) setSide(side); return 1; },
    state: function () { return { b: state.b, side: state.side, pop: !!state.pop, layers: ['L1', 'L2', 'L3'].filter(function (L) { return root.classList.contains(L); }), fit: root.getAttribute('data-fit') }; },
    open: function (id) { var m = root.querySelector('[data-id="' + id + '"]'); if (m) openPop(m); return !!state.pop; },
    overflow: overflow, collisions: collisions
  };

  /* ------------------------------------------------------------ 시작 */
  function scaleStage() {
    var sc = Math.min(innerWidth / W, innerHeight / H);
    document.getElementById('stage').style.transform = 'scale(' + sc + ')';
  }
  addEventListener('keydown', function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    var k = e.key;
    if (k === 'Escape') { closePop(); return; }
    if (e.target.closest && e.target.closest('.g,.v') && (k === 'Enter' || k === ' ')) return;
    if (k === 'ArrowRight' || k === ' ' || k === 'PageDown' || k === 'Enter') { e.preventDefault(); next(); }
    else if (k === 'ArrowLeft' || k === 'PageUp' || k === 'Backspace') { e.preventDefault(); prev(); }
    else if (k === 'Home') { e.preventDefault(); setBoard(0); }
    else if (k === 'End') { e.preventDefault(); setBoard(D.boards.length - 1); }
    else if (k === '1' || k === '2' || k === '3') setBoard(+k - 1);
    else if (k === 't' || k === 'T') setSide(state.side === 'ko' ? 'map' : 'ko');
    else if (k === 'f' || k === 'F') fullscreen();
  });
  function start() {
    chrome(); scaleStage();
    var m = /^#(\d)(?:\.(map|ko))?$/.exec(location.hash || '');
    var go0 = function () {
      fitAll();
      setSide(m && m[2] ? m[2] : 'ko');
      setBoard(m ? +m[1] - 1 : 0);
      document.documentElement.setAttribute('data-ready', '1');
    };
    addEventListener('resize', function () { scaleStage(); relayAll(); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(go0); else go0();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
