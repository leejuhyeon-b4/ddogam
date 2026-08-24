/* 나또감 — 로그인 (Supabase Auth)
   · 이메일/비밀번호 로그인 · 회원가입(가입 즉시 로그인, 이메일 인증 대기 없음) · 로그아웃
   · 세션은 supabase-js가 localStorage에 저장 → 새로고침해도 로그인 상태 유지
   · 비밀번호 처리는 전부 Supabase에 맡긴다. 여기서는 절대 비밀번호를 저장/기록하지 않는다.

   다른 기능이 "지금 로그인한 사람이 누구인지" 확인할 때는 이 파일이 만드는
   window.NaToGam.auth 를 가져다 쓰면 된다 (예: 맛집 담기 버튼 → requireLogin()).

   · esm.sh는 진짜 코드 대신 "auth-js를 불러와라, postgrest-js를 불러와라…"
     하는 안내 파일만 주고, 그 하위 의존성들이 또 각자 자기 의존성을 연쇄로
     요청한다 — 실제로는 수십 개 요청이 순서대로(파일을 열어봐야 다음에
     뭘 받을지 알아서 병렬이 안 됨) 이어진다. 느린 회선에서 로그인 관련
     기능 전체가 멈춘 것처럼 보이던 원인이 이거였다. jsdelivr의 +esm은
     의존성을 전부 미리 번들링해서 파일 1개로 준다 — 그걸로 바꾼다. */
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.3/+esm';

