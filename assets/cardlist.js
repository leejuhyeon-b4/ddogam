/* 나또감 — 내 카드 도감(판) 페이지
   · 실제 저장 기능(Supabase restaurants/visits)은 아직 없다.
     지금은 assets/mock-data.js의 목업 데이터를 등급별 구역(board-zone)에
     배치해 도감 화면을 보여준다. 나중에 실 데이터로 교체할 때는
     window.NaToGam.mockData.restaurants를 실제 쿼리 결과로 바꾸면 된다.
   · window.NaToGam.auth(assets/auth.js)가 먼저 실행돼 있어야 하므로
     cardlist.html에서 이 스크립트는 auth.js 다음에 로드한다.
   · window.NaToGam.utils / window.NaToGam.mockData(둘 다 classic script)는
     이 파일보다 먼저 로드돼 있어야 한다. */
(function () {
  'use strict';

  var root = document.getElementById('cardlistRoot');
  if (!root) return;

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

  /* ── 카드 한 장 — 5분할 (왼쪽위 식당명 · 오른쪽위 이미지-빈칸 ·
     가운데 길게 등급 · 왼쪽아래 방문횟수 · 오른쪽아래 누적금액)
     등급별 재질·색상 구분 없음 — 모든 카드가 같은 톤이다. ── */
  function card5HTML(restaurant, utils) {
    var meta = utils.GRADE_META[restaurant.grade];
    var visits = utils.visitCount(restaurant);
    var spentMan = Math.round(utils.totalSpent(restaurant) / 10000).toLocaleString('ko-KR');
    var name = utils.escapeHtml(restaurant.name);

    return '<article class="card5">' +
        '<div class="c5-name"><span class="cname">' + name + '</span></div>' +
        '<div class="c5-image" aria-hidden="true"></div>' +
        '<div class="c5-grade"><span class="c5-grade-name">' + meta.name + '</span></div>' +
        '<div class="c5-visits"><span class="st-k">방문</span><b>' + visits + '</b><i>회</i></div>' +
        '<div class="c5-spent"><span class="st-k">누적</span><b>' + spentMan + '</b><i>만원</i></div>' +
      '</article>';
  }

  function emptySlotHTML() {
    return '<div class="board-slot-empty"><span>아직 등록한 맛집이 없습니다</span></div>';
  }

  /* ── 로그인 상태 — 등급 구역(S→A→B→C)으로 나눈 도감판 ── */
  function renderLoggedIn() {
    var utils = window.NaToGam.utils;
    var restaurants = (window.NaToGam.mockData && window.NaToGam.mockData.restaurants) || [];

    var html = '<div class="board">';

    utils.GRADE_ORDER.forEach(function (code) {
      var meta = utils.GRADE_META[code];
      var group = restaurants.filter(function (r) { return r.grade === code; });

      /* 구역 내부 정렬 — 방문 횟수순(기본값, DESIGN §5.3), 동률이면 누적 금액순 */
      group.sort(function (a, b) {
        var vc = utils.visitCount(b) - utils.visitCount(a);
        if (vc !== 0) return vc;
        return utils.totalSpent(b) - utils.totalSpent(a);
      });

      html += '<div class="board-zone zone-' + code.toLowerCase() + '">' +
          '<h3 class="board-zone-label">' + meta.name + '</h3>' +
          '<span class="board-zone-count">' + group.length + '곳</span>' +
          '<div class="board-grid">';

      if (group.length === 0) {
        html += emptySlotHTML();
      } else {
        group.forEach(function (r) { html += card5HTML(r, utils); });
      }

      html += '</div></div>';
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
