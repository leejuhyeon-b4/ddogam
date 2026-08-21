/* 나또감 — Vercel 서버리스 함수: 구글 Places API (New) 리뷰 조회 프록시
   구글 API 키는 서버 환경변수(GOOGLE_PLACES_KEY)에만 존재하고 클라이언트로
   절대 전달되지 않는다. Text Search로 후보를 찾고, locationBias는 순위에만
   영향을 줄 뿐이라 Haversine 거리로 150m 초과 후보를 서버에서 직접 걸러낸
   뒤, Place Details에서 4개 필드(이름/리뷰개수/리뷰/지도링크)만 뽑아 돌려준다. */

function haversineMeters(lat1, lng1, lat2, lng2) {
  var R = 6371000;
  function toRad(d) { return d * Math.PI / 180; }
  var dLat = toRad(lat2 - lat1);
  var dLng = toRad(lng2 - lng1);
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  var name = String((req.query && req.query.name) || '').trim().slice(0, 100);
  var lat = parseFloat(req.query && req.query.lat);
  var lng = parseFloat(req.query && req.query.lng);

  if (!name || !isFinite(lat) || !isFinite(lng)) {
    res.status(400).json({ error: 'name, lat, lng are required' });
    return;
  }

  var key = process.env.GOOGLE_PLACES_KEY;
  if (!key) {
    res.status(500).json({ error: 'server not configured (GOOGLE_PLACES_KEY missing)' });
    return;
  }

  try {
    var searchRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.location'
      },
      body: JSON.stringify({
        textQuery: name,
        locationBias: { circle: { center: { latitude: lat, longitude: lng }, radius: 150.0 } }
      })
    });

    if (!searchRes.ok) {
      res.status(502).json({ error: 'request-failed' });
      return;
    }

    var searchJson = await searchRes.json();
    var candidates = searchJson.places || [];
    var closest = null;
    var closestDist = Infinity;
    candidates.forEach(function (c) {
      if (!c.location) return;
      var d = haversineMeters(lat, lng, c.location.latitude, c.location.longitude);
      if (d <= 150 && d < closestDist) {
        closest = c;
        closestDist = d;
      }
    });

    if (!closest) {
      res.status(404).json({ error: 'no-match' });
      return;
    }

    var detailsRes = await fetch('https://places.googleapis.com/v1/places/' + closest.id, {
      headers: {
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'displayName,userRatingCount,reviews,googleMapsUri'
      }
    });

    if (!detailsRes.ok) {
      res.status(502).json({ error: 'request-failed' });
      return;
    }

    var json = await detailsRes.json();

    res.status(200).json({
      placeName: (json.displayName && json.displayName.text) || name,
      reviewCount: json.userRatingCount || 0,
      reviews: (json.reviews || []).map(function (r) {
        return {
          author: (r.authorAttribution && r.authorAttribution.displayName) || '익명',
          relativeTime: r.relativePublishTimeDescription || '',
          text: (r.text && r.text.text) || ''
        };
      }),
      mapsUri: json.googleMapsUri || ''
    });
  } catch (e) {
    res.status(502).json({ error: 'request-failed' });
  }
};
