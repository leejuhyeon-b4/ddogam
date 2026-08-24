/* 나또감 — 목업 식당/방문 데이터
   · 실제 저장 기능(Supabase restaurants/visits 테이블, 기록 폼)은
     아직 없다. 카드 도감(cardlist.html)과 랭킹(rank.html) 화면을
     먼저 완성하기 위한 자리표시 데이터다.
   · 모양은 PRD.md §4.1 Restaurant/Visit을 그대로 따른다 —
     visit_count/total_spent는 여기 저장하지 않고 assets/utils.js가
     visits[]에서 파생시킨다. 실데이터 연동 시 이 배열만 Supabase
     쿼리 결과로 바꾸면 된다.
   · classic script. assets/utils.js보다 뒤, cardlist.js/rank.js보다
     앞에 로드한다. */
(function () {
  'use strict';

  window.NaToGam = window.NaToGam || {};

  /* count개의 방문을 만들어 amount 합이 정확히 totalWon이 되도록 나눈다.
     나머지는 앞쪽 방문들에 1원씩 더 붙여 처리한다(합계 오차 0). */
  function genVisits(prefix, count, totalWon, startISO, endISO) {
    var base = Math.floor(totalWon / count);
    var remainder = totalWon - base * count;

    var start = new Date(startISO).getTime();
    var end = new Date(endISO).getTime();
    var step = count > 1 ? (end - start) / (count - 1) : 0;

    var visits = [];
    for (var i = 0; i < count; i++) {
      var amount = base + (i < remainder ? 1 : 0);
      var d = new Date(start + step * i);
      var iso = d.toISOString().slice(0, 10);
      visits.push({
        id: prefix + '-v' + (i + 1),
        visited_at: iso,
        amount: amount,
        split_count: 1,
        memo: ''
      });
    }
    return visits;
  }

  var restaurants = [
    {
      id: 'r1', name: '을지로 골뱅이', grade: 'S',
      business_number: null, kakao_place_id: null,
      address: '서울 중구 을지로', created_at: '2023-04-02',
      visits: genVisits('r1', 47, 3800000, '2023-04-02', '2026-08-01')
    },
    {
      id: 'r2', name: '망원동 우육면', grade: 'S',
      business_number: null, kakao_place_id: null,
      address: '서울 마포구 망원동', created_at: '2023-01-15',
      /* 동률 검증: r1과 방문 47회로 같으나 금액이 더 많아 r1보다 위여야 한다 */
      visits: genVisits('r2', 47, 4200000, '2023-01-15', '2026-08-10')
    },
    {
      id: 'r3', name: '신사 오마카세', grade: 'S',
      business_number: null, kakao_place_id: null,
      address: '서울 강남구 신사동', created_at: '2024-11-01',
      /* n분의1 계산 검증: 600,000/1 + 800,000/2 + 900,000/3
         = 600,000 + 400,000 + 300,000 = 1,300,000(130만원).
         단순 합(2,300,000)과 달라야 split 계산이 실제로 반영된 것이다. */
      visits: [
        { id: 'r3-v1', visited_at: '2024-11-01', amount: 600000, split_count: 1, memo: '혼자' },
        { id: 'r3-v2', visited_at: '2025-06-20', amount: 800000, split_count: 2, memo: '둘이' },
        { id: 'r3-v3', visited_at: '2026-03-05', amount: 900000, split_count: 3, memo: '셋이' }
      ]
    },
    {
      id: 'r4', name: '성수동 냉면집', grade: 'S',
      business_number: null, kakao_place_id: null,
      address: '서울 성동구 성수동', created_at: '2022-09-10',
      /* 등급 내 최다 방문(61회) — A등급 최고 스펙(r7)보다도 항상 위여야 한다 */
      visits: genVisits('r4', 61, 2600000, '2022-09-10', '2026-08-15')
    },
    {
      id: 'r5', name: '연남 손칼국수', grade: 'A',
      business_number: null, kakao_place_id: null,
      address: '서울 마포구 연남동', created_at: '2023-02-20',
      visits: genVisits('r5', 23, 960000, '2023-02-20', '2026-07-20')
    },
    {
      id: 'r6', name: '합정 이자카야', grade: 'A',
      business_number: null, kakao_place_id: null,
      address: '서울 마포구 합정동', created_at: '2023-08-05',
      /* 방문횟수가 금액보다 우선함을 보여주는 쌍: r5(23회/96만원)가
         r6(15회/150만원)보다 금액은 적어도 순위는 위여야 한다 */
      visits: genVisits('r6', 15, 1500000, '2023-08-05', '2026-06-30')
    },
    {
      id: 'r7', name: '여의도 스테이크', grade: 'A',
      business_number: null, kakao_place_id: null,
      address: '서울 영등포구 여의도동', created_at: '2022-12-01',
      visits: genVisits('r7', 40, 5000000, '2022-12-01', '2026-08-05')
    },
    {
      id: 'r8', name: '잠실 마라탕', grade: 'A',
      business_number: null, kakao_place_id: null,
      address: '서울 송파구 잠실동', created_at: '2023-03-18',
      /* 동률 검증: r7과 방문 40회로 같으나 금액이 더 적어 r7보다 아래여야 한다 */
      visits: genVisits('r8', 40, 4800000, '2023-03-18', '2026-08-05')
    },
    {
      id: 'r9', name: '역삼 김치찌개', grade: 'B',
      business_number: null, kakao_place_id: null,
      address: '서울 강남구 역삼동', created_at: '2024-01-10',
      visits: genVisits('r9', 9, 110000, '2024-01-10', '2026-05-01')
    },
    {
      id: 'r10', name: '홍대 곱창집', grade: 'B',
      business_number: null, kakao_place_id: null,
      address: '서울 마포구 서교동', created_at: '2024-02-14',
      /* 동률 검증: r9와 방문 9회로 같으나 금액이 더 많아 r9보다 위여야 한다 */
      visits: genVisits('r10', 9, 150000, '2024-02-14', '2026-05-14')
    },
    {
      id: 'r11', name: '노량진 백반', grade: 'B',
      business_number: null, kakao_place_id: null,
      address: '서울 동작구 노량진동', created_at: '2023-11-01',
      /* 등급 내 최다 방문(20회) — 금액은 등급 내 최저지만 순위는 최상위 */
      visits: genVisits('r11', 20, 80000, '2023-11-01', '2026-07-01')
    },
    {
      id: 'r12', name: '신사 파스타', grade: 'C',
      business_number: null, kakao_place_id: null,
      address: '서울 강남구 신사동', created_at: '2025-01-05',
      visits: genVisits('r12', 1, 90000, '2025-01-05', '2025-01-05')
    },
    {
      id: 'r13', name: '강남 브런치', grade: 'C',
      business_number: null, kakao_place_id: null,
      address: '서울 강남구 논현동', created_at: '2024-09-01',
      /* 방문횟수 우위 검증: r12(1회)보다 위여야 한다 */
      visits: genVisits('r13', 4, 200000, '2024-09-01', '2025-12-01')
    }
  ];

  window.NaToGam.mockData = { restaurants: restaurants };
})();
