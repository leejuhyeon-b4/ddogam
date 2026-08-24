/* 나또감 — 랭킹 페이지
   · 정렬: 등급 tier 우선 → 방문 횟수 내림차순 → 누적 금액 내림차순
     (window.NaToGam.utils.compareRestaurants, assets/utils.js)
   · 상위 3곳은 포디움(ref/rank.jpg 참고, 2위-1위-3위 순으로 배치),
     4위부터는 순번 리스트.
   · 사진이 없으므로 아바타는 등급 재질 텍스처 위에 식당명 첫 글자를 얹는다.
   · 실제 저장 기능이 아직 없어 window.NaToGam.mockData의 목업 데이터로
     그린다. 로그인 여부와 무관하게 동일한 결과를 보여주므로 이 페이지는
     로그인 게이트를 걸지 않는다(auth.js는 헤더 로그인 영역 표시용으로만 로드).
   · classic script — assets/utils.js, assets/mock-data.js보다 뒤에 로드한다. */
(function () {
  'use strict';

  var root = document.getElementById('rankRoot');
  if (!root) return;

  var utils = window.NaToGam.utils;
  var restaurants = (window.NaToGam.mockData && window.NaToGam.mockData.restaurants) || [];

  function monogram(name) {
    var s = (name || '').trim();
    return utils.escapeHtml(s ? s.charAt(0) : '?');
  }

  function wonMan(restaurant) {
    return Math.round(utils.totalSpent(restaurant) / 10000).toLocaleString('ko-KR');
  }

  /* ── 포디움 카드 한 장 ── */
  function podiumItemHTML(r, rankIndex) {
    var meta = utils.GRADE_META[r.grade];
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
      var meta = utils.GRADE_META[r.grade];
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

  function render() {
    if (!utils || restaurants.length === 0) {
      root.innerHTML = '<p class="note">아직 랭킹을 매길 데이터가 없습니다.</p>';
      return;
    }

    var ranked = restaurants.slice().sort(utils.compareRestaurants);
    var top3 = ranked.slice(0, 3);
    var rest = ranked.slice(3);

    root.innerHTML = renderPodium(top3) + renderList(rest, 4);
  }

  render();
})();
