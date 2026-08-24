/* 나또감 — 랭킹 페이지
   · 정렬: 등급 tier 우선 → 방문 횟수 내림차순 → 누적 금액 내림차순
     (window.NaToGam.utils.compareRestaurants, assets/utils.js)
   · 상위 3곳은 포디움(ref/rank.jpg 참고, 2위-1위-3위 순으로 배치),
     4위부터는 순번 리스트.
   · 사진이 없으므로 아바타는 무채색 원 위에 식당명 첫 글자를 얹는다.
   · 이제 실데이터(saved_restaurants + visits)라 사용자마다 결과가 다르다.
     그래서 cardlist.html과 마찬가지로 로그인 게이트를 건다.
   · type="module"이라 auth.js(마찬가지로 module) 다음에 실행된다 — 이
     시점엔 window.NaToGam.auth가 이미 준비돼 있다. assets/utils.js는
     classic script라 이보다 먼저 로드돼야 한다. */
(function () {
  'use strict';

  var root = document.getElementById('rankRoot');
  if (!root) return;

  var utils = window.NaToGam.utils;

  function monogram(name) {
    var s = (name || '').trim();
    return utils.escapeHtml(s ? s.charAt(0) : '?');
  }

  function wonMan(restaurant) {
    return Math.round(utils.totalSpent(restaurant) / 10000).toLocaleString('ko-KR');
  }

  /* ── 포디움 카드 한 장 ── */
  function podiumItemHTML(r, rankIndex) {
    var meta = utils.gradeMeta(r.grade);
    return '<div class="rank-podium-item p' + (rankIndex + 1) + '">' +
        '<span class="rank-no">' + (rankIndex + 1) + '</span>' +
        '<span class="rank-avatar">' + monogram(r.name) + '</span>' +
        '<span class="rank-name">' + utils.escapeHtml(r.name) + '</span>' +
        '<span class="rank-amount">' + wonMan(r) + '만원</span>' +
        '<span class="rank-pill">' + meta.name + '</span>' +
      '</div>';
  }

  /* DOM 순서는 2위-1위-3위(참고 이미지와 동일한 시각 순서),
     등수(p1/p2/p3) 클래스는 실제 순위 인덱스로 붙인다. */
  function renderPodium(top3) {
    var slots = [
      top3[1] ? { r: top3[1], idx: 1 } : null,
      top3[0] ? { r: top3[0], idx: 0 } : null,
      top3[2] ? { r: top3[2], idx: 2 } : null
    ];
    var html = '<div class="rank-podium">';
    slots.forEach(function (s) {
      if (s) html += podiumItemHTML(s.r, s.idx);
    });
    html += '</div>';
    return html;
  }

  /* ── 4위 이하 순번 리스트 ── */
  function renderList(rest, startRank) {
    if (rest.length === 0) return '';
    var html = '<ol class="rank-list" start="' + startRank + '">';
    rest.forEach(function (r, i) {
      var meta = utils.gradeMeta(r.grade);
      html += '<li><div class="rank-row">' +
          '<span class="rank-idx">' + (startRank + i) + '</span>' +
          '<span class="rank-avatar rank-avatar-sm">' + monogram(r.name) + '</span>' +
          '<span class="rank-row-name">' +
            '<span class="rank-name">' + utils.escapeHtml(r.name) + '</span>' +
            '<span class="rank-sub">' + meta.name + ' · ' + utils.formatVisits(utils.visitCount(r)) + '</span>' +
          '</span>' +
          '<span class="rank-amount">' + wonMan(r) + '만원</span>' +
        '</div></li>';
    });
    html += '</ol>';
    return html;
  }

  function renderRanked(restaurants) {
    if (restaurants.length === 0) {
      root.innerHTML = '<p class="note">아직 랭킹을 매길 가게가 없습니다. 검색에서 가게를 담아보세요.</p>';
      return;
    }
    var ranked = restaurants.slice().sort(utils.compareRestaurants);
    var top3 = ranked.slice(0, 3);
    var rest = ranked.slice(3);
    root.innerHTML = renderPodium(top3) + renderList(rest, 4);
  }

  function renderLoggedOut() {
    root.innerHTML =
      '<div class="cardlist-login">' +
        '<p class="lede">로그인하면 내가 담은 가게들의 랭킹을 볼 수 있어요.</p>' +
        '<button type="button" class="btn-brass" id="rankLoginBtn">로그인</button>' +
      '</div>';
    var btn = document.getElementById('rankLoginBtn');
    if (btn) btn.addEventListener('click', function () { window.NaToGam.auth.openLoginModal(); });
  }

  function renderLoading() {
    root.innerHTML = '<p class="note">불러오는 중…</p>';
  }

  /* auth.onChange는 토큰 자동 갱신 때도 같은 사용자로 다시 불린다 —
     그때마다 다시 불러오면 화면이 매번 "불러오는 중…"으로 리셋된다.
     실제로 사용자가 바뀐 경우에만 다시 불러온다. */
  var loadedUserId = null;

  function render(user) {
    if (!user) { loadedUserId = null; renderLoggedOut(); return; }
    if (user.id === loadedUserId) return;
    renderLoading();
    utils.fetchMyRestaurants(window.NaToGam.auth.getClient(), user.id)
      .then(function (data) {
        loadedUserId = user.id;   // 성공했을 때만 기록 — 실패하면 다음 재알림 때 다시 시도
        renderRanked(data);
      })
      .catch(function () {
        root.innerHTML = '<p class="note">불러오지 못했습니다. 새로고침해 주세요.</p>';
      });
  }

  if (window.NaToGam && window.NaToGam.auth) {
    window.NaToGam.auth.onChange(render);
  }
})();
