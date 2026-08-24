/* 나또감 — 담기(찜) 기능
   · saved_restaurants 테이블에 대한 담기/취소를 전담한다.
   · 로그인 여부 확인과 로그인 모달은 assets/auth.js의
     window.NaToGam.auth를 그대로 가져다 쓴다 (새로 안 만듦).
   · 로드 순서: auth.js → save.js → search.js
     (search.js가 window.NaToGam.save를 참조하므로 이 순서가 중요하다)
   · 단, auth.js는 type="module"이라 이 classic 스크립트보다 실제 실행이
     늦다(모듈은 파싱이 끝난 뒤로 지연 실행됨). 그래서 아래 구독 코드는
     window.NaToGam.auth가 나타날 때까지 짧게 재시도한다 — 그냥 한 번만
     확인하면 이 스크립트가 먼저 돌 때 auth가 아직 없어 구독 자체가
     누락된다. */
(function () {
  'use strict';

  window.NaToGam = window.NaToGam || {};

  var TABLE = 'saved_restaurants';
  var savedIds = new Set();   // 로그인한 사용자가 담은 place_id 목록
  var listeners = [];         // savedIds가 바뀔 때마다 알림받을 콜백들

  function notify() {
    listeners.forEach(function (cb) {
      try { cb(savedIds); } catch (e) { /* 구독자 오류는 여기서 삼킨다 */ }
    });
  }

  /* 로그인/로그아웃/새로고침 복원 때마다 담은 목록을 다시 불러온다.
     RLS가 본인 행만 돌려주므로 여기서 user_id로 따로 거를 필요 없다. */
  function loadSavedIds() {
    var auth = window.NaToGam.auth;
    if (!auth || !auth.isLoggedIn()) {
      savedIds = new Set();
      notify();
      return;
    }

    var supabase = auth.getClient();
    supabase.from(TABLE).select('place_id').then(function (res) {
      if (res.error) {
        console.error('담은 가게 목록 로드 실패:', res.error.message);
        savedIds = new Set();
      } else {
        savedIds = new Set((res.data || []).map(function (row) { return row.place_id; }));
      }
      notify();
    });
  }

  /* place: { id, name, category, address, lat, lng } — search.js의 카카오 검색 결과 형태를 그대로 받는다 */
  function toggle(place) {
    var auth = window.NaToGam.auth;
    if (!auth || !auth.isLoggedIn()) {
      return Promise.resolve({ status: 'need_login' });
    }

    var supabase = auth.getClient();
    var placeId = place.id;
    var wasSaved = savedIds.has(placeId);

    /* 낙관적 업데이트 — 응답 기다리지 않고 먼저 반영, 실패하면 되돌린다 */
    if (wasSaved) savedIds.delete(placeId); else savedIds.add(placeId);
    notify();

    if (wasSaved) {
      return supabase.from(TABLE).delete().eq('place_id', placeId)
        .then(function (res) {
          if (res.error) {
            savedIds.add(placeId); notify(); // 롤백
            console.error('담기 취소 실패:', res.error.message);
            return { status: 'error' };
          }
          return { status: 'unsaved' };
        });
    }

    return supabase.from(TABLE).insert({
      place_id: placeId,
      name: place.name || '',
      category: place.category || null,
      address: place.address || null,
      lat: place.lat != null ? place.lat : null,
      lng: place.lng != null ? place.lng : null
      /* user_id는 테이블의 default auth.uid()가 자동으로 채운다 */
    }).then(function (res) {
      if (res.error) {
        /* 23505 = unique(user_id, place_id) 위반 = 이미 담겨있던 경우.
           오류로 취급하지 않고 담김 상태로 정리한다 (화면과 서버 상태가 꼬였을 때 보정). */
        if (res.error.code === '23505') {
          savedIds.add(placeId); notify();
          return { status: 'saved' };
        }
        savedIds.delete(placeId); notify(); // 롤백
        console.error('담기 실패:', res.error.message);
        return { status: 'error' };
      }
      return { status: 'saved' };
    });
  }

  /* ── 다른 파일이 가져다 쓰는 공개 API ──────────────
     window.NaToGam.save.isSaved(placeId) → boolean, 검색 결과 카드 초기 표시용
     window.NaToGam.save.toggle(place)    → Promise<{status}>, 담기/취소 버튼 클릭용
     window.NaToGam.save.onChange(cb)     → savedIds가 바뀔 때마다 cb(savedIds) 호출 */
  window.NaToGam.save = {
    isSaved: function (placeId) { return savedIds.has(placeId); },
    toggle: toggle,
    onChange: function (cb) { if (typeof cb === 'function') listeners.push(cb); }
  };

  /* window.NaToGam.auth가 나타날 때까지 재시도 → 나타나면 현재 로그인
     상태를 즉시 한 번 반영하고, 이후 로그인/로그아웃 변화는 onChange로 받는다. */
  function waitForAuth() {
    if (!window.NaToGam.auth) { window.setTimeout(waitForAuth, 30); return; }
    loadSavedIds();
    window.NaToGam.auth.onChange(loadSavedIds);
  }
  waitForAuth();
})();
