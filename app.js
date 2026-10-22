/* Exclusive Epoxy & Concrete: private concept v3. No framework, no build step. */
(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var TOUCH = window.matchMedia('(pointer:coarse)').matches || window.matchMedia('(hover:none)').matches;
  var PHONE = TOUCH || window.matchMedia('(max-width:700px)').matches;
  var saveData = !!(navigator.connection && navigator.connection.saveData);

  /* ================= 1. PINNED SCROLL STORY =================
     Five rest points (bare, ground, white base, pour, sealed) joined by four Kling 4.0 clips.
     At every rest point the crisp 2752 px still (responsive AVIF/WebP) is cross-faded over the moving picture,
     so resting frames are razor sharp and the video is only seen while it moves.
     Desktop: media/video/hero.mp4 (1920 wide, all-keyframe, 481 frames, 24 fps), stage i at i * 5 s,
              fetched as a blob so seeking never depends on HTTP Range support.
     Phones : iOS Safari seeks video badly, so media/frames/hero-m/000..200.webp (1000 px wide, 10 fps,
              stage i at frame i * 50) are drawn to a canvas. Frames are fetched as blobs and decoded through
              a small LRU so memory stays low. Until the moving media has loaded, the stills alone carry the
              story (nearest still, cross-faded). */
  var story = $('#story'), pin = $('#pin'), sv = $('#sv'), sc = $('#sc'), stillsEl = $('#stills');
  var stills = $$('.still', stillsEl), scenes = $$('.scene');
  var hud = $('#hud'), hudNum = $('#hudNum'), hudStage = $('#hudStage'), hudArc = $('#hudArc');
  var STAGE_LABEL = ['Bare', 'Ground', 'White base', 'Pour', 'Sealed'];
  var SCORE = [12, 34, 56, 80, 100];
  var CIRC = 100.53;
  // timeline in units: rest, clip1, rest, clip2, rest, clip3 (the pour, slower), rest, clip4, rest
  var REST = 0.6, CLIP = [1, 1, 1.8, 1], FADE = 0.15;
  var SEG = [], total = 0;
  (function () {
    for (var k = 0; k < 5; k++) {
      SEG.push({ rest: true, i: k, a: total, len: REST }); total += REST;
      if (k < 4) { SEG.push({ rest: false, i: k, a: total, len: CLIP[k] }); total += CLIP[k]; }
    }
  })();
  function layout(p) {                     // scroll 0..1 -> { pos: 0..4 stage position, al: still opacities }
    var x = clamp(p, 0, 1) * total, al = [0, 0, 0, 0, 0], pos = 0;
    for (var s = 0; s < SEG.length; s++) {
      var g = SEG[s];
      if (x <= g.a + g.len || s === SEG.length - 1) {
        var u = clamp((x - g.a) / g.len, 0, 1);
        if (g.rest) { pos = g.i; al[g.i] = 1; }
        else {
          pos = g.i + u;
          al[g.i] = 1 - clamp(u / FADE, 0, 1);
          al[g.i + 1] = clamp((u - (1 - FADE)) / FADE, 0, 1);
        }
        break;
      }
    }
    return { pos: pos, al: al };
  }
  var curStage = -1, curScene = -1, ps = 0, ready = false, lastAl = '';
  function paintHud(pos) {
    var i = Math.min(3, Math.floor(pos)), k = pos - i;
    var score = SCORE[i] + (SCORE[i + 1] - SCORE[i]) * k;
    hudNum.textContent = Math.round(score);
    hudArc.style.strokeDashoffset = (CIRC * (1 - score / 100)).toFixed(2);
    hud.classList.toggle('done', score >= 97);
    var st = Math.round(pos);
    if (st !== curStage) { curStage = st; hudStage.textContent = (st + 1) + '/5 · ' + STAGE_LABEL[st]; }
    // headline: shown at the rest point and the start of each move, cleared mid-move so the picture is unobstructed
    var sc2 = -1; for (var n = 0; n < 5; n++) if (Math.abs(pos - n) < 0.22) sc2 = n;
    if (sc2 !== curScene) { curScene = sc2; scenes.forEach(function (s, q) { s.classList.toggle('is-on', q === sc2); s.setAttribute('aria-hidden', q === sc2 ? 'false' : 'true'); }); }
  }
  function paintStills(L) {
    var al;
    if (ready) al = L.al;
    else { al = [0, 0, 0, 0, 0]; al[Math.min(4, Math.round(L.pos))] = 1; }
    var key = al.join(',');
    if (key === lastAl) return; lastAl = key;
    for (var i = 0; i < 5; i++) stills[i].style.opacity = al[i];
  }
  function scrollP() {
    var r = story.getBoundingClientRect(), span = story.offsetHeight - pin.offsetHeight;
    return clamp(-r.top / span, 0, 1);
  }

  // ---- desktop video driver
  var seeking = false, seekAt = 0, lastT = -1, curT = 0;
  function driveVideo(pos) {
    var t = pos * 5;
    if (!seeking && Math.abs(t - lastT) > 1 / 96) {
      seeking = true; seekAt = performance.now(); lastT = t;
      try { sv.currentTime = Math.min(t, sv.duration ? sv.duration - 0.001 : t); } catch (e) { seeking = false; }
    } else if (seeking && performance.now() - seekAt > 500) seeking = false;
  }
  function setupVideo() {
    var url = 'media/video/hero.mp4';
    sv.addEventListener('seeked', function () { seeking = false; });
    sv.addEventListener('error', function () { seeking = false; });
    function use(src) {
      sv.src = src;
      sv.addEventListener('loadeddata', function once() { sv.removeEventListener('loadeddata', once); lastT = -1; ready = true; stillsEl.classList.remove('fade'); document.documentElement.setAttribute('data-hero', 'video-ready'); });
      sv.load();
    }
    if (window.fetch && window.URL && URL.createObjectURL) {
      fetch(url).then(function (r) { if (!r.ok) throw 0; return r.blob(); })
        .then(function (b) { use(URL.createObjectURL(b)); }).catch(function () { use(url); });
    } else use(url);
  }

  // ---- phone canvas driver
  var NF = 201, blobs = new Array(NF), bmps = {}, lru = [], loaded = 0, oy = 0.7, drawn = -1, want = 0, cw = 0, ch = 0, ctx = null, decoding = {};
  var FRAME = function (i) { return 'media/frames/hero-m/' + ('00' + i).slice(-3) + '.webp'; };
  function sizeCanvas() {
    var r = pin.getBoundingClientRect(), d = Math.min(window.devicePixelRatio || 1, 2);
    var op = getComputedStyle(stills[0].querySelector('img')).objectPosition.split(' ');
    oy = op.length > 1 && /%$/.test(op[1]) ? parseFloat(op[1]) / 100 : 0.7;      // same vertical focus as the CSS object-position
    var w = Math.round(r.width * d), h = Math.round(r.height * d);
    if (w !== cw || h !== ch) { cw = sc.width = w; ch = sc.height = h; drawn = -1; }
  }
  function paintBitmap(b, iw, ih) {
    var s = Math.max(cw / iw, ch / ih), w = iw * s, h = ih * s;
    ctx.drawImage(b, (cw - w) / 2, (ch - h) * oy, w, h);
  }
  function getBmp(i, cb) {
    if (bmps[i]) { cb(bmps[i]); return; }
    if (!blobs[i] || decoding[i]) return;
    decoding[i] = true;
    var done = function (b) {
      decoding[i] = false; bmps[i] = b; lru.push(i);
      while (lru.length > 20) { var o = lru.shift(), ob = bmps[o]; delete bmps[o]; if (ob && ob.close) try { ob.close(); } catch (e) {} }
      cb(b);
    };
    if (window.createImageBitmap) createImageBitmap(blobs[i]).then(done, function () { decoding[i] = false; });
    else { var im = new Image(); im.onload = function () { done(im); }; im.src = URL.createObjectURL(blobs[i]); }
  }
  function nearest(i) { for (var d = 0; d < NF; d++) { if (bmps[i - d]) return i - d; if (bmps[i + d]) return i + d; } return -1; }
  function drawFrame() {
    if (!ctx) return;
    var i = want;
    if (i === drawn) return;
    var b = bmps[i];
    if (b) { paintBitmap(b, b.width, b.height); drawn = i; }
    else {
      var n = nearest(i); if (n >= 0 && n !== drawn) { var nb = bmps[n]; paintBitmap(nb, nb.width, nb.height); }
      getBmp(i, function () { if (want === i) { drawn = -1; drawFrame(); } });
    }
    // warm neighbours
    for (var k = 1; k <= 3; k++) { if (i + k < NF) getBmp(i + k, function () {}); if (i - k >= 0) getBmp(i - k, function () {}); }
  }
  function setupFrames() {
    ctx = sc.getContext('2d'); sizeCanvas();
    window.addEventListener('resize', sizeCanvas);
    if (window.ResizeObserver) new ResizeObserver(sizeCanvas).observe(pin);   // iOS toolbar show/hide changes 100dvh
    var order = [0, 50, 100, 150, 200], i;
    for (i = 0; i < NF; i++) if (order.indexOf(i) < 0) order.push(i);
    var next = 0, active = 0;
    function pump() {
      while (active < 4 && next < order.length) {
        (function (idx) {
          active++;
          fetch(FRAME(idx)).then(function (r) { if (!r.ok) throw 0; return r.blob(); })
            .then(function (b) { blobs[idx] = b; loaded++; }).catch(function () { blobs[idx] = null; loaded++; })
            .then(function () { active--; if (loaded >= NF) { ready = true; stillsEl.classList.remove('fade'); document.documentElement.setAttribute('data-hero', 'canvas-ready'); } pump(); });
        })(order[next++]);
      }
    }
    pump();
  }

  var mode = 'none';
  function tick() {
    var p = scrollP();
    ps += (p - ps) * 0.2; if (Math.abs(p - ps) < 0.0002) ps = p;
    var L = layout(ps);
    paintHud(L.pos);
    paintStills(L);
    if (ready) {
      if (mode === 'video') driveVideo(L.pos);
      else if (mode === 'canvas') { want = Math.round(L.pos * 50); drawFrame(); }
    }
    requestAnimationFrame(tick);
  }
  if (!reduce.matches) {
    stillsEl.classList.add('fade');
    ps = scrollP();
    if (saveData) mode = 'none';
    else if (PHONE) { mode = 'canvas'; story.classList.add('m'); }
    else mode = 'video';
    requestAnimationFrame(tick);
    var start = function () { if (mode === 'video') setupVideo(); else if (mode === 'canvas') setupFrames(); };
    if (document.readyState === 'complete') setTimeout(start, 50); else window.addEventListener('load', function () { setTimeout(start, 50); });
  }

  /* ================= 2. FINISH PICKER + 3. SLIDER (shared state) =================
     Choosing a finish cross-fades to its crisp still and, on desktop, plays its short clip once (base to finish)
     in the same frame. Violet & gold plays the pour clip, then the sealed still fades in over it.
     On touch devices the clip plays on tap only (the video is preload=metadata, poster = the still). */
  var FIN = {
    violet:   { name: 'Violet & gold', clip: 'media/video/f-violet.mp4' },
    metallic: { name: 'Metallic',      clip: 'media/video/f-metallic.mp4' },
    flake:    { name: 'Flake',         clip: 'media/video/f-flake.mp4' },
    solid:    { name: 'Solid color',   clip: 'media/video/f-solid.mp4' }
  };
  var finish = 'violet', fv = $('#finVid'), fplay = $('#finPlay'), fin = $('#fin'), token = 0, blobUrl = {}, started = false;
  function stillUrl(f) { return 'media/img/' + f + '-1920.webp'; }
  function stopClip() { fv.classList.remove('on'); try { fv.pause(); } catch (e) {} fplay.classList.remove('gone'); }
  fv.addEventListener('ended', function () { fv.classList.remove('on'); fplay.classList.remove('gone'); });
  fv.addEventListener('error', function () { fv.classList.remove('on'); fplay.classList.remove('gone'); });
  fplay.addEventListener('click', function () { started = true; playClipNow(finish); });
  function playClipNow(f) {
    var my = ++token; stopClip();
    if (reduce.matches) return;
    fv.setAttribute('data-f', f); fv.poster = stillUrl(f);
    var src = blobUrl[f] || FIN[f].clip;
    if (fv.getAttribute('src') !== src) fv.src = src;
    var go = function () {
      if (my !== token) return;
      try { fv.currentTime = 0; } catch (e) {}
      var pr = fv.play(); fplay.classList.add('gone'); fv.classList.add('on');
      if (pr && pr.catch) pr.catch(function () { if (my === token) stopClip(); });
    };
    if (fv.readyState >= 2) go(); else { fv.addEventListener('canplay', function once() { fv.removeEventListener('canplay', once); go(); }); fv.load(); }
  }
  // desktop: prefetch the four finish clips as blobs once the section is near, so a tap plays instantly
  function prefetchClips() {
    if (TOUCH || saveData || !window.fetch) return;
    var keys = ['violet', 'flake', 'metallic', 'solid'], n = 0;
    (function nxt() {
      if (n >= keys.length) return;
      var k = keys[n++];
      fetch(FIN[k].clip).then(function (r) { return r.ok ? r.blob() : null; })
        .then(function (b) { if (b) blobUrl[k] = URL.createObjectURL(b); started = true; }).catch(function () {}).then(nxt);
    })();
  }
  var fsec = $('#finish');
  if ('IntersectionObserver' in window && fsec) {
    var io = new IntersectionObserver(function (es, o) { if (es[0].isIntersecting) { o.disconnect(); prefetchClips(); } }, { rootMargin: '1400px 0px' });
    io.observe(fsec);
  } else prefetchClips();

  function setFinish(f, userPick) {
    var changed = f !== finish;
    finish = f;
    $$('[data-finish-chips] .chip').forEach(function (c) {
      var on = c.getAttribute('data-f') === f; c.classList.toggle('is-on', on); c.setAttribute('aria-checked', on);
    });
    $$('.fin picture.f, .ba picture.after').forEach(function (im) { im.classList.toggle('is-on', im.getAttribute('data-f') === f); });
    $$('.fit').forEach(function (b) { b.classList.toggle('is-on', b.getAttribute('data-f') === f); });
    $('#finTag').textContent = FIN[f].name;
    var c = $('#cFinish .chip[data-v="' + f + '"]'); if (c) pick($('#cFinish'), c);
    if (userPick) {
      if (TOUCH) { if (changed) { stopClip(); fv.removeAttribute('data-f'); fv.poster = stillUrl(f); fv.src = FIN[f].clip; fv.load(); } }
      else if (!reduce.matches) playClipNow(f);       // desktop: choosing (or re-choosing) a finish plays its clip
    }
  }
  $$('[data-finish-chips] .chip, .fit').forEach(function (b) {
    b.addEventListener('click', function () { setFinish(b.getAttribute('data-f'), !!b.closest('#finish')); });
  });

  var ba = $('#ba'), handle = $('#baHandle'), dragging = false;
  function setX(pct) {
    pct = clamp(pct, 0, 100);
    ba.style.setProperty('--x', pct + '%');
    handle.setAttribute('aria-valuenow', Math.round(pct));
    handle.setAttribute('aria-valuetext', Math.round(pct) + ' percent bare');
  }
  function fromEvent(e) { var r = ba.getBoundingClientRect(); setX((e.clientX - r.left) / r.width * 100); }
  ba.addEventListener('pointerdown', function (e) {
    dragging = true; try { ba.setPointerCapture(e.pointerId); } catch (x) {}
    fromEvent(e); if (e.pointerType === 'mouse') e.preventDefault();
  });
  ba.addEventListener('pointermove', function (e) { if (dragging) fromEvent(e); });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (ev) { ba.addEventListener(ev, function () { dragging = false; }); });
  handle.addEventListener('keydown', function (e) {
    var v = +handle.getAttribute('aria-valuenow'), s = e.shiftKey ? 10 : 3, n = null;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') n = v - s;
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') n = v + s;
    else if (e.key === 'Home') n = 0; else if (e.key === 'End') n = 100;
    if (n !== null) { e.preventDefault(); setX(n); }
  });
  // touch: the slider area uses touch-action: pan-y (vertical drags scroll the page), the handle uses touch-action: none

  /* ================= 4. PROOF CLIP: muted, plays only while visible ================= */
  var pv = $('#proofVid');
  if (pv && !reduce.matches) {
    pv.src = 'media/video/real-barbershop.mp4';
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { pv.preload = 'auto'; var p = pv.play(); if (p && p.catch) p.catch(function () {}); } else pv.pause(); });
      }, { threshold: 0.25 }).observe(pv);
    }
  }

  /* ================= 5. PRICE YOUR FLOOR =================
     ---------------------------------------------------------------
     PLACEHOLDERS: every number in RATES, ADDERS and SIZES below was invented for the
     demo. Exclusive Epoxy has published no prices. Replace with their real
     price per sq ft by finish, and their crack/removal surcharges, before launch.
     Nothing on the page tells the visitor this; the page only says
     "Estimate. Final price after a free measure."
     --------------------------------------------------------------- */
  var SIZES = {                              // PLACEHOLDER: typical sq ft, confirm with owner
    '1car': { sq: 250, name: '1-car garage' },
    '2car': { sq: 450, name: '2-car garage' },
    '3car': { sq: 700, name: '3-car garage' },
    'basement': { sq: 800, name: 'Basement' },
    'shop': { sq: 1200, name: 'Shop or commercial' }
  };
  var RATES = {                              // PLACEHOLDER: $ per sq ft [low, high] by finish
    violet: [12, 18],
    flake: [6, 9],
    metallic: [10, 15],
    solid: [4, 6.5]
  };
  var ADDERS = {                             // PLACEHOLDER: $ per sq ft [low, high]
    cracks: [0.5, 1.25],
    old: [1, 2]
  };
  var state = { size: '2car', fin: 'violet' };
  var fmt = function (n) { return '$' + (Math.round(n / 10) * 10).toLocaleString('en-US'); };
  var shown = [0, 0], anim = 0;
  function compute() {
    var sq = SIZES[state.size].sq, lo = RATES[state.fin][0], hi = RATES[state.fin][1];
    if ($('#cCracks').checked) { lo += ADDERS.cracks[0]; hi += ADDERS.cracks[1]; }
    if ($('#cOld').checked) { lo += ADDERS.old[0]; hi += ADDERS.old[1]; }
    var res = [Math.max(sq * lo, 600), Math.max(sq * hi, 900)];
    $('#pBadge').textContent = SIZES[state.size].name + ' · ' + sq.toLocaleString('en-US') + ' sq ft';
    var from = shown.slice(), t0 = null;
    cancelAnimationFrame(anim);
    function step(ts) {
      if (t0 === null) t0 = ts;
      var k = reduce.matches ? 1 : clamp((ts - t0) / 450, 0, 1); k = 1 - Math.pow(1 - k, 3);
      shown = [from[0] + (res[0] - from[0]) * k, from[1] + (res[1] - from[1]) * k];
      $('#pLo').textContent = fmt(shown[0]); $('#pHi').textContent = fmt(shown[1]);
      if (k < 1) anim = requestAnimationFrame(step);
    }
    anim = requestAnimationFrame(step);
  }
  function pick(group, chip) {
    $$('.chip', group).forEach(function (c) { var on = c === chip; c.classList.toggle('is-on', on); c.setAttribute('aria-pressed', on); });
    if (group.id === 'cSize') state.size = chip.getAttribute('data-v'); else state.fin = chip.getAttribute('data-v');
    compute();
  }
  ['#cSize', '#cFinish'].forEach(function (id) {
    var g = $(id);
    $$('.chip', g).forEach(function (c) { c.addEventListener('click', function () { pick(g, c); if (id === '#cFinish') setFinish(c.getAttribute('data-v'), false); }); });
  });
  $('#cCracks').addEventListener('change', compute);
  $('#cOld').addEventListener('change', compute);
  compute();
})();
