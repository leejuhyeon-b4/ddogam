/* 나또감 — 랜딩페이지 상호작용
   · 3D 표본 카드: 기울기 · 광택 추적 · 한 바퀴 회전
   · 등급 전환 데모: 재질 크로스페이드 (DESIGN §7.2)
   · 정원 카운터: 초과 시 경고문 없이 숫자만 물든다 */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── 등급 데이터 ────────────────────────────────
     정의는 전부 "또 갈 건가"라는 한 질문의 정도 차이다.  */
  var GRADES = [
    { cls:'g-c', name:'비추',     mat:'점토',   def:'안 감',
      place:'신사 파스타',   visits:1,  spend:9,   lift:'0px'  },
    { cls:'g-b', name:'무난',     mat:'사암',   def:'누가 가자면 또 감',
      place:'역삼 김치찌개', visits:9,  spend:11,  lift:'-2px' },
    { cls:'g-a', name:'맛집',     mat:'화강암', def:'근처 가면 또 감',
      place:'연남 손칼국수', visits:23, spend:96,  lift:'-5px' },
    { cls:'g-s', name:'인생맛집', mat:'대리석', def:'멀리서 일부러라도 또 감',
      place:'을지로 골뱅이', visits:47, spend:380, lift:'-9px' }
  ];

  var SHADOW = {
    'g-c':'0 2px 5px rgba(42,39,36,.10)',
    'g-b':'0 7px 14px rgba(42,39,36,.16),0 2px 5px rgba(42,39,36,.10)',
    'g-a':'0 12px 24px rgba(42,39,36,.20),0 4px 8px rgba(42,39,36,.12)',
    'g-s':'0 18px 34px rgba(42,39,36,.24),0 6px 12px rgba(42,39,36,.14)'
  };

  /* ── 카드 마크업 ── */
  function frameHTML(g) {
    return '<div class="frame">' +
        '<div class="namebar">' +
          '<span class="cname">' + g.place + '</span>' +
          '<span class="cbadge">' + g.name + '</span>' +
        '</div>' +
        '<div class="art" aria-hidden="true"><span class="mat">' + g.mat + '</span></div>' +
        '<p class="cdef">' + g.def + '</p>' +
        '<div class="statbar">' +
          '<span class="st"><span class="st-k">방문</span><b>' + g.visits + '</b><i>회</i></span>' +
          '<span class="st"><span class="st-k">누적</span><b>' + g.spend + '</b><i>만원</i></span>' +
        '</div>' +
      '</div>';
  }

  function cardHTML(g) {
    return '<div class="tilt"><div class="flip">' +
        '<div class="face front ' + g.cls + '">' + frameHTML(g) +
          '<span class="glare" aria-hidden="true"></span></div>' +
        '<div class="face back" aria-hidden="true"><span class="seal">나또감</span></div>' +
      '</div></div>';
  }

  /* ── 3D 상호작용 ──────────────────────────────── */
  function bind(scene) {
    var tilt  = scene.querySelector('.tilt');
    var flip  = scene.querySelector('.flip');
    var glare = scene.querySelector('.glare');
    var busy  = false;

    /* 포인터 없이도 닿을 수 있어야 한다 — DESIGN §8 */
    if (!scene.hasAttribute('tabindex')) scene.setAttribute('tabindex', '0');

    function point(px, py) {
      px = Math.min(1, Math.max(0, px));
      py = Math.min(1, Math.max(0, py));
      tilt.style.transition = 'transform 90ms linear';
      tilt.style.transform =
        'rotateX(' + ((0.5 - py) * 16).toFixed(2) + 'deg) ' +
        'rotateY(' + ((px - 0.5) * 22).toFixed(2) + 'deg)';
      if (glare) {
        glare.style.setProperty('--gx', (px * 100).toFixed(1) + '%');
        glare.style.setProperty('--gy', (py * 100).toFixed(1) + '%');
      }
    }

    function move(e) {
      var r = scene.getBoundingClientRect();
      point((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
    }

    function spin() {
      if (busy || reduce) return;
      busy = true;
      flip.style.transition = 'transform 900ms cubic-bezier(.22,.68,.24,1)';
      flip.style.transform = 'rotateY(360deg)';
      window.setTimeout(function () {
        flip.style.transition = 'none';
        flip.style.transform = 'rotateY(0deg)';
        window.requestAnimationFrame(function () {
          flip.style.transition = '';
          busy = false;
        });
      }, 900);
    }

    function on() { if (glare) glare.style.setProperty('--on', '1'); }
    function off() {
      tilt.style.transition = 'transform 420ms cubic-bezier(.2,.7,.2,1)';
      tilt.style.transform = 'rotateX(0deg) rotateY(0deg)';
      if (glare) glare.style.setProperty('--on', '0');
    }

    scene.addEventListener('pointerenter', function () { on(); spin(); });
    scene.addEventListener('pointermove', move);
    scene.addEventListener('pointerleave', off);
    scene.addEventListener('click', spin);        /* 터치 — 탭하면 돈다 */

    /* 키보드 — 포커스로 돌고, Enter/Space로 다시 돈다 */
    scene.addEventListener('focus', function () { on(); point(0.62, 0.38); spin(); });
    scene.addEventListener('blur', off);
    scene.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); spin(); }
    });
  }

  /* ── 히어로 카드 ── */
  var hero = document.getElementById('heroCard');
  if (hero) {
    hero.innerHTML = cardHTML(GRADES[3]);
    bind(hero);
  }

  /* ── 등급 표본 진열 ── */
  var rack = document.getElementById('rack');
  if (rack) {
    GRADES.slice().reverse().forEach(function (g) {
      var slot = document.createElement('div');
      slot.className = 'slot';
      slot.innerHTML =
        '<div class="scene">' + cardHTML(g) + '</div>' +
        '<span class="cap">' + g.name + ' · ' + g.mat + '</span>';
      rack.appendChild(slot);
      bind(slot.querySelector('.scene'));
    });
  }

  /* ── 공유 카드 ── */
  var share = document.getElementById('shareCard');
  if (share) {
    share.innerHTML = cardHTML(GRADES[3]);
    bind(share);
  }

  /* ── 등급 전환 데모 ────────────────────────────── */
  var stack  = document.getElementById('demoStack');
  var shadow = document.getElementById('demoShadow');
  if (stack && shadow) {
    var layers = stack.querySelectorAll('.layer');
    var steps  = document.querySelectorAll('.step');
    var cur = 0, front = 0;

    var paintLayer = function (el, g) {
      el.className = 'layer ' + g.cls;
      el.innerHTML = frameHTML(g);
    };

    paintLayer(layers[0], GRADES[0]);
    layers[1].style.opacity = '0';
    shadow.style.boxShadow = SHADOW[GRADES[0].cls];

    var setGrade = function (next) {
      if (next === cur) return;
      var g = GRADES[next];
      var demoting = next < cur;

      stack.classList.toggle('demote', demoting);
      shadow.classList.toggle('demote', demoting);

      var backIdx = front === 0 ? 1 : 0;
      paintLayer(layers[backIdx], g);
      layers[backIdx].style.opacity = '1';
      layers[front].style.opacity = '0';
      front = backIdx;

      shadow.style.boxShadow = SHADOW[g.cls];
      shadow.style.transform = 'translateY(' + g.lift + ')';

      for (var j = 0; j < steps.length; j++) {
        steps[j].setAttribute('aria-pressed', String(Number(steps[j].dataset.g) === next));
      }

      /* 승격에만 햅틱 1회 — 강등은 축하하지 않는다 (DESIGN §7.2) */
      if (!demoting && navigator.vibrate) navigator.vibrate(12);

      cur = next;
    };

    for (var i = 0; i < steps.length; i++) {
      (function (b) {
        b.addEventListener('click', function () { setGrade(Number(b.dataset.g)); });
      })(steps[i]);
    }

    var demoScene = document.querySelector('[data-card="demo"]');
    if (demoScene) bind(demoScene);
  }

  /* ── 정원 카운터 ── */
  var counter = document.getElementById('counter');
  var cNow = document.getElementById('cNow');
  if (counter && cNow) {
    var CAP = 9;
    counter.addEventListener('click', function () {
      var n = Number(cNow.textContent);
      n = n >= 11 ? 8 : n + 1;
      cNow.textContent = String(n);
      counter.classList.toggle('over', n > CAP);
    });
  }
})();
