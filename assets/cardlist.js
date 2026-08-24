/* 나또감 — 내 카드 도감(판) 페이지
   · saved_restaurants(담은 가게) + visits(방문 기록) 실데이터를 등급별
     구역(board-zone)에 배치해 보여준다. 카드를 누르면 관리 모달이 열려
     등급을 정하거나 방문(날짜·금액·인원수)을 추가/삭제할 수 있다.
   · window.NaToGam.auth(assets/auth.js)가 먼저 실행돼 있어야 하므로
     cardlist.html에서 이 스크립트는 auth.js 다음에 로드한다.
   · window.NaToGam.utils(classic script)는 이 파일보다 먼저 로드돼 있어야 한다. */
(function () {
  'use strict';

  var root = document.getElementById('cardlistRoot');
  if (!root) return;

  var utils = window.NaToGam.utils;
  var restaurants = [];   // 로그인한 사용자가 담은 가게 + 방문 기록(실데이터)
  var currentUser = null;
  var loadedUserId = null;   // 마지막으로 실제 데이터를 불러온 사용자 id

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

  /* ── 카드 한 장 — 5분할, 누르면 관리 모달이 열린다 ── */
  function card5HTML(restaurant) {
    var meta = utils.gradeMeta(restaurant.grade);
    var visits = utils.visitCount(restaurant);
    var spentMan = Math.round(utils.totalSpent(restaurant) / 10000).toLocaleString('ko-KR');
    var name = utils.escapeHtml(restaurant.name);

    return '<button type="button" class="card5" data-id="' + restaurant.id + '" aria-label="' + name + ' 관리">' +
        '<span class="c5-name"><span class="cname">' + name + '</span></span>' +
        '<span class="c5-image" aria-hidden="true"></span>' +
        '<span class="c5-grade"><span class="c5-grade-name">' + meta.name + '</span></span>' +
        '<span class="c5-visits"><span class="st-k">방문</span><b>' + visits + '</b><i>회</i></span>' +
        '<span class="c5-spent"><span class="st-k">누적</span><b>' + spentMan + '</b><i>만원</i></span>' +
      '</button>';
  }

  function emptySlotHTML() {
    return '<div class="board-slot-empty"><span>아직 등록한 맛집이 없습니다</span></div>';
  }

  /* ── 로그인 상태 — 등급 구역(S→A→B→C→미지정)으로 나눈 도감판 ── */
  function renderBoard() {
    var groups = utils.GRADE_ORDER.concat([null]);   // 마지막은 미지정(PRD §4.1 순서)
    var html = '<div class="board">';

    groups.forEach(function (code) {
      var meta = utils.gradeMeta(code);
      var group = restaurants.filter(function (r) {
        return code === null ? (r.grade == null) : r.grade === code;
      });

      group.sort(function (a, b) {
        var vc = utils.visitCount(b) - utils.visitCount(a);
        if (vc !== 0) return vc;
        return utils.totalSpent(b) - utils.totalSpent(a);
      });

      var zoneClass = code === null ? 'zone-u' : 'zone-' + code.toLowerCase();
      html += '<div class="board-zone ' + zoneClass + '">' +
          '<h3 class="board-zone-label">' + meta.name + '</h3>' +
          '<span class="board-zone-count">' + group.length + '곳</span>' +
          '<div class="board-grid">';

      if (group.length === 0) {
        html += emptySlotHTML();
      } else {
        group.forEach(function (r) { html += card5HTML(r); });
      }

      html += '</div></div>';
    });

    html += '</div>';
    root.innerHTML = html;
  }

  function renderLoggedIn() {
    root.innerHTML = '<p class="note">불러오는 중…</p>';
    utils.fetchMyRestaurants(window.NaToGam.auth.getClient(), currentUser.id)
      .then(function (data) {
        restaurants = data;
        loadedUserId = currentUser.id;
        renderBoard();
      })
      .catch(function () {
        root.innerHTML = '<p class="note">불러오지 못했습니다. 새로고침해 주세요.</p>';
      });
  }

  /* auth.onChange는 로그인/로그아웃뿐 아니라 토큰 자동 갱신 때도 다시
     불린다(같은 사용자). 그때마다 매번 다시 불러오면 화면이 "불러오는
     중…"으로 리셋되며 이미 보고 있던 카드/모달이 순간적으로 사라져
     로딩이 계속되는 것처럼 느껴진다 — 사용자가 실제로 바뀐 경우에만 다시 불러온다. */
  function render(user) {
    currentUser = user;
    if (!user) { loadedUserId = null; renderLoggedOut(); return; }
    if (user.id === loadedUserId) return;   // 같은 사용자의 재알림 — 무시
    renderLoggedIn();
  }

  /* 카드 클릭 → 관리 모달 */
  root.addEventListener('click', function (e) {
    var btn = e.target.closest ? e.target.closest('.card5') : null;
    if (!btn) return;
    var restaurant = restaurants.filter(function (r) { return r.id === btn.dataset.id; })[0];
    if (restaurant) openManageModal(restaurant.id);
  });

  /* ═══════════════════════════════════════════════
     관리 모달 — 등급 지정 · 방문 추가/삭제
     ═══════════════════════════════════════════════ */
  var manageOverlay, manageContent, manageRestaurantId;

  function todayISO() {
    var d = new Date();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  }

  function buildManageModal() {
    var overlay = document.createElement('div');
    overlay.className = 'manage-overlay';
    overlay.id = 'manageOverlay';
    overlay.hidden = true;
    overlay.innerHTML =
      '<div class="manage-modal" role="dialog" aria-modal="true" aria-labelledby="manageTitle">' +
        '<button type="button" class="manage-close" id="manageCloseBtn" aria-label="닫기">✕</button>' +
        '<div class="manage-content" id="manageContent"></div>' +
      '</div>';
    document.body.appendChild(overlay);

    manageOverlay = overlay;
    manageContent = overlay.querySelector('#manageContent');

    overlay.querySelector('#manageCloseBtn').addEventListener('click', closeManageModal);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeManageModal(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !overlay.hidden) closeManageModal();
    });

    /* 등급 버튼 · 등급 해제 · 방문 삭제 — 위임 처리 */
    overlay.addEventListener('click', function (e) {
      var gradeBtn = e.target.closest ? e.target.closest('.manage-grade-btn') : null;
      if (gradeBtn) { setGrade(gradeBtn.dataset.grade); return; }

      var clearBtn = e.target.closest ? e.target.closest('#manageGradeClear') : null;
      if (clearBtn) { setGrade(null); return; }

      var delBtn = e.target.closest ? e.target.closest('.manage-visit-del') : null;
      if (delBtn) { deleteVisit(delBtn.dataset.visitId); return; }
    });

    /* 방문 추가 폼 — submit은 버블링되므로 위임으로 받는다 */
    overlay.addEventListener('submit', function (e) {
      if (!e.target.closest || !e.target.closest('#manageVisitForm')) return;
      e.preventDefault();
      addVisit();
    });
  }

  function currentRestaurant() {
    return restaurants.filter(function (r) { return r.id === manageRestaurantId; })[0];
  }

  function renderManageContent() {
    var restaurant = currentRestaurant();
    if (!restaurant) { closeManageModal(); return; }

    var meta = utils.gradeMeta(restaurant.grade);
    var visits = restaurant.visits.slice().sort(function (a, b) {
      return a.visited_at < b.visited_at ? 1 : -1;   // 최근 방문이 위로
    });

    var html = '<h2 id="manageTitle">' + utils.escapeHtml(restaurant.name) + '</h2>';
    if (restaurant.address) html += '<p class="manage-addr">' + utils.escapeHtml(restaurant.address) + '</p>';

    html += '<div class="manage-grades" role="group" aria-label="등급 선택">';
    utils.GRADE_ORDER.forEach(function (code) {
      var gm = utils.gradeMeta(code);
      var active = restaurant.grade === code;
      html += '<button type="button" class="manage-grade-btn' + (active ? ' active' : '') + '" ' +
        'data-grade="' + code + '" aria-pressed="' + (active ? 'true' : 'false') + '">' + gm.name + '</button>';
    });
    html += '</div>';
    html += '<p class="manage-grade-current">현재: ' + meta.name +
      (restaurant.grade ? ' <button type="button" id="manageGradeClear" class="manage-grade-clear">등급 해제</button>' : '') +
      '</p>';

    html += '<h3>방문 기록 <span class="label">' + utils.formatVisits(visits.length) +
      ' · 누적 ' + utils.formatWon(utils.totalSpent(restaurant)) + '</span></h3>';

    html += '<form class="manage-visit-form" id="manageVisitForm">' +
        '<label class="manage-field"><span>날짜</span><input type="date" id="mvDate" value="' + todayISO() + '" required></label>' +
        '<label class="manage-field"><span>금액</span><input type="number" inputmode="numeric" min="0" id="mvAmount" placeholder="원" required></label>' +
        '<label class="manage-field manage-field--split"><span>인원수</span><input type="number" inputmode="numeric" min="1" id="mvSplit" value="1" required></label>' +
        '<button type="submit" class="btn-brass">추가</button>' +
      '</form>';

    if (visits.length === 0) {
      html += '<p class="note">아직 방문 기록이 없습니다.</p>';
    } else {
      html += '<ul class="manage-visit-list">' + visits.map(function (v) {
        var amountMan = Math.round((v.amount / (v.split_count || 1)) / 10000).toLocaleString('ko-KR');
        var splitNote = v.split_count > 1 ? ' (' + v.split_count + '명, ' + v.amount.toLocaleString('ko-KR') + '원 ÷ ' + v.split_count + ')' : '';
        return '<li>' +
            '<span class="mv-date">' + utils.escapeHtml(v.visited_at) + '</span>' +
            '<span class="mv-amount">' + amountMan + '만원<span class="mv-split">' + splitNote + '</span></span>' +
            '<button type="button" class="manage-visit-del" data-visit-id="' + v.id + '" aria-label="이 방문 기록 삭제">삭제</button>' +
          '</li>';
      }).join('') + '</ul>';
    }

    manageContent.innerHTML = html;
  }

  function openManageModal(restaurantId) {
    if (!manageOverlay) buildManageModal();
    manageRestaurantId = restaurantId;
    renderManageContent();
    manageOverlay.hidden = false;
  }

  function closeManageModal() {
    if (manageOverlay) manageOverlay.hidden = true;
    manageRestaurantId = null;
  }

  function setGrade(code) {
    var restaurant = currentRestaurant();
    if (!restaurant) return;

    var supabase = window.NaToGam.auth.getClient();
    supabase.from('saved_restaurants').update({ grade: code }).eq('id', restaurant.id)
      .then(function (res) {
        if (res.error) { console.error('등급 변경 실패:', res.error.message); return; }
        restaurant.grade = code;
        renderManageContent();
        renderBoard();
      });
  }

  function addVisit() {
    var restaurant = currentRestaurant();
    if (!restaurant) return;

    var dateEl = document.getElementById('mvDate');
    var amountEl = document.getElementById('mvAmount');
    var splitEl = document.getElementById('mvSplit');

    var visitedAt = dateEl.value;
    var amount = Number(amountEl.value);
    var splitCount = Math.max(1, Number(splitEl.value) || 1);

    if (!visitedAt || !amount || amount < 0) return;

    var supabase = window.NaToGam.auth.getClient();
    supabase.from('visits').insert({
      restaurant_id: restaurant.id,
      visited_at: visitedAt,
      amount: amount,
      split_count: splitCount
    }).select().then(function (res) {
      if (res.error || !res.data || !res.data[0]) {
        console.error('방문 추가 실패:', res.error && res.error.message);
        return;
      }
      restaurant.visits.push(res.data[0]);
      renderManageContent();
      renderBoard();
    });
  }

  function deleteVisit(visitId) {
    var restaurant = currentRestaurant();
    if (!restaurant) return;

    var supabase = window.NaToGam.auth.getClient();
    supabase.from('visits').delete().eq('id', visitId)
      .then(function (res) {
        if (res.error) { console.error('방문 삭제 실패:', res.error.message); return; }
        restaurant.visits = restaurant.visits.filter(function (v) { return v.id !== visitId; });
        renderManageContent();
        renderBoard();
      });
  }

  if (window.NaToGam && window.NaToGam.auth) {
    window.NaToGam.auth.onChange(render);
  }
})();
