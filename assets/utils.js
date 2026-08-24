/* 나또감 — 공용 유틸
   · 등급 순위 · 방문/누적 금액 파생 계산 · 정렬 · 금액 포맷 · 실데이터 조회
   · window.NaToGam.utils에 붙는다. classic script이므로 utils.js는
     auth.js(module) / cardlist.js / rank.js보다 먼저 로드돼야 한다. */
(function () {
  'use strict';

  window.NaToGam = window.NaToGam || {};

  var GRADE_ORDER = ['S', 'A', 'B', 'C'];
  var GRADE_META = {
    S: { name: '인생맛집', short: '인생', cls: 'g-s' },
    A: { name: '맛집',     short: '맛집', cls: 'g-a' },
    B: { name: '무난',     short: '무난', cls: 'g-b' },
    C: { name: '비추',     short: '비추', cls: 'g-c' }
  };
  var GRADE_UNASSIGNED = { name: '미지정', short: '미지정', cls: 'g-u' };

  /* 등급 코드로 표시 정보를 가져온다. null/undefined/알 수 없는 코드는
     전부 "미지정"으로 취급한다 — 담기만 하고 등급을 아직 안 준 가게. */
  function gradeMeta(code) {
    return GRADE_META[code] || GRADE_UNASSIGNED;
  }

  /* 등급 코드 → 순위 인덱스. 0이 최상위(인생맛집).
     미지정(null 등)은 맨 뒤로 보낸다. */
  function gradeRank(code) {
    var i = GRADE_ORDER.indexOf(code);
    return i === -1 ? GRADE_ORDER.length : i;
  }

  /* 방문 횟수 — Visit 배열 길이 그대로. 별도로 저장하지 않는다(PRD §4.2). */
  function visitCount(restaurant) {
    return (restaurant.visits || []).length;
  }

  /* 누적 금액 — 방문별 금액을 인원수(split_count, 기본 1)로 나눠 합산한다.
     "일행과 방문 시 n분의 1로 계산해서 표시" 요구사항의 계산부. */
  function totalSpent(restaurant) {
    var visits = restaurant.visits || [];
    var sum = 0;
    for (var i = 0; i < visits.length; i++) {
      var v = visits[i];
      var n = v.split_count || 1;
      sum += v.amount / n;
    }
    return Math.round(sum);
  }

  /* 정렬 비교자 — 등급 tier 우선 → 방문 횟수 내림차순 → 누적 금액 내림차순
     → 마지막으로 id 비교(결정성 보장). */
  function compareRestaurants(a, b) {
    var gr = gradeRank(a.grade) - gradeRank(b.grade);
    if (gr !== 0) return gr;

    var vc = visitCount(b) - visitCount(a);
    if (vc !== 0) return vc;

    var sp = totalSpent(b) - totalSpent(a);
    if (sp !== 0) return sp;

    return a.id < b.id ? -1 : (a.id > b.id ? 1 : 0);
  }

  /* 원 → 만원 단위 축약. DESIGN §4.3 */
  function formatWon(won) {
    var man = Math.round(won / 10000);
    return man.toLocaleString('ko-KR') + '만원';
  }

  function formatVisits(n) {
    return n + '회';
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* 로그인한 사용자가 담은 가게 + 각 가게의 방문 기록을 함께 가져온다.
     saved_restaurants가 Restaurant, visits가 그 위에 쌓이는 방문 기록이다
     (§4.2 원칙대로 visit_count/total_spent는 저장하지 않고 여기서 조립만 함).
     cardlist.js/rank.js가 공통으로 쓰므로 여기 하나로 모아둔다. */
  function fetchMyRestaurants(supabase, userId) {
    return supabase
      .from('saved_restaurants')
      .select('id,name,grade,address,category,visits(id,visited_at,amount,split_count,memo)')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .then(function (res) {
        if (res.error) return Promise.reject(res.error);
        return res.data || [];
      });
  }

  window.NaToGam.utils = {
    GRADE_ORDER: GRADE_ORDER,
    GRADE_META: GRADE_META,
    gradeMeta: gradeMeta,
    gradeRank: gradeRank,
    visitCount: visitCount,
    totalSpent: totalSpent,
    compareRestaurants: compareRestaurants,
    formatWon: formatWon,
    formatVisits: formatVisits,
    escapeHtml: escapeHtml,
    fetchMyRestaurants: fetchMyRestaurants
  };
})();
