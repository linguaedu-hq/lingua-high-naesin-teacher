/* 링구아 고등 내신 강사본 — 넘김 · 단계 · 움직임 엔진(외부 스크립트 0)
   데이터 = window.DECK(build/deck_model.py 가 원고에서 지음). 화면 = 1600×900 무대를 창에 맞춰 줄이고 늘린다.
   넘김: → · Space · PageDown · Enter · 화면 클릭 = 다음 / ← · PageUp · Backspace = 이전 / Home · End
   H = 해석 모두 · P = 문장별 ↔ 이어진 판 · F = 전체 화면. 주소 끝 #화면.단계 로 바로 간다(예: #5.2). */
(function () {
  'use strict';
  var D = window.DECK;
  var W = 1600, H = 900;
  var RM = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------------------ 작은 도구 */
  function h(tag, attrs) {
    var el = document.createElement(tag), i, k;
    attrs = attrs || {};
    for (k in attrs) {
      if (!Object.prototype.hasOwnProperty.call(attrs, k) || attrs[k] == null || attrs[k] === false) continue;
      if (k === 'class') el.className = attrs[k];
      else if (k === 'text') el.textContent = attrs[k];
      else if (k === 'style') el.setAttribute('style', attrs[k]);
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
    arrow: 'M4 12h15m-6-6 6 6-6 6',
    star: 'M12 2.8l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 16.8l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z',
    tap: 'M9 11V5.5a1.5 1.5 0 0 1 3 0V11m0-1.5a1.5 1.5 0 0 1 3 0V11m0-1a1.5 1.5 0 0 1 3 0v4.5a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-2.7L3.6 14a1.5 1.5 0 0 1 2.4-1.8L9 15'
  };
  function star() { var s = svg(ICON.star, 'ico-star'); s.setAttribute('aria-label', '가장 중요'); return s; }
  function param(name) { var m = new RegExp('[?&]' + name + '=([^&#]+)').exec(location.search); return m ? decodeURIComponent(m[1]) : null; }
  function numChip(n) { return h('span', { class: 'n-chip', 'aria-label': '문장 ' + n }, String(n)); }
  function wait(fn, ms) { return setTimeout(fn, RM ? 0 : ms); }

  /* runs([{t,c,id,lab}]) → 조각 노드 */
  function runs(list, opts) {
    opts = opts || {};
    return list.map(function (r) {
      if (!r.c && !r.lab) return document.createTextNode(r.t);
      var cls = r.c || '';
      if (r.c === 'gr' || r.c === 'voc') {
        var el = h('span', { class: cls, 'data-id': r.id }, r.t);
        if (r.c === 'gr') {
          var g = D.marks.grammar[+r.id.slice(1)];
          el.appendChild(h('span', { class: 'tab gr', 'aria-hidden': 'true' }, g ? g.chip : ''));
        }
        return el;
      }
      var frag = document.createDocumentFragment();
      if (r.lab) frag.appendChild(h('span', { class: 'lab' }, r.lab));
      if (r.c === 'blank') frag.appendChild(h('span', { class: 'blank', 'aria-label': '빈칸' }));
      else frag.appendChild(h('span', { class: cls, 'data-lab': r.lab || null }, r.t));
      return frag;
    });
  }

  /* 글자 크기 맞추기: box 가 넘치지 않을 때까지 --var 를 줄인다 */
  function fit(scope, box, name, max, min, also) {
    var v = max;
    for (; v >= min; v -= 0.5) {
      scope.style.setProperty(name, v + 'px');
      if (also) also(v);
      if (box.scrollHeight <= box.clientHeight + 1) break;
    }
    scope.setAttribute('data-fit', v < min ? 'overflow' : String(v));
    return v;
  }

  /* 근거 문구를 글 노드에서 찾아 형광펜으로 감싼다(여러 조각에 걸쳐도) */
  function normQ(s) { return s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"'); }
  function wrapQuote(root, quote, cls) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), nodes = [], text = '', n;
    while ((n = walker.nextNode())) { nodes.push({ n: n, a: text.length }); text += n.nodeValue; }
    var at = normQ(text).toLowerCase().indexOf(normQ(quote).toLowerCase());
    if (at < 0) return false;
    var end = at + quote.length;
    nodes.forEach(function (o) {
      var a = Math.max(at, o.a), b = Math.min(end, o.a + o.n.nodeValue.length);
      if (a >= b) return;
      var r = document.createRange();
      r.setStart(o.n, a - o.a); r.setEnd(o.n, b - o.a);
      var span = h('span', { class: cls });
      r.surroundContents(span);
    });
    return true;
  }

  /* ------------------------------------------------------------ 화면 목록 */
  var M = D.meta, S = [];
  var GROUPS = [];
  function slide(kind, title, group, extra) { var s = { kind: kind, title: title, group: group }; for (var k in extra || {}) s[k] = extra[k]; S.push(s); }
  var WP = D.word_pages || [], CP = D.chunk_pages || [];
  slide('cover', '표지', '표지');
  WP.forEach(function (pg, i) { slide('words', '단어 정리' + (WP.length > 1 ? ' ' + (i + 1) + ' / ' + WP.length : ''), '단어', { rows: pg }); });
  slide('read', '읽기 · 해석', '읽기');
  CP.forEach(function (pg, i) { slide('chunk', '끊어 읽기' + (CP.length > 1 ? ' ' + (i + 1) + ' / ' + CP.length : ''), '읽기', { ns: pg }); });
  slide('marks', '주제문 · 어휘 · 어법', '강조');
  if (D.flow && D.flow.boxes.length) slide('flow', '글의 구조', '구조');
  if (D.tf && D.tf.length) slide('tf', 'T / F 확인', '확인');
  if (D.summary) slide('summary', '요약문 빈칸', '확인');
  D.variants.forEach(function (v, i) { slide('var', '변형 ' + (i + 1) + ' · ' + v.name, '변형', { v: v, idx: i + 1 }); });
  (D.sr || []).forEach(function (q, i) { slide('sr', '서술형 대비 ' + (i + 1) + ' · ' + q.name, '서술형', { q: q, idx: i + 1 }); });
  slide('sum', '정리', '정리');
  S.forEach(function (s, i) { if (!GROUPS.length || GROUPS[GROUPS.length - 1].name !== s.group) GROUPS.push({ name: s.group, first: i }); });

  var state = { flow: (param('flow') || D.flow_default || 'sent'), koAll: false, cur: -1, step: 0, el: null };
  if (D.kind === 'notice') state.flow = 'sent';

  function markSteps() { return (D.marks.topic ? 1 : 0) + (D.marks.vocab.length ? 1 : 0) + D.marks.grammar.length; }
  function steps(s) {
    switch (s.kind) {
      case 'read': return D.sents.length;
      case 'words': return 1;
      case 'chunk': return s.ns.length;
      case 'tf': return D.tf.length;
      case 'summary': return D.summary.key ? 2 : 1;
      case 'sr': return 1;
      case 'marks': return markSteps();
      case 'flow': return D.flow.boxes.length + 1;
      case 'var': return 2;
      default: return 0;
    }
  }
  function nextLabel(s, st) {
    var n = steps(s);
    if (st >= n) return '다음 화면';
    if (s.kind === 'var' || s.kind === 'summary') return st === 0 ? '정답 보기' : '해설 보기';
    if (s.kind === 'read' || s.kind === 'chunk') return st === 0 ? '첫 문장' : '다음 문장';
    if (s.kind === 'words') return '뜻 보기';
    if (s.kind === 'tf') return '다음 정답';
    if (s.kind === 'sr') return '모범 답 보기';
    return '다음 단계';
  }

  /* ------------------------------------------------------------ 그리기(화면 종류별) */
  var R = {}, A = {};

  R.cover = function () {
    var el = h('section', { class: 'slide cover' });
    var meta = [];
    if (M.words) meta.push(h('span', null, M.words + ' words'));
    meta.push(h('span', null, D.sents.length + (D.kind === 'notice' ? '줄' : '문장')));
    if (M.wrong_rate) meta.push(h('span', { class: 'hot' }, '원 문항 오답률 ' + M.wrong_rate));
    el.appendChild(h('div', { class: 'row' },
      h('div', { class: 'tt' },
        h('div', { class: 'num rise' }, String(M.item_no), h('small', null, '번')),
        h('div', { class: 'type rise', style: 'animation-delay:80ms' }, M.orig_type || ''),
        h('h1', { class: 'rise', style: 'animation-delay:140ms' }, M.title_ko || ''),
        M.title_en ? h('div', { class: 'en rise', style: 'animation-delay:200ms' }, M.title_en) : null,
        M.topic_ko ? h('div', { class: 'topic rise', style: 'animation-delay:280ms' }, h('b', null, '주제'), h('span', null, M.topic_ko)) : null,
        h('div', { class: 'meta rise', style: 'animation-delay:340ms' }, meta)),
      h('img', { class: 'lockup rise', style: 'animation-delay:200ms', src: '../assets/img/lingua_logo.png', alt: '링구아' })));
    if (M.exam) el.appendChild(h('div', { class: 'exam' }, M.exam));
    return el;
  };

  function sentText(s, i) {
    var tx = h('span', { class: 'tx' });
    if (D.marks.topic === s.n) tx.appendChild(h('span', { class: 'tab tp' }, '주제'));
    tx.appendChild(h('span', { class: 'ink', 'data-n': s.n }, s.en));
    return tx;
  }
  R.read = function () {
    var el = h('section', { class: 'slide read' });
    var fitbox = h('div', { class: 'fit' });
    if (state.flow === 'para' && D.kind !== 'notice') {
      var pt = h('div', { class: 'ptext' }), kl = h('div', { class: 'kolist' });
      D.sents.forEach(function (s, i) {
        var sp = h('span', { class: 's stag', style: '--i:' + i, 'data-n': s.n }, numChip(s.n));
        if (D.marks.topic === s.n) sp.appendChild(h('span', { class: 'tab tp' }, '주제'));
        sp.appendChild(h('span', { class: 'ink', 'data-n': s.n }, s.en));
        add(pt, [sp, ' ']);
        kl.appendChild(h('div', { 'data-n': s.n }, h('span', { class: 'kn' }, String(s.n)), s.ko));
      });
      fitbox.appendChild(h('div', { class: 'para' }, pt, kl));
    } else {
      var g = h('div', { class: 'grid' });
      D.sents.forEach(function (s, i) {
        var en = h('div', { class: 'en stag' + (s.line === 'title' ? ' title' : s.line === 'head' ? ' head' : ''), style: '--i:' + i }, numChip(s.n), sentText(s, i));
        g.appendChild(h('div', { class: 'srow', 'data-n': s.n }, en, h('div', { class: 'ko' }, h('span', { class: 'kn' }, String(s.n)), s.ko)));
      });
      fitbox.appendChild(g);
    }
    el.appendChild(h('div', { class: 'colhead' },
      h('span', { class: 'chl' }, h('i', null, state.flow === 'para' && D.kind !== 'notice' ? '이어진 판' : '문장별 판'), h('span', { class: 'tagbar inline' }, h('b', null, '구문'), h('span', { class: 'tags' }))),
      h('span', null, '해석')));
    el.appendChild(fitbox);
    Array.prototype.forEach.call(fitbox.querySelectorAll('.ink'), function (k) { wrapTags(k, +k.getAttribute('data-n')); });
    el._fit = function () { fit(el, fitbox, '--fs', 31, 17, function (v) { el.style.setProperty('--ko', Math.max(16, Math.round(v * 0.72 * 2) / 2) + 'px'); }); };
    return el;
  };
  A.read = function (s, st, prev, el) {
    var rows = el.querySelectorAll('[data-n].srow, .kolist [data-n]');
    Array.prototype.forEach.call(rows, function (r) {
      var n = +r.getAttribute('data-n');
      var on = state.koAll || n <= st;
      r.classList.toggle('ko-on', on);
      r.classList.toggle('cur', n === st);
      r.classList.toggle('past', n < st && !state.koAll);
    });
    Array.prototype.forEach.call(el.querySelectorAll('.ink'), function (k) { k.classList.toggle('on', +k.getAttribute('data-n') === st); });
    Array.prototype.forEach.call(el.querySelectorAll('.stx'), function (k) { k.classList.toggle('on', +k.getAttribute('data-n') === st); });
    fillTagBar(el, st);
  };

  /* 구문 꼬리표(syntax_tags) — 현재 문장의 꼬리표 자리에 점선 + 아래 띠에 이름 */
  function tagsOf(n) { return ((D.syntax || {})[String(n)] || []).slice(0, 3); }
  function wrapTags(node, n) {
    tagsOf(n).forEach(function (t) { wrapQuote(node, t.at.replace(/[\s.,]+$/, ''), 'stx'); });
    Array.prototype.forEach.call(node.querySelectorAll('.stx'), function (x) { x.setAttribute('data-n', n); });
  }
  function tagBar() { return h('div', { class: 'tagbar' }, h('b', null, '구문'), h('div', { class: 'tags' })); }
  function fillTagBar(el, n) {
    var box = el.querySelector('.tagbar .tags'); if (!box) return;
    box.innerHTML = '';
    var tags = n ? tagsOf(n) : [];
    if (!tags.length) { box.appendChild(h('span', { class: 'none' }, n ? '문장 ' + n : '')); return; }
    box.appendChild(h('span', { class: 'sn' }, '문장 ' + n));
    tags.forEach(function (t) { box.appendChild(h('span', { class: 'tg' + (t.f === 'gr' ? '' : ' fl') }, t.t)); });
  }

  function markText(container) {
    if (state.flow === 'para' && D.kind !== 'notice') {
      var pt = h('div', { class: 'ptext' });
      D.sents.forEach(function (s, i) {
        var tb = h('span', { class: 'topicbox' + (D.marks.topic === s.n ? ' is-topic' : ''), 'data-n': s.n });
        if (D.marks.topic === s.n) tb.appendChild(h('span', { class: 'tab tp' }, '주제'));
        add(tb, runs(D.marks.runs[i]));
        add(pt, [numChip(s.n), tb, ' ']);
      });
      container.appendChild(pt);
    } else {
      var rows = h('div', { class: 'rows' });
      D.sents.forEach(function (s, i) {
        var tb = h('span', { class: 'topicbox' + (D.marks.topic === s.n ? ' is-topic' : ''), 'data-n': s.n });
        if (D.marks.topic === s.n) tb.appendChild(h('span', { class: 'tab tp' }, '주제'));
        add(tb, runs(D.marks.runs[i]));
        rows.appendChild(h('div', { class: 'r' + (s.line === 'title' ? ' title' : '') }, numChip(s.n), h('span', { class: 'tx' }, tb)));
      });
      container.appendChild(rows);
    }
  }
  function markPlan() {
    var plan = [];
    if (D.marks.topic) plan.push({ k: 'topic' });
    if (D.marks.vocab.length) plan.push({ k: 'vocab' });
    D.marks.grammar.forEach(function (g, i) { plan.push({ k: 'gr', i: i }); });
    return plan;
  }
  R.marks = function () {
    var el = h('section', { class: 'slide marks' });
    var left = h('div', { class: 'left' }), panel = h('div', { class: 'panel' });
    markText(left);
    el.appendChild(h('div', { class: 'mk' }, left, panel));
    el._fit = function () { el.classList.add('measure', 'nofx'); fit(el, left, '--fs', 30, 16); el.classList.remove('measure'); void el.offsetHeight; el.classList.remove('nofx'); };
    el._panel = panel;
    return el;
  };
  function note(plan, st) {
    var p = plan[st - 1], m = D.marks;
    if (!p) {
      return h('div', { class: 'note legend' },
        m.topic ? h('div', null, h('span', { class: 'sw tp' }, '주제'), '주제문', h('em', null, '문장 ' + m.topic)) : null,
        m.vocab.length ? h('div', null, h('span', { class: 'sw voc' }, 'word'), '핵심 어휘', h('em', null, m.vocab.length + '개')) : null,
        m.grammar.length ? h('div', null, h('span', { class: 'sw gr' }, 'gram'), '어법 포인트', h('em', null, m.grammar.length + '개')) : null);
    }
    if (p.k === 'topic') {
      return h('div', { class: 'note' },
        h('div', { class: 'nh' }, h('span', { class: 'chipx tp' }, '주제문'), h('i', null, '문장 ' + m.topic)),
        M.topic_ko ? h('div', { class: 'big' }, M.topic_ko) : null,
        m.gist && m.gist !== m.topic ? h('div', { class: 'sm' }, '요지 문장 = 문장 ' + m.gist) : null);
    }
    if (p.k === 'vocab') {
      var list = h('div', { class: 'vlist' });
      m.vocab.forEach(function (v, i) { list.appendChild(h('b', { style: '--i:' + i }, v.text)); list.appendChild(h('span', { style: '--i:' + i }, v.ko)); });
      return h('div', { class: 'note' }, h('div', { class: 'nh' }, h('span', { class: 'chipx voc' }, '핵심 어휘'), h('i', null, m.vocab.length + '개')), list);
    }
    var g = m.grammar[p.i];
    return h('div', { class: 'note' },
      h('div', { class: 'nh' }, h('span', { class: 'chipx gr' }, g.chip), h('i', null, '어법 ' + (p.i + 1) + ' / ' + m.grammar.length + ' · 문장 ' + g.sent)),
      h('div', { class: 'eng' }, g.text),
      h('div', { class: 'mid' }, g.rule),
      g.wrong && g.wrong.length ? h('div', { class: 'wrong' }, '틀린 꼴', g.wrong.map(function (w) { return h('s', null, w); })) : null,
      tagsOf(g.sent).length ? h('div', { class: 'stxnote' }, h('b', null, '문장 ' + g.sent + ' 구문'), tagsOf(g.sent).map(function (t) { return h('span', { class: 'tg' + (t.f === 'gr' ? '' : ' fl') }, t.t); })) : null);
  }
  A.marks = function (s, st, prev, el) {
    var plan = markPlan(), done = plan.slice(0, st);
    var has = function (k) { return done.some(function (p) { return p.k === k; }); };
    var tb = el.querySelector('.topicbox.is-topic');
    if (tb) {
      var on = has('topic');
      tb.classList.toggle('on', on);
    }
    var vocs = el.querySelectorAll('.voc');
    Array.prototype.forEach.call(vocs, function (v, i) {
      var on = has('vocab');
      if (on && !v.classList.contains('on') && st > prev) { wait(function () { v.classList.add('on'); }, i * 55); }
      else v.classList.toggle('on', on);
    });
    var grs = done.filter(function (p) { return p.k === 'gr'; }).map(function (p) { return 'g' + p.i; });
    var curp = plan[st - 1];
    Array.prototype.forEach.call(el.querySelectorAll('.gr'), function (g) {
      var id = g.getAttribute('data-id');
      g.classList.toggle('on', grs.indexOf(id) >= 0);
      g.classList.toggle('cur', !!curp && curp.k === 'gr' && 'g' + curp.i === id);
    });
    el._panel.innerHTML = '';
    el._panel.appendChild(note(plan, st));
  };

  R.flow = function () {
    var el = h('section', { class: 'slide flow' }), lane = h('div', { class: 'lane' });
    var F = D.flow;
    F.boxes.forEach(function (b, i) {
      if (i > 0) {
        var lk = h('div', { class: 'link', 'data-i': i });
        var sv = svg('M4 11h88m-12-8 12 8-12 8', null, '0 0 100 22');
        lk.appendChild(sv);
        if (F.arrows[i - 1]) lk.appendChild(h('i', null, F.arrows[i - 1]));
        lane.appendChild(lk);
      }
      lane.appendChild(h('div', { class: 'box' + (b.star ? ' star' : ''), 'data-i': i + 1 },
        h('div', { class: 'bh' }, h('span', { class: 'bn' }, String(i + 1)), h('span', { class: 'bl' }, b.label), b.star ? star() : null,
          h('span', { class: 'br' }, '문장 ' + b.sents[0] + (b.sents[1] !== b.sents[0] ? '~' + b.sents[1] : ''))),
        h('div', { class: 'bt' }, b.text)));
    });
    el.appendChild(lane);
    var bar = h('div', { class: 'bar' });
    D.sents.forEach(function (s) {
      var box = 0;
      F.boxes.forEach(function (b, i) { if (s.n >= b.sents[0] && s.n <= b.sents[1]) box = i + 1; });
      var star_ = box && F.boxes[box - 1].star;
      bar.appendChild(h('div', { class: 'rs' + (star_ ? ' star' : ''), 'data-box': box, style: 'flex:' + Math.max(1, s.en.length) }, String(s.n)));
    });
    el.appendChild(h('div', { class: 'ribbon' }, h('div', { class: 'rl' }, '문장'), bar));
    if (M.gist_ko) el.appendChild(h('div', { class: 'gistband' }, h('b', null, '요지'), h('span', null, M.gist_ko)));
    return el;
  };
  A.flow = function (s, st, prev, el) {
    Array.prototype.forEach.call(el.querySelectorAll('.box'), function (b) { b.classList.toggle('on', +b.getAttribute('data-i') <= st); });
    Array.prototype.forEach.call(el.querySelectorAll('.link'), function (l) { l.classList.toggle('on', +l.getAttribute('data-i') < st); });
    Array.prototype.forEach.call(el.querySelectorAll('.rs'), function (r) { var b = +r.getAttribute('data-box'); r.classList.toggle('on', b > 0 && b <= st); });
    var g = el.querySelector('.gistband'); if (g) g.classList.toggle('on', st > D.flow.boxes.length);
  };

  function stemNode(v) {
    var st = h('div', { class: 'stem' }), t = v.stem, parts = [];
    (v.stem_u || []).forEach(function (u) { var i = t.indexOf(u); if (i >= 0) parts.push([i, u]); });
    parts.sort(function (a, b) { return a[0] - b[0]; });
    var cur = 0;
    parts.forEach(function (p) { if (p[0] < cur) return; add(st, t.slice(cur, p[0])); st.appendChild(h('u', null, p[1])); cur = p[0] + p[1].length; });
    add(st, t.slice(cur));
    return st;
  }
  R.var = function (s) {
    var v = s.v, el = h('section', { class: 'slide var' });
    el.appendChild(h('div', { class: 'qh' }, h('span', { class: 'qtag' }, '변형 ' + s.idx, h('em', null, v.name + (v.difficulty ? ' · ' + v.difficulty : ''))), stemNode(v)));
    var pass = h('div', { class: 'pass' });
    v.passage.forEach(function (row) {
      if (row.gap) { pass.appendChild(h('span', { class: 'gap', 'data-lab': row.gap }, '( ' + row.gap + ' )')); add(pass, ' '); return; }
      var sp = h('span', { class: 'sent' + (row.extra ? ' extra' : ''), 'data-n': row.n || '', 'data-lab': row.lab || null });
      if (row.lab) sp.appendChild(h('span', { class: 'lab' }, row.lab + ' '));
      add(sp, runs(row.runs));
      if (D.kind === 'notice') { var ln = h('span', { class: 'line' + (row.line ? ' ' + row.line : '') }, sp); pass.appendChild(ln); }
      else add(pass, [sp, ' ']);
    });
    if (v.order) {
      pass.innerHTML = '';
      pass.appendChild(h('div', { class: 'given' }, v.order.given));
      v.order.pieces.forEach(function (pc) { pass.appendChild(h('div', { class: 'piece', 'data-lab': pc.lab }, h('b', null, pc.lab), h('span', null, pc.text))); });
    }
    if (v.given_text) pass.insertBefore(h('div', { class: 'given' }, v.given_text), pass.firstChild);
    var side = h('div', { class: 'side' });
    if (v.marks_are_choices) {
      side.appendChild(h('div', { class: 'ansbox' }, h('div', { class: 'ph' }, svg(ICON.tap, null), '정답은 다음 클릭에')));
    } else {
      var ol = h('ol', { class: 'opts' });
      v.choices.forEach(function (c, i) { ol.appendChild(h('li', { class: 'opt', 'data-k': i + 1 }, h('span', { class: 'ol' }, '①②③④⑤'[i]), h('span', null, c))); });
      side.appendChild(ol);
    }
    el.appendChild(h('div', { class: 'qb' + (v.marks_are_choices ? ' wide' : '') }, pass, side));
    el.appendChild(h('div', { class: 'exarea', style: 'flex:none;min-height:124px' }));
    el._fit = function () {
      fit(el, pass, '--fs', 25, 15);
      var o = side.querySelector('.opts');
      if (o) fit(side, side, '--optfs', 24, 15, function (x) { Array.prototype.forEach.call(o.children, function (li) { li.style.fontSize = x + 'px'; }); });
    };
    return el;
  };
  A.var = function (s, st, prev, el) {
    var v = s.v;
    /* 정답 · 해설 노드는 그 단계에서만 만든다 — 앞 단계 DOM 에는 정답 표시가 아예 없다 */
    Array.prototype.forEach.call(el.querySelectorAll('.opt'), function (o) {
      var k = +o.getAttribute('data-k');
      o.classList.toggle('is-answer', st >= 1 && k === v.answer);
      o.classList.toggle('not', st >= 1 && k !== v.answer);
    });
    var al = '①②③④⑤'[v.answer - 1];
    Array.prototype.forEach.call(el.querySelectorAll('.pass .u'), function (u) { u.classList.toggle('answer', st >= 1 && u.getAttribute('data-lab') === al); });
    if (v.code === 'VR-42') Array.prototype.forEach.call(el.querySelectorAll('.pass .gap'), function (g) { g.classList.toggle('is-answer', st >= 1 && g.getAttribute('data-lab') === al); });
    if (v.code === 'VR-43') Array.prototype.forEach.call(el.querySelectorAll('.pass .sent[data-lab]'), function (g) { g.classList.toggle('is-answer', st >= 1 && g.getAttribute('data-lab') === al); });
    var box = el.querySelector('.ansbox');
    if (box) {
      box.innerHTML = '';
      box.classList.toggle('is-answer', st >= 1);
      if (st >= 1) {
        box.appendChild(h('div', { class: 'al' }, '정답'));
        var av = h('div', { class: 'av' }, '①②③④⑤'[v.answer - 1]);
        if (v.fix) { av.appendChild(h('s', null, v.fix.wrong)); av.appendChild(svg(ICON.arrow, 'arw')); av.appendChild(h('span', null, v.fix.right)); }
        box.appendChild(av);
      } else {
        box.appendChild(h('div', { class: 'ph' }, svg(ICON.tap, null), '정답은 다음 클릭에'));
      }
    }
    var ex = el.querySelector('.exarea');
    ex.innerHTML = '';
    Array.prototype.forEach.call(el.querySelectorAll('.pass .ev'), function (e) { e.classList.remove('on'); });
    if (st === 1 && v.order && v.order.seq) ex.appendChild(h('div', { class: 'explain is-answer' }, h('b', null, '순서'), h('span', null, v.order.seq)));
    if (st >= 2) {
      ex.appendChild(h('div', { class: 'explain is-answer' }, h('b', null, '해설'), h('span', null, v.key)));
      if (!el._ev) {
        el._ev = { found: 0, total: v.basis.length };
        v.basis.forEach(function (b) {
          var sp = el.querySelector('.pass .sent[data-n="' + b.sent + '"]');
          if (sp && wrapQuote(sp, b.quote, 'ev')) el._ev.found++;
        });
      }
      wait(function () { Array.prototype.forEach.call(el.querySelectorAll('.pass .ev'), function (e) { e.classList.add('on'); }); }, 120);
    }
  };

  R.sum = function () {
    var el = h('section', { class: 'slide sum' }), F = D.flow, m = D.marks;
    var chain = h('div', { class: 'chain' });
    F.boxes.forEach(function (b, i) {
      if (i) chain.appendChild(svg(ICON.arrow, null));
      chain.appendChild(h('span', { class: 'c' + (b.star ? ' star' : '') }, b.label, b.star ? star() : null, h('small', null, b.sents[0] + (b.sents[1] !== b.sents[0] ? '~' + b.sents[1] : ''))));
    });
    var left = h('div', null,
      M.topic_ko ? h('div', { class: 'blk rise', style: '--i:0' }, h('div', { class: 'lab' }, '주제'), h('div', { class: 'topic' }, M.topic_ko)) : null,
      M.gist_ko ? h('div', { class: 'blk rise', style: '--i:1' }, h('div', { class: 'lab' }, '요지'), h('div', { class: 'gist' }, M.gist_ko)) : null,
      F.boxes.length ? h('div', { class: 'blk rise', style: '--i:2' }, h('div', { class: 'lab' }, '글의 구조'), chain) : null);
    var vchips = h('div', { class: 'chips' });
    m.vocab.forEach(function (v) { vchips.appendChild(h('span', { class: 'vchip' }, h('b', null, v.text), v.ko)); });
    var gl = h('div', null);
    m.grammar.forEach(function (g) { gl.appendChild(h('div', { class: 'gchip' }, h('span', { class: 'tab gr' }, g.chip), h('b', null, g.text), h('i', null, '문장 ' + g.sent))); });
    var right = h('div', null,
      m.vocab.length ? h('div', { class: 'blk rise', style: '--i:3' }, h('div', { class: 'lab' }, '핵심 어휘'), vchips) : null,
      m.grammar.length ? h('div', { class: 'blk rise', style: '--i:4' }, h('div', { class: 'lab' }, '어법 포인트'), gl) : null);
    el.appendChild(h('div', { class: 'cols' }, left, right));
    return el;
  };

  /* ------------------------------------------------------------ 단어 정리 · 끊어 읽기 · T/F · 요약문 · 서술형(대표 10-18 10:2x 더함) */
  R.words = function (s) {
    var el = h('section', { class: 'slide words' }), tb = h('div', { class: 'wtable' });
    tb.appendChild(h('div', { class: 'whead' }, h('span', null, '낱말 · 숙어'), h('span', null, '뜻'), h('span', null, '유의어'), h('span', null, '반의어')));
    s.rows.forEach(function (i, k) {
      var w = D.words[i];
      var row = h('div', { class: 'wrow stag', style: '--i:' + k, role: 'button', tabindex: '0', 'aria-label': w.text + ' 뜻 보기' },
        h('div', { class: 'ww' }, h('b', null, w.text), h('span', { class: 'pos' + (w.kind === 'idiom' ? ' idiom' : '') }, w.pos),
          w.der && w.der.length ? h('small', null, '파생 ' + w.der.join(', ')) : null),
        h('div', { class: 'wk' }, h('span', { class: 'mean' }, w.ko)),
        h('div', { class: 'ws' }, w.syn.join(', ')),
        h('div', { class: 'wa' }, w.ant.join(', ')));
      row.addEventListener('click', function (e) {
        e.stopPropagation();
        row.classList.toggle('show');
        row.querySelector('.wk').classList.toggle('is-answer', row.classList.contains('show'));
      });
      row.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.stopPropagation(); e.preventDefault(); row.click(); } });
      tb.appendChild(row);
    });
    el.appendChild(h('div', { class: 'fit' }, tb));
    el._fit = function () { fit(el, el.querySelector('.fit'), '--fs', 34, 18); };
    return el;
  };
  A.words = function (s, st, prev, el) {
    Array.prototype.forEach.call(el.querySelectorAll('.wrow'), function (r, i) {
      var on = st >= 1, wk = r.querySelector('.wk');
      if (on && st > prev) wait(function () { r.classList.add('show'); wk.classList.add('is-answer'); }, i * 50);
      else { r.classList.toggle('show', on); wk.classList.toggle('is-answer', on); }
    });
  };

  R.chunk = function (s) {
    var el = h('section', { class: 'slide chunk' }), box = h('div', { class: 'crows' });
    var byN = {};
    (D.chunks || []).forEach(function (c) { byN[c.n] = c; });
    s.ns.forEach(function (n, k) {
      var c = byN[n], line = h('div', { class: 'cl' });
      c.segs.filter(function (g) { return g.t.trim(); }).forEach(function (g, j) {
        if (j > 0) line.appendChild(h('span', { class: 'slash', 'aria-hidden': 'true' }, '/'));
        line.appendChild(h('span', { class: 'cs' + (g.ko ? ' has' : ''), style: '--j:' + j },
          h('span', { class: 'ce' }, g.t.trim()), h('span', { class: 'ck' }, g.ko || ' ')));
      });
      box.appendChild(h('div', { class: 'crow stag', 'data-k': k + 1, style: '--i:' + k }, numChip(n), line));
    });
    el.appendChild(h('div', { class: 'fit' }, box));
    el.appendChild(tagBar());
    el._fit = function () { fit(el, el.querySelector('.fit'), '--fs', 28, 17); };
    return el;
  };
  A.chunk = function (s, st, prev, el) {
    Array.prototype.forEach.call(el.querySelectorAll('.crow'), function (r) {
      var k = +r.getAttribute('data-k');
      r.classList.toggle('on', k <= st);
      r.classList.toggle('cur', k === st);
    });
    fillTagBar(el, st ? s.ns[st - 1] : 0);
  };

  /* 원고 fix 「갈래 — 까닭」 가운데 화면에는 까닭만(갈래 이름은 만드는 쪽 분류) */
  function fixText(f) { if (!f) return ''; var i = f.indexOf('—'); return i >= 0 ? f.slice(i + 1).trim() : f; }
  R.tf = function () {
    var el = h('section', { class: 'slide tf' }), list = h('ol', { class: 'tflist' });
    D.tf.forEach(function (t, i) {
      list.appendChild(h('li', { class: 'tfrow stag', 'data-k': i + 1, style: '--i:' + i },
        h('span', { class: 'tn' }, String(i + 1)),
        h('div', { class: 'ts' }, h('span', null, t.s), h('div', { class: 'tfix' }, fixText(t.fix))),
        h('span', { class: 'tbadge' })));
    });
    el.appendChild(h('div', { class: 'fit' }, list));
    el._fit = function () { fit(el, el.querySelector('.fit'), '--fs', 28, 18); };
    return el;
  };
  A.tf = function (s, st, prev, el) {
    Array.prototype.forEach.call(el.querySelectorAll('.tfrow'), function (r) {
      var k = +r.getAttribute('data-k'), t = D.tf[k - 1], b = r.querySelector('.tbadge'), fx = r.querySelector('.tfix');
      var on = k <= st;
      b.textContent = on ? t.a : '';
      b.className = 'tbadge' + (on ? ' is-answer ' + (t.a === 'T' ? 'ok' : 'no') : '');
      fx.classList.toggle('on', on && !!t.fix);
      fx.classList.toggle('is-answer', on && !!t.fix);
      r.classList.toggle('cur', k === st);
    });
  };

  R.summary = function () {
    var el = h('section', { class: 'slide summary' }), S2 = D.summary, p = h('p', { class: 'stext' });
    S2.text.split(/(\{[AB]\})/).forEach(function (part) {
      var m = /^\{([AB])\}$/.exec(part);
      if (m) p.appendChild(h('span', { class: 'slot', 'data-slot': m[1] }, h('i', null, '(' + m[1] + ')'), h('span', { class: 'fillw' }, S2.fill[m[1]])));
      else add(p, part);
    });
    el.appendChild(h('div', { class: 'sumwrap' }, h('div', { class: 'slab' }, '한 문장 요약'), p));
    el.appendChild(h('div', { class: 'exarea', style: 'flex:none;min-height:110px' }));
    return el;
  };
  A.summary = function (s, st, prev, el) {
    Array.prototype.forEach.call(el.querySelectorAll('.slot'), function (x) { x.classList.toggle('is-answer', st >= 1); });
    var ex = el.querySelector('.exarea');
    ex.innerHTML = '';
    if (st >= 2) ex.appendChild(h('div', { class: 'explain is-answer' }, h('b', null, '해설'), h('span', null, D.summary.key)));
  };

  R.sr = function (s) {
    var q = s.q, el = h('section', { class: 'slide sr' });
    el.appendChild(h('div', { class: 'qh' }, h('span', { class: 'qtag' }, '서술형 ' + s.idx, h('em', null, q.name)), h('div', { class: 'stem' }, q.stem)));
    var left = h('div', { class: 'srl' },
      q.ko ? h('div', { class: 'srko' }, q.ko) : null,
      q.ask ? h('div', { class: 'srko' }, q.ask) : null,
      q.bogi.length ? h('div', { class: 'bogi' }, h('b', null, '보기'), q.bogi.map(function (b) { return h('span', null, b); })) : null,
      h('ul', { class: 'conds' }, q.conditions.map(function (c) { return h('li', null, c); })));
    el.appendChild(h('div', { class: 'fit' }, left));
    el.appendChild(h('div', { class: 'srans' }));
    el._fit = function () { fit(el, el.querySelector('.fit'), '--fs', 34, 18); };
    return el;
  };
  A.sr = function (s, st, prev, el) {
    var box = el.querySelector('.srans');
    box.innerHTML = '';
    box.classList.toggle('is-answer', st >= 1);
    if (st >= 1) { box.appendChild(h('b', null, '모범 답')); box.appendChild(h('div', { class: 'model' }, s.q.model)); }
    else box.appendChild(h('div', { class: 'ph' }, svg(ICON.tap, null), '모범 답은 다음 클릭에'));
  };

  /* ------------------------------------------------------------ 이동 */
  var view, wm;
  function go(i, st, back) {
    i = Math.max(0, Math.min(S.length - 1, i));
    var s = S[i], changed = i !== state.cur || !state.el, prevStep = changed ? -1 : state.step;
    if (changed) {
      if (state.el) state.el.remove();
      state.el = R[s.kind](s);
      if (!RM) { state.el.classList.add('enter'); if (back) state.el.classList.add('back'); }
      view.appendChild(state.el);
      state.cur = i;
      if (state.el._fit) state.el._fit();
      document.getElementById('htitle').textContent = s.title;
      wm.classList.toggle('off', s.kind === 'cover');
    }
    state.step = Math.max(0, Math.min(st, steps(s)));
    if (A[s.kind]) A[s.kind](s, state.step, prevStep, state.el);
    ui();
    try { history.replaceState(null, '', location.pathname + location.search + '#' + (i + 1) + '.' + state.step); } catch (e) { /* file:// 일부 */ }
  }
  function ui() {
    var s = S[state.cur], n = steps(s);
    document.getElementById('pgnum').textContent = (state.cur + 1) + ' / ' + S.length;
    document.getElementById('prog').style.width = ((state.cur + (n ? state.step / (n + 1) : 1)) / S.length * 100) + '%';
    Array.prototype.forEach.call(document.querySelectorAll('#rail button'), function (b) {
      var g = GROUPS[+b.getAttribute('data-g')], nx = GROUPS[+b.getAttribute('data-g') + 1];
      b.classList.toggle('cur', state.cur >= g.first && (!nx || state.cur < nx.first));
    });
    document.getElementById('stepnum').textContent = n ? '단계 ' + state.step + ' / ' + n : '';
    document.getElementById('prev').disabled = state.cur === 0 && state.step === 0;
    document.getElementById('next').disabled = state.cur === S.length - 1 && state.step >= n;
    document.getElementById('nextTx').textContent = nextLabel(s, state.step);
    var ko = document.getElementById('bKo');
    ko.disabled = s.kind !== 'read';
    ko.setAttribute('aria-pressed', state.koAll && s.kind === 'read' ? 'true' : 'false');
    Array.prototype.forEach.call(document.querySelectorAll('#flowSeg button'), function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-flow') === state.flow ? 'true' : 'false'); });
  }
  function next() { var n = steps(S[state.cur]); if (state.step < n) go(state.cur, state.step + 1); else if (state.cur < S.length - 1) go(state.cur + 1, 0); }
  function prev() { if (state.step > 0) go(state.cur, state.step - 1); else if (state.cur > 0) go(state.cur - 1, steps(S[state.cur - 1]), true); }
  function setFlow(f) {
    if (D.kind === 'notice' || f === state.flow) return;
    state.flow = f;
    var i = state.cur, st = state.step;
    state.el.remove(); state.el = null; state.cur = -1;
    go(i, st);
  }
  function toggleKo() { if (S[state.cur].kind !== 'read') return; state.koAll = !state.koAll; go(state.cur, state.step); }
  function fullscreen() { if (!document.fullscreenElement) { if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen(); } else document.exitFullscreen(); }

  /* ------------------------------------------------------------ 틀 */
  function scaleStage() {
    var sc = Math.min(innerWidth / W, innerHeight / H);
    document.getElementById('stage').style.transform = 'scale(' + sc + ')';
  }
  function chrome() {
    var stage = document.getElementById('stage');
    var chip = M.grade + ' · ' + String(M.year).slice(2) + '년 ' + M.month + '월 · ' + M.item_no + '번';
    var hdr = h('header', { id: 'hdr' },
      h('a', { class: 'brand', href: '../index.html', title: '지문 목록' }, h('img', { src: '../assets/img/lingua_mark.png', alt: '링구아' }), h('b', null, '링구아 고등 내신'), h('span', null, '강사본')),
      h('div', { class: 'hsep' }), h('span', { class: 'pchip' }, chip), h('div', { id: 'htitle' }),
      h('div', { id: 'tools' },
        D.kind === 'notice' ? null : h('div', { class: 'seg', id: 'flowSeg', role: 'group', 'aria-label': '판' },
          h('button', { type: 'button', 'data-flow': 'sent' }, '문장별'), h('button', { type: 'button', 'data-flow': 'para' }, '이어진', h('span', { class: 'kbd' }, 'P'))),
        h('button', { class: 'tbtn', id: 'bKo', type: 'button' }, '해석 모두', h('span', { class: 'kbd' }, 'H')),
        h('button', { class: 'tbtn', id: 'bFs', type: 'button' }, '전체 화면', h('span', { class: 'kbd' }, 'F'))));
    view = h('main', { id: 'view' });
    wm = h('img', { id: 'wm', src: '../assets/img/watermark.png', alt: '', 'aria-hidden': 'true' });
    view.appendChild(wm);
    var rail = h('div', { id: 'rail' });
    GROUPS.forEach(function (g, i) { rail.appendChild(h('button', { type: 'button', 'data-g': i }, g.name)); });
    var ftr = h('footer', { id: 'ftr' }, h('div', { id: 'prog' }), h('div', { id: 'pgnum' }), rail, h('div', { id: 'stepnum' }),
      h('div', { id: 'nav' },
        h('button', { class: 'nbtn', id: 'prev', type: 'button', 'aria-label': '이전' }, svg('m15 18-6-6 6-6')),
        h('button', { class: 'nbtn pri', id: 'next', type: 'button' }, h('span', { id: 'nextTx' }, '다음'), svg('m9 18 6-6-6-6'))));
    add(stage, [hdr, view, ftr]);
    rail.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) go(GROUPS[+b.getAttribute('data-g')].first, 0, GROUPS[+b.getAttribute('data-g')].first < state.cur); });
    document.getElementById('next').onclick = next;
    document.getElementById('prev').onclick = prev;
    document.getElementById('bKo').onclick = toggleKo;
    document.getElementById('bFs').onclick = fullscreen;
    var seg = document.getElementById('flowSeg');
    if (seg) seg.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) setFlow(b.getAttribute('data-flow')); });
    view.addEventListener('click', function (e) { if (e.target.closest('a,button')) return; next(); });
  }
  addEventListener('keydown', function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    var k = e.key;
    if (k === 'ArrowRight' || k === ' ' || k === 'PageDown' || k === 'Enter') { e.preventDefault(); next(); }
    else if (k === 'ArrowLeft' || k === 'PageUp' || k === 'Backspace') { e.preventDefault(); prev(); }
    else if (k === 'Home') { e.preventDefault(); go(0, 0, true); }
    else if (k === 'End') { e.preventDefault(); go(S.length - 1, 0); }
    else if (k === 'h' || k === 'H') toggleKo();
    else if (k === 'p' || k === 'P') setFlow(state.flow === 'sent' ? 'para' : 'sent');
    else if (k === 'f' || k === 'F') fullscreen();
  });

  /* 검사 손잡이(_review 캡처 · 넘침 검사가 부른다) */
  function overflow() {
    var out = [], st = document.getElementById('stage').getBoundingClientRect(), sc = st.width / W;
    var el = state.el; if (!el) return out;
    var f = el.getAttribute('data-fit'); if (f === 'overflow') out.push({ what: 'fit-min', slide: state.cur + 1 });
    Array.prototype.forEach.call(el.querySelectorAll('.fit,.pass,.left,.panel,.side,.note,.box,.opt,.explain,.ansbox,.cols,.gistband,.lane,.tagbar,.srans,.sumwrap,.wtable,.crows,.tflist'), function (b) {
      if (b.scrollHeight > b.clientHeight + 2 || b.scrollWidth > b.clientWidth + 2) out.push({ what: 'box', cls: b.className, sh: b.scrollHeight, ch: b.clientHeight, sw: b.scrollWidth, cw: b.clientWidth });
    });
    var vr = view.getBoundingClientRect();
    Array.prototype.forEach.call(el.querySelectorAll('*'), function (n) {
      if (!n.firstChild || n.closest('svg')) return;
      var r = n.getBoundingClientRect(); if (!r.width || !r.height) return;
      if (r.right > vr.right + 1 || r.bottom > vr.bottom + 1 || r.left < vr.left - 1 || r.top < vr.top - 1) out.push({ what: 'out-of-view', tag: n.tagName, cls: n.className, text: (n.textContent || '').slice(0, 40) });
    });
    return out.slice(0, 20);
  }
  window.__deck = {
    slides: S.map(function (s) { return { kind: s.kind, title: s.title, steps: steps(s) }; }),
    go: go, next: next, prev: prev, setFlow: setFlow,
    state: function () { return { cur: state.cur, step: state.step, flow: state.flow, koAll: state.koAll, fit: state.el && state.el.getAttribute('data-fit'), ev: state.el && state.el._ev || null }; },
    overflow: overflow,
    answersVisible: function () { return document.querySelectorAll('#view .is-answer, #view .u.answer').length; }
  };

  function start() {
    chrome(); scaleStage(); addEventListener('resize', scaleStage);
    var m = /^#(\d+)(?:\.(\d+))?$/.exec(location.hash || '');
    var go0 = function () { go(m ? +m[1] - 1 : 0, m && m[2] ? +m[2] : 0); document.documentElement.setAttribute('data-ready', '1'); };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(go0); else go0();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
