/* 링구아 고등 내신 덱 — 「PDF로 저장」 · 인쇄 모드(외부 스크립트 0)
   강의본 3판(window.DECK3 · __deck3)과 강사본(window.DECK · __deck) 어느 덱에 붙여도 돈다 — 템플릿에 <script src="../assets/print.js"></script> 한 줄.
   글꼴 · 틀 = 덱이 이미 실은 것 그대로, 인쇄 꼴 = 같은 폴더 print.css(이 파일이 붙인다).

   들어가는 길 셋: 바닥 「PDF로 저장」 단추 · 브라우저 인쇄(Ctrl+P) · 주소 끝 ?print=1(사이트 단추가 쓰는 주소).
   인쇄 모드 = 클릭 단계를 다 드러낸 끝 상태를 쪽마다 한 장씩(A4 가로):
     3판   판 하나 = 한 쪽. 그 판의 표시 층을 다 켜고 오른쪽 칸은 해석 · 구조도 둘 다(위 · 아래).
           칩을 눌러 띄우는 자세히 카드는 넣지 않는다(지문 위 칩 · 틀린 꼴 · 뜻은 그대로 있다).
     강사본 화면 하나 = 한 쪽. 화면마다 끝 단계(읽기 화면은 해석 모두).
   쪽 머리 = 지문 id · 판(화면) 이름 · 쪽 번호. 움직임은 끈 채 끝 상태 · 배경색 그대로(print-color-adjust).
   글이 넘치면 글자를 줄여 맞추고, 하한에서도 넘치면 3판은 구조도를 다음 쪽(이어서)으로 보낸다.
   ?print=1 이면 열자마자 인쇄 창(window.print → 브라우저 「PDF로 저장」)을 띄운다. 인쇄 창을 닫아도 미리보기에 머물고,
   막대의 「수업 화면으로」 또는 Esc 로 돌아간다(단추 · Ctrl+P 로 들어왔으면 판 · 단계 그대로).
   afterprint 에서 바로 걷지 않는 까닭: 브라우저에 따라 인쇄 미리보기를 다시 그릴 때(설정 바꿈) 쪽이 이미 걷혀 있으면 빈 PDF 가 된다.
   검사 손잡이 = window.__print(build/qa_print.py). */
