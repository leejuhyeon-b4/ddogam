/* 나또감 — Vercel 서버리스 함수: 카카오 로컬 키워드 검색 프록시
   카카오 REST API 키는 서버 환경변수(KAKAO_REST_KEY)에만 존재하고
   클라이언트로 절대 전달되지 않는다. 응답은 search.js가 기대하는
   계약 객체 형태({id,name,address,lat,lng,category,kakaoUrl})로 정규화해서 돌려준다. */
module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  var query = String((req.query && req.query.query) || '').trim().slice(0, 100);
  if (!query) {
    res.status(400).json({ error: 'query is required' });
    return;
  }

  var key = process.env.KAKAO_REST_KEY;
  if (!key) {
    res.status(500).json({ error: 'server not configured (KAKAO_REST_KEY missing)' });
    return;
  }

  try {
    var url = 'https://dapi.kakao.com/v2/local/search/keyword.json?size=15&query=' + encodeURIComponent(query);
    var kakaoRes = await fetch(url, {
      headers: { Authorization: 'KakaoAK ' + key }
    });

    if (!kakaoRes.ok) {
      res.status(502).json({ error: 'kakao request failed' });
      return;
    }

    var data = await kakaoRes.json();
    var results = (data.documents || []).map(function (item) {
      return {
        id: String(item.id),
        name: item.place_name,
        address: item.road_address_name || item.address_name,
        lat: parseFloat(item.y),   // 카카오 y = 위도
        lng: parseFloat(item.x),   // 카카오 x = 경도
        category: item.category_name || '',
        kakaoUrl: item.place_url || ''
      };
    });

    res.status(200).json({ results: results });
  } catch (e) {
    res.status(502).json({ error: 'kakao request failed' });
  }
};
