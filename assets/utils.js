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

  /* 원 → 만원 단위 축약. DESIGN §4.3. 여러 방문을 합친 누적 총액처럼
     큰 금액을 간략히 보여줄 때만 쓴다 — 방문 1건의 n분의1 금액처럼
     작은 값을 이걸로 보여주면 반올림 때문에 15000/2=7500원이 "1만원"으로
     보이는 식으로 왜곡된다. 그런 값은 formatWonExact를 쓴다. */
  function formatWon(won) {
    var man = Math.round(won / 10000);
    return man.toLocaleString('ko-KR') + '만원';
  }

  /* 원 단위 그대로, 반올림 없이(가능한 만큼) 정확히 표시. 1원 미만
     나머지만 정수 원 단위로 맞춘다(원 이하 화폐 단위가 없어서 불가피함) —
     "15000원을 2명이 나누면 7500원"처럼 딱 떨어지는 값은 그대로 나온다. */
  function formatWonExact(won) {
    return Math.round(won).toLocaleString('ko-KR') + '원';
  }

  /* 방문 한 건의 1인당 금액 — amount ÷ split_count. */
  function splitAmount(visit) {
    return visit.amount / (visit.split_count || 1);
  }

  function formatVisits(n) {
    return n + '회';
  }

  /* 카카오 category_name은 "음식점 > 양식 > 이탈리안"처럼 대분류 경로
     문자열이다. 맞춤 추천이 비교할 saved_places.category는 "양식"·"카페"
     같은 단순 라벨이라 그대로는 거의 매칭이 안 된다 — 경로의 두 번째
     조각(대개 "음식점"/"카페" 다음)을 단순 카테고리로 뽑아 맞춘다. */
  function simplifyCategory(raw) {
    if (!raw) return null;
    var parts = String(raw).split('>').map(function (s) { return s.trim(); }).filter(Boolean);
    if (parts.length === 0) return null;
    return parts.length > 1 ? parts[1] : parts[0];
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
     user_id로 따로 걸러 달라고 하지 않는다 — RLS(select_own_saved_restaurants)가
     이미 "내 행만" 돌려주므로 전체를 요청해도 결과는 내 것뿐이다.
     cardlist.js/rank.js가 공통으로 쓰므로 여기 하나로 모아둔다. */
  function fetchMyRestaurants(supabase) {
    return supabase
      .from('saved_restaurants')
      .select('id,name,grade,address,category,visits(id,visited_at,amount,split_count,memo)')
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
    formatWonExact: formatWonExact,
    splitAmount: splitAmount,
    formatVisits: formatVisits,
    escapeHtml: escapeHtml,
    simplifyCategory: simplifyCategory,
    fetchMyRestaurants: fetchMyRestaurants
  };
})();
