/* 나또감 — 홈(index.html) 추천 두 코너
   1) 인기 랭킹 — 모든 사용자가 담은 걸 합쳐 가장 많이 담긴 가게 top5.
      Supabase의 popular_restaurants() RPC(SECURITY DEFINER, saved_restaurants의
      RLS를 우회하지 않고 "가게 이름·담긴 횟수"만 좁게 내보내는 전용 창구
      함수)를 호출한다. 로그인 여부와 무관하게 누구나 볼 수 있다.
   2) 맞춤 추천 — 로그인한 사용자가 담은 가게들의 카테고리 중 가장 자주
      담은 카테고리를 찾아, saved_places(추천 후보용 더미 카탈로그, 100건)에서
      같은 카테고리의 다른 가게를 추천한다. 이미 담은 가게는 이름으로 걸러낸다.
      saved_places는 이 추천 기능 전용이며 개인 카드목록·랭킹과는 무관하다.
   · window.NaToGam.auth(assets/auth.js)가 먼저 실행돼 있어야 하므로
     index.html에서 이 스크립트는 auth.js 다음에 로드한다(type="module"). */
(function () {
  'use strict';

  var utils = window.NaToGam.utils;
  var popularRoot = document.getElementById('popularRoot');
  var recommendRoot = document.getElementById('recommendRoot');

  function esc(s) { return utils ? utils.escapeHtml(s) : String(s == null ? '' : s); }

  /* ── 1) 인기 랭킹 — 공개, 로그인 불필요 ── */
  function loadPopular() {
    if (!popularRoot) return;

    var supabase = window.NaToGam.auth.getClient();
    utils.withTimeout(supabase.rpc('popular_restaurants', { limit_count: 5 }), 10000)
      .then(function (res) {
        if (res.error) return Promise.reject(res.error);
        var rows = res.data || [];
        if (rows.length === 0) {
          popularRoot.innerHTML = '<p class="note">아직 담긴 가게가 없습니다.</p>';
          return;
        }
        popularRoot.innerHTML = '<ol class="popular-list">' + rows.map(function (row, i) {
          return '<li class="popular-item">' +
              '<span class="popular-rank">' + (i + 1) + '</span>' +
              '<span class="popular-name">' + esc(row.name) + '</span>' +
              '<span class="popular-count">' + row.save_count + '명이 담음</span>' +
            '</li>';
        }).join('') + '</ol>';
      })
      .catch(function (err) {
        console.error('인기 랭킹 불러오기 실패:', err && err.message);
        popularRoot.innerHTML = '<p class="note">불러오지 못했습니다.</p>';
      });
  }

  /* ── 2) 맞춤 추천 — 로그인 후에만 ── */
  function renderRecommendLoggedOut() {
    if (!recommendRoot) return;
    recommendRoot.innerHTML = '<p class="lede">로그인하면 내가 자주 담는 카테고리에서 새 가게를 추천해드려요.</p>';
  }

  function renderRecommendEmpty(msg) {
    recommendRoot.innerHTML = '<p class="note">' + esc(msg) + '</p>';
  }

  /* 카카오 category_name(예: "음식점 > 양식 > 이탈리안")을 saved_places.category
     같은 단순 라벨("양식")로 뭉쳐서 가장 많이 담은 카테고리를 찾는다. */
  function topCategoryOf(myRestaurants) {
    var counts = {};
    myRestaurants.forEach(function (r) {
      var cat = utils.simplifyCategory(r.category);
      if (!cat) return;
      counts[cat] = (counts[cat] || 0) + 1;
    });
    var best = null;
    Object.keys(counts).forEach(function (cat) {
      if (!best || counts[cat] > counts[best]) best = cat;
    });
    return best;
  }

  /* onSettled(success) — success=true는 "정상적으로 끝까지 처리됨"(추천이
     비어있는 정상 상태 포함), false는 실제 오류라 다음 auth 재알림 때
     다시 시도해야 함을 뜻한다. 둘 다 로딩 표시는 걷어낸다. */
  function loadRecommend(user, onSettled) {
    if (!recommendRoot) { onSettled(false); return; }
    var supabase = window.NaToGam.auth.getClient();

    utils.fetchMyRestaurants(supabase)
      .then(function (mine) {
        if (mine.length === 0) { renderRecommendEmpty('담은 가게가 쌓이면 추천이 열립니다.'); onSettled(true); return; }

        var topCategory = topCategoryOf(mine);
        if (!topCategory) { renderRecommendEmpty('가게에 카테고리 정보가 없어 추천을 만들 수 없습니다.'); onSettled(true); return; }

        var savedNames = {};
        mine.forEach(function (r) { savedNames[r.name] = true; });

        utils.withTimeout(
          supabase.from('saved_places').select('id,name,category,address').eq('category', topCategory).limit(30),
          10000
        )
          .then(function (res) {
            if (res.error) return Promise.reject(res.error);
            var candidates = (res.data || [])
              .filter(function (p) { return !savedNames[p.name]; })
              .slice(0, 5);

            if (candidates.length === 0) { renderRecommendEmpty('"' + topCategory + '" 카테고리에서 더 추천할 가게가 없습니다.'); onSettled(true); return; }

            recommendRoot.innerHTML =
              '<p class="lede">자주 담는 <b>' + esc(topCategory) + '</b> 카테고리에서 골라봤어요.</p>' +
              '<ul class="recommend-list">' + candidates.map(function (p) {
                return '<li class="recommend-item">' +
                    '<span class="rname">' + esc(p.name) + '</span>' +
                    '<span class="raddr">' + esc(p.address || '') + '</span>' +
                  '</li>';
              }).join('') + '</ul>';
            onSettled(true);
          })
          .catch(function (err) {
            console.error('맞춤 추천 후보 불러오기 실패:', err && err.message);
            renderRecommendEmpty('추천을 불러오지 못했습니다.');
            onSettled(false);
          });
      })
      .catch(function (err) {
        console.error('맞춤 추천용 내 가게 불러오기 실패:', err && err.message);
        renderRecommendEmpty('추천을 불러오지 못했습니다.');
        onSettled(false);
      });
  }

  /* auth.onChange는 토큰 자동 갱신 때도 같은 사용자로 다시 불린다 —
     실제로 사용자가 바뀐 경우에만 다시 불러온다(cardlist.js/rank.js와 동일 패턴).
     loadedUserId는 성공했을 때만 기록하고, loadingUserId로 중복 요청도 막는다. */
  var loadedUserId = null;
  var loadingUserId = null;
  var everRendered = false;   // 파수꾼 타이머가 "아직 한 번도 안 불림"을 판단하는 기준

  function renderRecommend(user) {
    everRendered = true;
    if (!user) { loadedUserId = null; loadingUserId = null; renderRecommendLoggedOut(); return; }
    if (user.id === loadedUserId || user.id === loadingUserId) return;
    loadingUserId = user.id;
    loadRecommend(user, function (success) {
      loadingUserId = null;
      if (success) loadedUserId = user.id;
    });
  }

  loadPopular();

  /* 파수꾼 — auth.onChange가 무슨 이유로든 한 번도 안 불리면 "맞춤 추천"
     칸의 정적 "불러오는 중…"이 영원히 그대로 남는다. */
  if (recommendRoot) {
    window.setTimeout(function () {
      if (everRendered) return;
      recommendRoot.innerHTML = '<p class="note">불러오는 데 너무 오래 걸리고 있어요.</p>' +
        '<button type="button" class="btn-ghost" id="recommendWatchdogBtn">새로고침</button>';
      var btn = document.getElementById('recommendWatchdogBtn');
      if (btn) btn.addEventListener('click', function () { window.location.reload(); });
    }, 10000);

    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState !== 'visible' || everRendered) return;
      if (window.NaToGam && window.NaToGam.auth) renderRecommend(window.NaToGam.auth.getUser());
    });
  }

  if (window.NaToGam && window.NaToGam.auth) {
    window.NaToGam.auth.onChange(renderRecommend);
  }
})();
