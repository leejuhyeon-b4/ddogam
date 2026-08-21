/* 나또감 — 랜딩페이지 상호작용
   · 3D 표본 카드: 기울기 · 광택 추적 · 한 바퀴 회전
   · 정원 카운터: 초과 시 경고문 없이 숫자만 물든다 */
(function () {
  'use strict';

  function mq(q) {
    return window.matchMedia ? window.matchMedia(q).matches : false;
  }

  var reduce = mq('(prefers-reduced-motion: reduce)');

  /* 마우스가 있는 기기에서만 기울기·광택을 켠다.
     터치에서 pointermove를 받으면 스크롤 제스처가 카드를 기울이고,
     pointerleave가 안 와서 기울어진 채로 남는다. */
  var canHover = mq('(hover: hover) and (pointer: fine)');

  /* ── 등급 데이터 ────────────────────────────────
     정의는 전부 "또 갈 건가"라는 한 질문의 정도 차이다.  */
  var GRADES = [
    { cls:'g-c', name:'비추',     mat:'점토',   def:'안 감',
      place:'신사 파스타',   visits:1,  spend:9,   lift:'0px'  },
    { cls:'g-b', name:'무난',     mat:'사암',   def:'이유가 생기면 감',
      place:'역삼 김치찌개', visits:9,  spend:11,  lift:'-2px' },
    { cls:'g-a', name:'맛집',     mat:'화강암', def:'근처 가면 또 감',
      place:'연남 손칼국수', visits:23, spend:96,  lift:'-5px' },
    { cls:'g-s', name:'인생맛집', mat:'대리석', def:'멀리서 일부러라도 또 감',
      place:'을지로 골뱅이', visits:47, spend:380, lift:'-9px' }
  ];

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

    if (canHover) {
      scene.addEventListener('pointerenter', function () { on(); spin(); });
      scene.addEventListener('pointermove', move);
      scene.addEventListener('pointerleave', off);
      scene.addEventListener('pointercancel', off);
    }

    /* 터치는 탭으로만 돈다. 기울기 없음 — 스크롤과 싸우지 않게 */
    scene.addEventListener('click', spin);

    /* 키보드 — 포커스로 돌고, Enter/Space로 다시 돈다 */
    scene.addEventListener('focus', function () {
      on();
      if (canHover) point(0.62, 0.38);
      spin();
    });
    scene.addEventListener('blur', off);
    scene.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); spin(); }
    });
  }

  /* ── 공유 카드 ── */
  var share = document.getElementById('shareCard');
  if (share) {
    share.innerHTML = cardHTML(GRADES[3]);
    bind(share);
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