(function () {
  'use strict';

  /* publishable(anon) 키는 브라우저에 그대로 노출되는 것이 정상이다.
     실제 데이터 접근 제어는 나중에 테이블을 만들 때 Supabase RLS로 건다. */
  var SUPABASE_URL = 'https://xdwvzkdanmfaszuzpkdf.supabase.co';
  var SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_WIJry5F3to4wzxcnHsEqtg_OXsch0e0';

  var supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

  var currentUser = null;
  var listeners = [];

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function displayName(user) {
    if (!user) return '';
    var email = user.email || '';
    return email.split('@')[0] || email;
  }

  function notifyListeners() {
    listeners.forEach(function (cb) {
      try { cb(currentUser); } catch (e) { /* 구독자 오류는 여기서 삼킨다 */ }
    });
  }

  /* ── 다른 기능이 가져다 쓰는 공개 API ──────────────
     window.NaToGam.auth.getUser()        → 현재 사용자(비로그인 시 null)
     window.NaToGam.auth.isLoggedIn()     → boolean
     window.NaToGam.auth.onChange(cb)     → 로그인 상태 바뀔 때마다 cb(user) 호출
     window.NaToGam.auth.requireLogin(cb) → 로그인 상태면 true, 아니면 로그인창을 띄우고 false
     window.NaToGam.auth.getClient()      → supabase 클라이언트(테이블 조회용) */
  window.NaToGam = window.NaToGam || {};
  window.NaToGam.auth = {
    getClient: function () { return supabase; },
    getUser: function () { return currentUser; },
    isLoggedIn: function () { return !!currentUser; },
    onChange: function (cb) { if (typeof cb === 'function') listeners.push(cb); },
    signOut: function () { return supabase.auth.signOut(); },
    openLoginModal: function () { openModal(); },
    requireLogin: function (onNeedLogin) {
      if (currentUser) return true;
      if (typeof onNeedLogin === 'function') onNeedLogin();
      openModal();
      return false;
    }
  };

  /* ── 헤더 로그인 영역 ── */
  function renderAuthArea() {
    var area = document.getElementById('authArea');
    if (!area) return;

    if (currentUser) {
      area.innerHTML =
        '<span class="auth-user">' +
          '<b>' + escapeHtml(displayName(currentUser)) + '</b>님 ' +
          '<button type="button" class="btn-logout" id="authLogoutBtn">로그아웃</button>' +
        '</span>';
      var logoutBtn = document.getElementById('authLogoutBtn');
      if (logoutBtn) logoutBtn.addEventListener('click', function () { supabase.auth.signOut(); });
    } else {
      area.innerHTML = '<button type="button" class="btn-login" id="authOpenBtn">로그인</button>';
      var openBtn = document.getElementById('authOpenBtn');
      if (openBtn) openBtn.addEventListener('click', openModal);
    }
  }

  /* ── 로그인/회원가입 모달 ── */
  var modalOverlay, modalEmail, modalPassword, modalError, modalForm, loginBtn, signupBtn;

  function buildModal() {
    var overlay = document.createElement('div');
    overlay.className = 'auth-overlay';
    overlay.id = 'authOverlay';
    overlay.hidden = true;
    overlay.innerHTML =
      '<div class="auth-modal" role="dialog" aria-modal="true" aria-labelledby="authModalTitle">' +
        '<button type="button" class="auth-close" id="authCloseBtn" aria-label="닫기">✕</button>' +
        '<h2 id="authModalTitle">로그인</h2>' +
        '<p class="auth-error" id="authError" hidden></p>' +
        '<form id="authForm" novalidate>' +
          '<label class="auth-field"><span>이메일</span>' +
            '<input type="email" id="authEmail" autocomplete="email"></label>' +
          '<label class="auth-field"><span>비밀번호</span>' +
            '<input type="password" id="authPassword" autocomplete="current-password"></label>' +
          '<div class="auth-actions">' +
            '<button type="submit" class="btn-brass" id="authLoginBtn">로그인</button>' +
            '<button type="button" class="btn-ghost" id="authSignupBtn">회원가입</button>' +
          '</div>' +
        '</form>' +
      '</div>';
    document.body.appendChild(overlay);

    modalOverlay = overlay;
    modalEmail = overlay.querySelector('#authEmail');
    modalPassword = overlay.querySelector('#authPassword');
    modalError = overlay.querySelector('#authError');
    modalForm = overlay.querySelector('#authForm');
    loginBtn = overlay.querySelector('#authLoginBtn');
    signupBtn = overlay.querySelector('#authSignupBtn');

    overlay.querySelector('#authCloseBtn').addEventListener('click', closeModal);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !overlay.hidden) closeModal();
    });

    modalForm.addEventListener('submit', function (e) { e.preventDefault(); handleLogin(); });
    signupBtn.addEventListener('click', handleSignup);
  }

  function openModal() {
    if (!modalOverlay) buildModal();
    clearError();
    modalForm.reset();
    modalOverlay.hidden = false;
    window.setTimeout(function () { modalEmail.focus(); }, 0);
  }

  function closeModal() {
    if (modalOverlay) modalOverlay.hidden = true;
  }

  function showError(msg) {
    modalError.textContent = msg;
    modalError.hidden = false;
  }

  function clearError() {
    modalError.hidden = true;
    modalError.textContent = '';
  }

  function setBusy(busy) {
    loginBtn.disabled = busy;
    signupBtn.disabled = busy;
    loginBtn.textContent = busy ? '처리 중…' : '로그인';
    signupBtn.textContent = busy ? '처리 중…' : '회원가입';
  }

  /* 클라이언트에서 먼저 걸러 서버 왕복 없이 바로 한국어 안내를 준다.
     비밀번호 6자 미만은 Supabase 기본 최소 길이와 맞춘 값이다. */
  function validate(email, password) {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return '올바른 이메일 형식이 아닙니다.';
    if (!password || password.length < 6) return '비밀번호는 6자 이상이어야 합니다.';
    return null;
  }

  /* Supabase 에러를 한국어 안내문구로 바꾼다. error.code(신) 우선,
     없으면 error.message(구) 문자열로 판별한다. */
  function mapAuthError(error, mode) {
    var code = (error && error.code) || '';
    var msg = (error && error.message) || '';

    if (code === 'invalid_credentials' || /invalid login credentials/i.test(msg)) {
      return '이메일 또는 비밀번호가 올바르지 않습니다.';
    }
    if (code === 'user_already_exists' || /already registered|already exists/i.test(msg)) {
      return '이미 가입된 이메일입니다.';
    }
    if (code === 'weak_password' || /password should be at least/i.test(msg)) {
      return '비밀번호는 6자 이상이어야 합니다.';
    }
    if (code === 'email_address_invalid' || /invalid format|invalid email/i.test(msg)) {
      return '올바른 이메일 형식이 아닙니다.';
    }
    if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit' || /rate limit/i.test(msg)) {
      return '잠시 후 다시 시도해 주세요.';
    }
    if (code === 'email_not_confirmed' || /email not confirmed/i.test(msg)) {
      return '이메일 인증이 필요합니다. 잠시 후 다시 시도해 주세요.';
    }
    return mode === 'signup'
      ? '회원가입에 실패했습니다. 잠시 후 다시 시도해 주세요.'
      : '로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.';
  }

  function handleLogin() {
    var email = modalEmail.value.trim();
    var password = modalPassword.value;
    var v = validate(email, password);
    if (v) { showError(v); return; }

    clearError();
    setBusy(true);
    supabase.auth.signInWithPassword({ email: email, password: password })
      .then(function (res) {
        if (res.error) return Promise.reject(res.error);
        closeModal();
      })
      .catch(function (err) { showError(mapAuthError(err, 'login')); })
      .then(function () { setBusy(false); }, function () { setBusy(false); });
  }

  function handleSignup() {
    var email = modalEmail.value.trim();
    var password = modalPassword.value;
    var v = validate(email, password);
    if (v) { showError(v); return; }

    clearError();
    setBusy(true);
    supabase.auth.signUp({ email: email, password: password })
      .then(function (res) {
        if (res.error) return Promise.reject(res.error);

        /* Supabase 프로젝트의 "Confirm email"이 꺼져 있으면 가입과 동시에
           세션이 온다 → 바로 로그인 완료. 혹시 세션이 안 왔다면(설정이 켜져
           있는 경우 등) 로그인을 한 번 더 시도해 보정한다. */
        if (res.data && res.data.session) {
          closeModal();
          return;
        }
        return supabase.auth.signInWithPassword({ email: email, password: password })
          .then(function (res2) {
            if (res2.error) return Promise.reject(res2.error);
            closeModal();
          });
      })
      .catch(function (err) { showError(mapAuthError(err, 'signup')); })
      .then(function () { setBusy(false); }, function () { setBusy(false); });
  }

  /* onAuthStateChange의 첫 콜백(INITIAL_SESSION)이 브라우저에 따라 아주 늦게
     오거나 아예 안 오는 경우가 보고됐다(원인 불명 — 브라우저 내부의 세션
     동기화 잠금 등으로 추정. 다른 탭에 갔다 오면 그제서야 뜨는 증상과 일치).
     이벤트만 기다리지 않고, 페이지가 열리자마자 getSession()으로 직접 한 번
     더 물어본다. 5초 안에도 답이 없으면 일단 "모름(비로그인 취급)"으로
     구독자들에게 알려 무한정 기다리게 하지 않는다 — 실제로 로그인 상태였다면
     이후 onAuthStateChange가 응답을 들고 왔을 때 다시 정확히 바로잡는다. */
  function withTimeout(promise, ms) {
    return new Promise(function (resolve) {
      var done = false;
      var timer = window.setTimeout(function () {
        if (done) return;
        done = true;
        resolve(null);
      }, ms);
      promise.then(function (v) {
        if (done) return;
        done = true;
        window.clearTimeout(timer);
        resolve(v);
      }, function () {
        if (done) return;
        done = true;
        window.clearTimeout(timer);
        resolve(null);
      });
    });
  }

  withTimeout(supabase.auth.getSession(), 5000).then(function (res) {
    var session = res && res.data && res.data.session;
    currentUser = (session && session.user) || null;
    renderAuthArea();
    notifyListeners();
  });

  /* ── 세션 추적 ──
     이후의 실제 로그인/로그아웃/토큰 갱신은 계속 이 이벤트로 받는다. */
  supabase.auth.onAuthStateChange(function (_event, session) {
    currentUser = (session && session.user) || null;
    renderAuthArea();
    notifyListeners();
  });
})();