(function () {
  'use strict';
  var KIND = window.DECK3 ? '3pan' : (window.DECK ? 'deck' : '');
  if (!KIND) return;
  var ME = document.currentScript;
  var BASE = ME && ME.src ? ME.src.replace(/[^\/]*$/, '') : '../assets/';
  var CW = 1600, CH = 1131;                          // 쪽 캔버스 = 무대 폭 1600 · A4 가로 비(297 : 210)
  var MAX_PS = 297 / 25.4 * 96 / CW;                 // 화면 미리보기 최대 배율 = 실제 A4 폭(96dpi)
  var TXT = { save: 'PDF로 저장', back: '수업 화면으로', ko: '해석', map: '구조도', more: '이어서' };
  var AUTO = /(?:^|[?&])print=1(?:&|$)/.test(location.search);
  var DECK_KEYS = /^(Arrow(Left|Right|Up|Down)|PageUp|PageDown|Home|End|Enter|Backspace| |[1-9hHpPtTfF])$/;
  var st = { on: false, how: '', root: null, fits: [], settled: null };

  /* ------------------------------------------------------------ 작은 도구 */
  function h(tag, attrs) {
    var el = document.createElement(tag), i, k;
    attrs = attrs || {};
    for (k in attrs) {
      if (!Object.prototype.hasOwnProperty.call(attrs, k) || attrs[k] == null || attrs[k] === false) continue;
      if (k === 'class') el.className = attrs[k]; else el.setAttribute(k, attrs[k]);
    }
    for (i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  }
  function add(el, kid) {
    if (kid == null || kid === false) return;
    if (Array.isArray(kid)) { kid.forEach(function (x) { add(el, x); }); return; }
    el.appendChild(typeof kid === 'string' || typeof kid === 'number' ? document.createTextNode(String(kid)) : kid);
  }
  function each(sel, fn, root) { Array.prototype.forEach.call((root || document).querySelectorAll(sel), fn); }
  function text(sel) { var el = document.querySelector(sel); return el ? el.textContent.trim() : ''; }
  function icon() {
    var ns = 'http://www.w3.org/2000/svg', s = document.createElementNS(ns, 'svg'), p = document.createElementNS(ns, 'path');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true');
    p.setAttribute('d', 'M12 4v10.5m-4.5-4.5 4.5 4.5 4.5-4.5M5 19.5h14'); s.appendChild(p); return s;
  }
  function waitFor(test) {
    return new Promise(function (r) { (function t() { if (test()) r(); else setTimeout(t, 40); })(); });
  }

  /* ------------------------------------------------------------ 쪽 한 장(머리 + 몸) */
  function sheet(root, o) {
    var title = KIND === '3pan'
      ? [text('#htitle .ty') ? h('span', { class: 'ty' }, text('#htitle .ty')) : null, h('span', { class: 'tt' }, text('#htitle .tt'))]
      : [h('span', { class: 'tt' }, o.title)];
    var head = h('header', { class: 'pp-h' },
      h('img', { src: BASE + 'img/lingua_mark.png', alt: '' }),
      h('b', { class: 'pp-brand' }, text('#hdr .brand b')), h('span', { class: 'pp-kind' }, text('#hdr .brand span')),
      h('span', { class: 'pp-chip' }, text('#hdr .pchip')), h('span', { class: 'pp-id' }, (window.DECK3 || window.DECK).meta.id),
      h('span', { class: 'pp-title' }, title),
      h('span', { class: 'pp-board' }, o.name), h('span', { class: 'pp-no' }));
    var body = h('div', { class: 'pp-body' }, o.wm === false ? null : h('img', { class: 'pp-wm', src: BASE + 'img/watermark.png', alt: '' }));
    var page = h('section', { class: 'pp', 'data-kind': o.kind || '', 'aria-label': o.name }, h('div', { class: 'pp-in' }, head, body));
    root.appendChild(page);
    return { page: page, body: body };
  }
  function stripIds(el) {
    el.removeAttribute('id');
    each('[id]', function (x) { x.removeAttribute('id'); }, el);
    each('[tabindex]', function (x) { x.setAttribute('tabindex', '-1'); }, el);
  }

  /* ------------------------------------------------------------ 3판: 판 하나 = 한 쪽 */
  var OFF = { L1: '.ttab,.ktab,.clab,.chead .cnt.k1', L2: '.glab,.vgl,.chead .cnt.k2', L3: '.rnb' };
  function prep3(c) {
    stripIds(c);
    c.removeAttribute('style');
    c.classList.remove('nofx');
    c.classList.add('pp-b3');
    each('.pop', function (x) { x.remove(); }, c);
    each('.open,.hov,.scroll', function (x) { x.classList.remove('open', 'hov', 'scroll'); }, c);
    each('[role="button"]', function (x) { x.removeAttribute('role'); }, c);
    Object.keys(OFF).forEach(function (L) {                       // 이 판에서 꺼진 층의 꼬리표는 빼 둔다(숨은 것이 쪽에 남지 않게)
      if (!c.classList.contains(L)) each(OFF[L], function (x) { x.remove(); }, c);
    });
    var side = c.querySelector('.rcol .chead .side'); if (side) side.remove();
    var lb = c.querySelector('.rcol .chead .lb'); if (lb) lb.textContent = TXT.ko;
    each('.pnl', function (p) { p.classList.add('cur'); }, c);
    var map = c.querySelector('.pnl.map');
    if (map) map.insertBefore(h('div', { class: 'pp-lab' }, TXT.map), map.firstChild);
  }
  function build3(root) {
    var api = window.__deck3, D = window.DECK3, keep = api.state(), src = document.querySelector('#stage .b3');
    D.boards.forEach(function (b, i) {
      api.go(i, 'ko');
      var c = src.cloneNode(true);
      prep3(c);
      var pg = sheet(root, { name: b.full, kind: b.key });
      pg.body.appendChild(c);
      fit3(root, pg, c, b);
    });
    api.go(keep.b, keep.side);
  }
  function fit3(root, pg, c, b) {
    if (fit3once(c) < 0) {                                         // 하한에서도 넘침 → 구조도는 다음 쪽(이어서)
      var more = sheet(root, { name: b.full + ' · ' + TXT.more, kind: b.key + '-more' });
      c._more = h('div', { class: 'pp-more' }, c.querySelector('.pnl.map'));
      more.body.appendChild(c._more);
      fit3once(c);
    }
    st.fits.push(function () { fit3once(c); });
  }
  function fit3once(c) {
    var pt = c.querySelector('.ptext'), box = c.querySelector('.pbox');
    var fs = fitVars(c, [pt], { '--fs': 34 }, 17);
    var ko = fitVars(c, [box], c._more ? { '--ko': 22 } : { '--ko': 22, '--mf': 21 }, 14);
    if (c._more) fitVars(c._more, [c._more], { '--mf': 26 }, 14);
    c.setAttribute('data-pfit', [fs, ko].join(' '));
    relay(c, '.glab,.clab,.rnb');
    relay(c, '.vgl');
    return ko;
  }
  /* 상자가 넘치지 않을 때까지 글자 크기(변수)를 0.5px 씩 줄이고, 맞으면 한 칸(SAFE) 더 줄인다.
     더 줄이는 까닭: 줄바꿈은 글자 폭을 재는 조건(화면 배율 · 인쇄)에 따라 조금 달라진다 — 화면에서 꼭 맞던 글이 인쇄에서 한 줄 넘칠 수 있다.
     → 맞춘 첫 변수 값 · 하한에서도 넘치면 -1 */
  var SAFE = 1;
  function overflowing(boxes) {
    return boxes.some(function (b) { return b.scrollHeight > b.clientHeight + 1 || b.scrollWidth > b.clientWidth + 1; });
  }
  function fitVars(scope, boxes, start, min) {
    var names = Object.keys(start);
    function set(d) { names.forEach(function (n) { scope.style.setProperty(n, (start[n] - d) + 'px'); }); }
    for (var d = 0; ; d += 0.5) {
      set(d);
      if (!overflowing(boxes)) {
        var room = Math.min.apply(null, names.map(function (n) { return start[n] - min; }));
        var safe = Math.max(d, Math.min(d + SAFE, room));
        set(safe);
        return start[names[0]] - safe;
      }
      if (names.some(function (n) { return start[n] - d <= min; })) return -1;
    }
  }
  /* 꼬리표 겹침 풀기 — deck3.js relay 와 같은 규칙(같은 줄에서 앞 꼬리표와 겹치면 오른쪽으로 민다 · 글 자리는 그대로) */
  function relay(c, sel) {
    var pt = c.querySelector('.ptext'); if (!pt) return;
    var sc = c.getBoundingClientRect().width / (c.offsetWidth || 1) || 1, items = [], lines = [];
    each(sel, function (el) { el.style.marginLeft = ''; }, c);
    each(sel, function (el) {
      if (!el.offsetParent || getComputedStyle(el).display === 'none') return;
      var pr = el.offsetParent.getBoundingClientRect(), w = el.offsetWidth;
      items.push({ el: el, top: Math.round(pr.top / sc), left: pr.left / sc + el.offsetLeft - (el.classList.contains('vgl') ? w / 2 : 0), w: w });
    }, c);
    var tol = parseFloat(getComputedStyle(pt).fontSize) * 0.6;
    items.sort(function (a, b) { return a.top - b.top; }).forEach(function (x) {
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

  /* ------------------------------------------------------------ 강사본: 화면 하나 = 한 쪽(끝 단계) */
  /* 찍을 단계: 보통은 끝 단계 하나. 해설 화면은 구획(근거 · 풀이 · 오답 …)이 한 칸을 번갈아 쓰므로 구획마다 그 구획의 끝 단계(= 다음 쪽) */
  function shotSteps(api, i, s) {
    if (s.kind !== 'ex') return [s.steps];
    var out = [], last = null;
    for (var t = 0; t <= s.steps; t++) {
      api.go(i, t);
      var cur = document.querySelector('#view > section.slide .xsec.cur'), si = cur ? cur.getAttribute('data-si') : '';
      if (last !== null && si !== last.si) out.push(last.t);
      last = { si: si, t: t };
    }
    out.push(last.t);
    return out;
  }
  function shotDeck(api, i, s, t) {
    var c;
    api.instantly(function () {                                    // 시차 움직임(wait)을 기다리지 않고 그 단계의 끝 모습을 바로
      api.go(i, t);
      var flip = s.kind === 'read' && !api.state().koAll;
      if (flip) api.toggleKo();                                    // 읽기 화면 = 해석 모두
      c = document.querySelector('#view > section.slide').cloneNode(true);
      if (flip) api.toggleKo();
    });
    stripIds(c);
    c.classList.remove('enter', 'back');
    each('.xsec:not(.cur)', function (x) { x.remove(); }, c);      // 다른 구획은 제 쪽에 따로 찍힌다
    return c;
  }
  function buildDeck(root) {
    var api = window.__deck, keep = api.state();
    api.slides.forEach(function (s, i) {
      var ts = api.instantly(function () { return shotSteps(api, i, s); });
      ts.forEach(function (t, k) {
        var c = shotDeck(api, i, s, t), name = s.title + (ts.length > 1 ? ' · ' + (k + 1) + '/' + ts.length : '');
        var pg = sheet(root, { name: name, title: s.title, kind: s.kind, wm: s.kind !== 'cover' });
        pg.page.setAttribute('data-slide', String(i));
        pg.page.setAttribute('data-step', t + '/' + s.steps);
        pg.body.appendChild(h('div', { class: 'pp-view' }, c));
        refitDeck(c);
        st.fits.push(function () { refitDeck(c); });
      });
    });
    api.go(keep.cur, keep.step);
  }
  /* 강사본 쪽 다시 맞추기 — 덱이 무대에서 잰 글자 크기(화면의 --fs 등)를 쪽 안에서 다시 잰다(fitVars 와 같은 규칙 · 여유 한 칸) */
  var DECK_BOXES = '.fit,.pass,.left,.panel,.side,.note,.box,.opt,.explain,.ansbox,.cols,.gistband,.lane,.tagbar,.srans,.sumwrap,.wtable,.crows,.tflist';
  var DECK_MIN = 13;
  function refitDeck(c) {
    var start = c._fit0 || {}, i, n;
    for (i = 0; !c._fit0 && i < c.style.length; i++) {               // 처음 값(덱이 무대에서 잰 것)은 한 번만 읽어 둔다
      n = c.style[i];
      if (n.indexOf('--') === 0 && /px$/.test(c.style.getPropertyValue(n).trim())) start[n] = parseFloat(c.style.getPropertyValue(n));
    }
    c._fit0 = start;
    var boxes = Array.prototype.slice.call(c.querySelectorAll(DECK_BOXES));
    if (!Object.keys(start).length) { c.setAttribute('data-pfit', overflowing(boxes) ? '-1' : 'fixed'); return; }
    c.setAttribute('data-pfit', String(fitVars(c, boxes, start, DECK_MIN)));
  }

  /* ------------------------------------------------------------ 들어가기 · 나가기 */
  function scaleSheets() {
    var ps = Math.min(MAX_PS, (innerWidth - 32) / CW);
    document.documentElement.style.setProperty('--ps', String(Math.max(0.1, ps)));
  }
  function bar() {
    var save = h('button', { type: 'button', class: 'pm-btn pri' }, icon(), TXT.save);
    var back = h('button', { type: 'button', class: 'pm-btn' }, TXT.back);
    save.onclick = function () { printNow(); };
    back.onclick = function () { leave(true); };
    return h('div', { class: 'pm-bar' }, h('img', { src: BASE + 'img/lingua_mark.png', alt: '' }),
      h('span', { class: 'pm-info' }, text('#hdr .pchip') + ' · ' + (window.DECK3 || window.DECK).meta.id), save, back);
  }
  function enter(how) {
    st.on = true; st.how = how; st.fits = [];
    scaleSheets();
    document.documentElement.classList.add('pm');
    st.root = h('div', { class: 'pm-pages', 'data-kind': KIND });
    document.body.appendChild(st.root);
    st.root.appendChild(bar());
    quietHistory(function () { if (KIND === '3pan') build3(st.root); else buildDeck(st.root); });
    var pages = st.root.querySelectorAll('.pp');
    Array.prototype.forEach.call(pages, function (p, i) { p.querySelector('.pp-no').textContent = (i + 1) + ' / ' + pages.length; });
    st.settled = settle(st.root).catch(function (e) {             // 다시 맞추기가 깨져도 인쇄는 한다(지을 때 맞춘 크기로) — 까닭은 속성에 남김
      document.documentElement.setAttribute('data-print-error', String(e && e.message || e));
    }).then(function () { document.documentElement.setAttribute('data-print-ready', String(pages.length)); });
  }
  /* 쪽을 짓는 동안 덱이 판 · 단계마다 부르는 history.replaceState 를 잠시 멈춘다
     (강사본은 수십~백 번 — Chrome 이 짧은 사이 많은 호출을 버려서 끝의 되돌리기 주소까지 잃을 수 있다) */
  function quietHistory(fn) {
    var rs = history.replaceState;
    history.replaceState = function () { /* 짓는 동안 주소는 그대로 */ };
    try { fn(); } finally { history.replaceState = rs; }
  }
  /* 글꼴 · 그림이 다 실리고 두 프레임 뒤에 한 번 더 맞춘다(지을 때 잰 줄바꿈이 그 뒤에 바뀌는 일이 있었다 · 10-20 실측) */
  function frame() { return new Promise(function (r) { requestAnimationFrame(function () { r(); }); }); }
  function settle(root) {
    var fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    return Promise.all([fonts, imagesReady(root)]).then(frame).then(frame).then(function () {
      if (st.root === root) st.fits.forEach(function (f) { f(); });
    });
  }
  function leave(byUser) {
    if (!st.on) return;
    if (st.how === 'auto' && byUser) {
      var u = new URL(location.href);
      u.searchParams.delete('print');
      location.replace(u.href);
      return;
    }
    st.root.remove();
    st.root = null; st.on = false; st.how = '';
    document.documentElement.classList.remove('pm');
    document.documentElement.removeAttribute('data-print-ready');
    var b = document.getElementById('bPdf'); if (b) b.focus();
  }
  function imagesReady(root) {
    return Promise.all(Array.prototype.map.call(root.querySelectorAll('img'), function (im) {
      return im.complete ? 1 : new Promise(function (r) { im.addEventListener('load', r); im.addEventListener('error', r); });
    }));
  }
  function printNow() {
    st.settled.then(frame).then(function () { if (st.on) window.print(); });
  }
  function start(how) {
    if (!st.on) enter(how);
    printNow();
  }

  /* ------------------------------------------------------------ 단추 · 키 · 인쇄 사건 */
  function addButton() {
    var nav = document.getElementById('nav');
    if (!nav || document.getElementById('bPdf')) return;
    var b = h('button', { class: 'pdfbtn', id: 'bPdf', type: 'button', title: TXT.save + ' — A4 가로 · 판마다 한 쪽' }, icon(), h('span', null, TXT.save));
    b.addEventListener('click', function (e) { e.stopPropagation(); start('button'); });
    b.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') e.stopPropagation(); });
    nav.parentNode.insertBefore(b, nav);
  }
  addEventListener('keydown', function (e) {                       // 인쇄 모드에서는 덱 넘김 키를 막는다(뒤 화면이 움직이지 않게)
    if (!st.on || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Escape') { e.stopImmediatePropagation(); leave(true); return; }
    if (DECK_KEYS.test(e.key)) e.stopImmediatePropagation();     // 막대 단추의 Enter · Space 는 기본 동작(누름)으로 그대로 돈다
  }, true);
  addEventListener('beforeprint', function () { if (!st.on) enter('ctrlp'); });
  addEventListener('resize', function () { if (st.on) scaleSheets(); });

  /* 검사 손잡이 — 쪽 수 · 판 수 · 숨은 것 · 꼬리표 겹침 · 넘침 */
  function shown(el, stop) {
    for (var n = el; n && n !== stop; n = n.parentElement) {
      var cs = getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility !== 'visible' || +cs.opacity < 0.05) return false;   // 일부러 옅게 한 글(.85)은 보이는 것
    }
    return true;
  }
  function check() {
    var out = { kind: KIND, pages: 0, units: 0, hidden: [], collide: [], overflow: [], perPage: [],
      error: document.documentElement.getAttribute('data-print-error') };
    if (!st.on) return out;
    var pages = st.root.querySelectorAll('.pp');
    out.pages = pages.length;
    out.units = KIND === '3pan' ? window.DECK3.boards.length : window.__deck.slides.length;
    Array.prototype.forEach.call(pages, function (p, i) {
      var info = { no: i + 1, kind: p.getAttribute('data-kind'), fit: '', step: '' };
      each('*', function (n) {
        var own = Array.prototype.some.call(n.childNodes, function (x) { return x.nodeType === 3 && x.nodeValue.trim(); });
        if (own && !shown(n, p)) out.hidden.push({ page: i + 1, cls: String(n.className), text: n.textContent.slice(0, 30) });
      }, p);
      var c = p.querySelector('.pp-b3'), f = p.querySelector('[data-pfit]');
      if (c) info.layers = ['L1', 'L2', 'L3'].filter(function (L) { return c.classList.contains(L); });
      if (f) info.fit = f.getAttribute('data-pfit');
      if (p.hasAttribute('data-slide')) { info.slide = +p.getAttribute('data-slide'); info.step = p.getAttribute('data-step'); }
      if (info.fit.split(' ').indexOf('-1') >= 0) out.overflow.push({ page: i + 1, fit: info.fit });
      each(KIND === '3pan' ? '.ptext,.pbox,.pp-more' : DECK_BOXES, function (b) {
        if (overflowing([b])) out.overflow.push({ page: i + 1, what: 'box', cls: String(b.className), sh: b.scrollHeight, ch: b.clientHeight });
      }, p);
      var pr = p.getBoundingClientRect();
      each('.pp-in *', function (n) {
        var r = n.getBoundingClientRect();
        if (r.width && r.height && n.firstChild && (r.right > pr.right + 1 || r.bottom > pr.bottom + 1 || r.left < pr.left - 1 || r.top < pr.top - 1))
          out.overflow.push({ page: i + 1, what: 'out-of-page', cls: String(n.className), text: (n.textContent || '').slice(0, 30) });
      }, p);
      if (c) out.collide = out.collide.concat(collisions(c).map(function (x) { return { page: i + 1, pair: x }; }));
      out.perPage.push(info);
    });
    out.overflow = out.overflow.slice(0, 30);
    return out;
  }
  function collisions(c) {
    var labs = [], out = [], lr = c.querySelector('.ptext').getBoundingClientRect();
    each('.glab,.vgl,.clab,.ttab,.rnb', function (el) { var r = el.getBoundingClientRect(); if (r.width && r.height) labs.push({ el: el, r: r }); }, c);
    function hit(a, b) { return a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1; }
    for (var i = 0; i < labs.length; i++) {
      for (var j = i + 1; j < labs.length; j++) if (hit(labs[i].r, labs[j].r)) out.push([labs[i].el.textContent, labs[j].el.textContent]);
      var r = labs[i].r;
      if (r.left < lr.left - 1 || r.right > lr.right + 1 || r.top < lr.top - 1 || r.bottom > lr.bottom + 1) out.push(['밖', labs[i].el.textContent]);
    }
    return out;
  }
  window.__print = { enter: function () { if (!st.on) enter('test'); return check().pages; }, leave: function () { leave(false); return st.on; }, check: check };

  /* ------------------------------------------------------------ 시작 */
  var css = h('link', { rel: 'stylesheet', href: BASE + 'print.css' });
  var cssReady = new Promise(function (r) { css.addEventListener('load', r); css.addEventListener('error', r); });
  document.head.appendChild(css);
  if (AUTO) document.documentElement.classList.add('pm-wait');
  Promise.all([cssReady, waitFor(function () { return document.documentElement.getAttribute('data-ready'); })]).then(function () {
    addButton();
    if (!AUTO) return;
    if (!st.on) enter('auto'); else st.how = 'auto';
    document.documentElement.classList.remove('pm-wait');
    printNow();
  });
})();
