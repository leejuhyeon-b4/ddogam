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

  /* ── AI 분석 캐시 (localStorage, 만료 없음 — 무료 사용량 아끼기) ── */
  function analysisCacheKey(placeId) { return 'naddogam:analysis:' + placeId; }

  function readAnalysisCache(placeId) {
    try {
      var raw = localStorage.getItem(analysisCacheKey(placeId));
      if (!raw) return null;
      var obj = JSON.parse(raw);
      return (obj && obj.schemaVersion === 1) ? obj : null;
    } catch (e) { return null; }
  }

  function writeAnalysisCache(placeId, data) {
    try { localStorage.setItem(analysisCacheKey(placeId), JSON.stringify(data)); } catch (e) { /* best effort */ }
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

  /* ── AI 리뷰 분석 (/api/analyze-reviews 프록시, 제미나이) ── */
  function fetchAiAnalysis(reviewData) {
    return fetch('/api/analyze-reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ placeName: reviewData.placeName, reviews: reviewData.reviews })
    }).then(function (res) {
      if (!res.ok) return Promise.reject();
      return res.json();
    });
  }

  function renderAiLoading(container) {
    container.innerHTML = '<p class="ai-loading">AI가 리뷰를 분석 하는중…</p>';
  }

  function renderAiError(container, msg) {
    container.innerHTML = '<p class="ai-error">' + escapeHtml(msg) + '</p>';
  }

  function drawWordcloud(canvas, keywords) {
    if (!canvas || !window.WordCloud || !keywords || keywords.length === 0) return;

    var contextByWord = {};
    keywords.forEach(function (k) { contextByWord[k.word] = k.context; });

    var displayWidth = canvas.clientWidth || 480;
    canvas.width = displayWidth;
    canvas.height = 220;

    window.WordCloud(canvas, {
      list: keywords.map(function (k) { return [k.word, k.score]; }),
      weightFactor: function (size) { return 6 + size * 5; },
      color: function (word) {
        return contextByWord[word] === 'negative' ? '#c0392b' : '#2f8f4e';
      },
      backgroundColor: 'transparent',
      rotateRatio: 0,
      gridSize: 8,
      fontFamily: "'Pretendard Variable', sans-serif"
    });
  }

  function renderAiResult(container, data) {
    var c = data.sentimentCounts || { positive: 0, neutral: 0, negative: 0 };
    var total = (c.positive + c.neutral + c.negative) || 1;
    var pPct = Math.round(c.positive / total * 100);
    var neuPct = Math.round(c.neutral / total * 100);
    var negPct = Math.max(0, 100 - pPct - neuPct);

    var html = '<div class="ai-sentiment">' +
      '<div class="ai-sentiment-bar">' +
        '<span class="seg pos" style="flex-grow:' + pPct + '"></span>' +
        '<span class="seg neu" style="flex-grow:' + neuPct + '"></span>' +
        '<span class="seg neg" style="flex-grow:' + negPct + '"></span>' +
      '</div>' +
      '<div class="ai-sentiment-legend">' +
        '<span class="leg pos">긍정 ' + c.positive + '</span>' +
        '<span class="leg neu">보통 ' + c.neutral + '</span>' +
        '<span class="leg neg">부정 ' + c.negative + '</span>' +
      '</div>' +
    '</div>';

    html += '<canvas class="ai-wordcloud" id="aiWordcloud"></canvas>';

    html += '<div class="ai-summary"><p>' + escapeHtml(data.summary || '') + '</p></div>';

    container.innerHTML = html;
    drawWordcloud(container.querySelector('#aiWordcloud'), data.keywords || []);
  }

  /* 리뷰가 다 뜨면 자동으로 이어서 분석 시작. 리뷰 0개면 시도조차 하지 않는다. */
  function maybeRunAiAnalysis(place, reviewData) {
    if (!reviewData.reviews || reviewData.reviews.length === 0) return;

    var container = document.getElementById('aiAnalysis');
    if (!container) return;

    var cached = readAnalysisCache(place.id);
    if (cached) { renderAiResult(container, cached); return; }

    renderAiLoading(container);
    fetchAiAnalysis(reviewData)
      .then(function (result) {
        var toCache = {
          schemaVersion: 1,
          cachedAt: Date.now(),
          sentimentCounts: result.sentimentCounts,
          keywords: result.keywords,
          summary: result.summary
        };
        writeAnalysisCache(place.id, toCache);
        renderAiResult(container, toCache);
      })
      .catch(function () {
        renderAiError(container, 'AI 분석에 실패했습니다.');
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

    /* 리뷰가 하나도 없는 가게는 분석 영역 자체를 만들지 않는다 */
    if (data.reviews && data.reviews.length > 0) {
      html += '<div class="ai-analysis" id="aiAnalysis"></div>';
    }

    reviewPanel.hidden = false;
    reviewPanel.innerHTML = html;
    reviewPanel.focus();
  }

  /* ── 리뷰 패널 연결부 ── */
  function openReviewPanel(place) {
    var cached = readReviewCache(place.id);
    if (cached) {
      renderReviewPanel(cached);
      maybeRunAiAnalysis(place, cached);
      return;
    }

    renderReviewLoading();
    fetchGoogleReview(place)
      .then(function (result) {
        writeReviewCache(place.id, result);
        renderReviewPanel(result);
        maybeRunAiAnalysis(place, result);
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
