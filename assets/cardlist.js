/* 나또감 — 내 카드 페이지
   · 맛집 저장 기능은 아직 없다. 지금은 로그인 상태에 따라
     로그인 유도 / 빈 상태(등급별 뼈대)만 보여준다.
   · window.NaToGam.auth(assets/auth.js)가 먼저 실행돼 있어야 하므로
     cardlist.html에서 이 스크립트는 auth.js 다음에 로드한다. */
(function () {
  'use strict';

  var root = document.getElementById('cardlistRoot');
  if (!root) return;

  var GROUPS = ['인생맛집', '맛집', '무난', '비추'];

  /* ── 비로그인 상태 ── */
  function renderLoggedOut() {
    root.innerHTML =
      '<div class="cardlist-login">' +
        '<p class="lede">로그인하면 내 맛집 카드를 모아볼 수 있어요.</p>' +
        '<button type="button" class="btn-brass" id="cardlistLoginBtn">로그인</button>' +
      '</div>';

    var btn = document.getElementById('cardlistLoginBtn');
    if (btn) {
      btn.addEventListener('click', function () {
        window.NaToGam.auth.openLoginModal();
      });
    }
  }

  /* ── 로그인 상태, 저장된 맛집 없음 ── */
  function renderLoggedIn() {
    var html = '<div class="cardlist-groups">';
    GROUPS.forEach(function (name) {
      html +=
        '<div class="cardlist-group">' +
          '<h3>' + name + '</h3>' +
          '<p class="note">아직 등록한 맛집이 없습니다</p>' +
        '</div>';
    });
    html += '</div>';
    root.innerHTML = html;
  }

  function render(user) {
    if (user) renderLoggedIn(); else renderLoggedOut();
  }

  if (window.NaToGam && window.NaToGam.auth) {
    window.NaToGam.auth.onChange(render);
  }
})();
