/* 나또감 — 검색 페이지
   카카오 검색과 구글 리뷰 조회 모두 Vercel 서버리스 함수(/api/*)를 거친다.
   API 키는 서버 환경변수에만 있고 클라이언트로 전달되지 않으므로,
   방문자는 키 입력 없이 바로 검색/리뷰 조회를 쓸 수 있다. */
(function () {
  'use strict';

  var searchForm, searchInput, searchBtn, searchEmpty, resultList, reviewPanel;

  var results = [];   // 최근 검색 결과 (계약 객체 배열)

  function $(id) { return document.getElementById(id); }

  /* ── HTML 이스케이프 ── */
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ── 카카오 검색 (/api/kakao-search 프록시) ── */
  function renderResults(list) {
    results = list;
    var html = list.map(function (place, idx) {
      return '<li><button type="button" class="result-item" aria-expanded="false" data-idx="' + idx + '">' +
        '<span class="rname">' + escapeHtml(place.name) + '</span>' +
        '<span class="raddr">' + escapeHtml(place.address) + '</span>' +
        '</button></li>';
    }).join('');
    resultList.innerHTML = html;
    resultList.hidden = false;
    searchEmpty.hidden = true;
  }

  function renderMessage(msg) {
    results = [];
    resultList.hidden = true;
    resultList.innerHTML = '';
    searchEmpty.textContent = msg;
    searchEmpty.hidden = false;
  }

  function runKakaoSearch(query) {
    if (!query) return;

    fetch('/api/kakao-search?query=' + encodeURIComponent(query))
      .then(function (res) {
        if (!res.ok) return Promise.reject();
        return res.json();
      })
      .then(function (data) {
        var list = data.results || [];
        if (list.length === 0) {
          renderMessage('검색 결과가 없습니다');
        } else {
          renderResults(list);
        }
      })
      .catch(function () {
        renderMessage('검색 중 오류가 발생했습니다');
      });
  }

  /* ── 리뷰 캐시 (localStorage, 만료 없음 — 같은 가게 재클릭시 재요청 안 함) ── */
  function cacheKey(placeId) { return 'naddogam:review:' + placeId; }

  function readReviewCache(placeId) {
    try {
      var raw = localStorage.getItem(cacheKey(placeId));
      if (!raw) return null;
      var obj = JSON.parse(raw);
      return (obj && obj.schemaVersion === 1) ? obj : null;
    } catch (e) { return null; }
  }

  function writeReviewCache(placeId, data) {
    try { localStorage.setItem(cacheKey(placeId), JSON.stringify(data)); } catch (e) { /* quota 등 — best effort */ }
  }

  /* ── 구글 리뷰 조회 (/api/google-review 프록시) ── */
  function fetchGoogleReview(place) {
    var url = '/api/google-review?name=' + encodeURIComponent(place.name) +
      '&lat=' + encodeURIComponent(place.lat) + '&lng=' + encodeURIComponent(place.lng);

    return fetch(url).then(function (res) {
      if (res.status === 404) return Promise.reject({ kind: 'no-match' });
      if (!res.ok) return Promise.reject({ kind: 'request-failed' });
      return res.json().then(function (json) {
        return {
          schemaVersion: 1,
          cachedAt: Date.now(),
          placeName: json.placeName,
          reviewCount: json.reviewCount,
          reviews: json.reviews,
          mapsUri: json.mapsUri
        };
      });
    });
  }

  /* ── 리뷰 패널 닫기 ── */
  function closeReviewPanel() {
    reviewPanel.hidden = true;
    reviewPanel.innerHTML = '';
    var prev = resultList.querySelector('.result-item[aria-expanded="true"]');
    if (prev) prev.setAttribute('aria-expanded', 'false');
  }

  /* ── 리뷰 패널 렌더링 ── */
  function renderReviewLoading() {
    reviewPanel.hidden = false;
    reviewPanel.innerHTML = '<p class="review-loading">리뷰를 불러오는 중 ...</p>';
  }

  function renderReviewError(msg) {
    reviewPanel.hidden = false;
    reviewPanel.innerHTML =
      '<button type="button" class="btn-ghost" id="reviewCloseBtn">✕ 닫기</button>' +
      '<p class="review-error">' + escapeHtml(msg) + '</p>';
    reviewPanel.focus();
  }

  function renderReviewPanel(data) {
    var html = '<button type="button" class="btn-ghost" id="reviewCloseBtn">✕ 닫기</button>';

    html += '<div class="review-head"><h3>' + escapeHtml(data.placeName) + '</h3>' +
      '<span class="label">리뷰 ' + data.reviewCount + '개 · 최근 리뷰 최대 5개 표시</span></div>';

    if (!data.reviews || data.reviews.length === 0) {
      html += '<ul class="review-list"><li><p class="rv-text">등록된 리뷰 내용이 없습니다</p></li></ul>';
    } else {
      html += '<ul class="review-list">' + data.reviews.map(function (r) {
        return '<li>' +
          '<span class="rv-author">' + escapeHtml(r.author) + '</span>' +
          '<span class="rv-time">' + escapeHtml(r.relativeTime) + '</span>' +
          '<p class="rv-text">' + escapeHtml(r.text) + '</p>' +
          '</li>';
      }).join('') + '</ul>';
    }

    if (data.mapsUri && /^https?:\/\//.test(data.mapsUri)) {
      html += '<a class="more" href="' + data.mapsUri + '" target="_blank" rel="noopener">전체 리뷰 보기 →</a>';
    }

    reviewPanel.hidden = false;
    reviewPanel.innerHTML = html;
    reviewPanel.focus();
  }

  /* ── 리뷰 패널 연결부 ── */
  function openReviewPanel(place) {
    var cached = readReviewCache(place.id);
    if (cached) { renderReviewPanel(cached); return; }

    renderReviewLoading();
    fetchGoogleReview(place)
      .then(function (result) {
        writeReviewCache(place.id, result);
        renderReviewPanel(result);
      })
      .catch(function (err) {
        if (err && err.kind === 'no-match') {
          renderReviewError('해당 위치 안에서 가게를 찾지 못함');
        } else {
          renderReviewError('리뷰 조회에 실패했습니다. 잠시 후 다시 시도해 주세요.');
        }
      });
  }

  /* ── 결과 목록 클릭 위임 ── */
  function onResultListClick(e) {
    var btn = e.target.closest ? e.target.closest('.result-item') : null;
    if (!btn || !resultList.contains(btn)) return;

    var prev = resultList.querySelector('.result-item[aria-expanded="true"]');
    if (prev && prev !== btn) prev.setAttribute('aria-expanded', 'false');

    btn.setAttribute('aria-expanded', 'true');

    var idx = Number(btn.dataset.idx);
    var place = results[idx];
    if (place) openReviewPanel(place);
  }

  /* ── 리뷰 패널 클릭 위임(닫기 버튼) ── */
  function onReviewPanelClick(e) {
    var btn = e.target.closest ? e.target.closest('#reviewCloseBtn') : null;
    if (!btn) return;
    closeReviewPanel();
  }

  /* ── 초기화 ── */
  function init() {
    searchForm = $('searchForm');
    searchInput = $('searchInput');
    searchBtn = $('searchBtn');
    searchEmpty = $('searchEmpty');
    resultList = $('resultList');
    reviewPanel = $('reviewPanel');

    resultList.addEventListener('click', onResultListClick);
    reviewPanel.addEventListener('click', onReviewPanelClick);

    searchForm.addEventListener('submit', function (e) {
      e.preventDefault();
      runKakaoSearch(searchInput.value.trim());
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
