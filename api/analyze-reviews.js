/* 나또감 — Vercel 서버리스 함수: 제미나이로 구글 리뷰 AI 분석
   제미나이 키는 서버 환경변수(GEMINI_API_KEY)에만 존재하고 클라이언트로
   절대 전달되지 않는다.

   2026년 6월부터 구글이 발급하는 신규 키는 "AQ." 접두 Auth key로,
   기존 generateContent REST 엔드포인트(?key= 쿼리)와 호환되지 않는다
   (ACCESS_TOKEN_TYPE_UNSUPPORTED). Auth key는 새 Interactions API
   (POST /v1beta/interactions, x-goog-api-key 헤더)를 써야 한다.

   Interactions API의 response_format.schema로 JSON 형식을 강제해서
   1) 긍정/보통/부정 개수  2) 핵심 단어 8~15개(중요도 1~10, 좋은/나쁜 맥락)
   3) 한 줄 요약 을 한 번에 받아 그대로 클라이언트에 돌려준다. */

var SCHEMA = {
  type: 'object',
  properties: {
    sentimentCounts: {
      type: 'object',
      properties: {
        positive: { type: 'integer' },
        neutral: { type: 'integer' },
        negative: { type: 'integer' }
      },
      required: ['positive', 'neutral', 'negative']
    },
    keywords: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          word: { type: 'string' },
          score: { type: 'integer' },
          context: { type: 'string', enum: ['positive', 'negative'] }
        },
        required: ['word', 'score', 'context']
      }
    },
    summary: { type: 'string' }
  },
  required: ['sentimentCounts', 'keywords', 'summary']
};

function buildPrompt(placeName, reviews) {
  var reviewsText = reviews.map(function (r, i) {
    return (i + 1) + '. ' + String(r.text || '').slice(0, 500);
  }).join('\n');

  return '다음은 "' + placeName + '"라는 가게의 구글 리뷰 ' + reviews.length + '개입니다.\n\n' +
    reviewsText + '\n\n' +
    '위 리뷰들을 분석해서 반드시 다음 세 가지를 포함한 JSON으로만 답하세요.\n' +
    '1. sentimentCounts: 리뷰 ' + reviews.length + '개를 각각 긍정/보통/부정 중 하나로 분류한 개수. ' +
    'positive+neutral+negative의 합이 정확히 ' + reviews.length + '가 되어야 함.\n' +
    '2. keywords: 리뷰에 자주 나오는 핵심 단어 8~15개. 음식 이름, 맛, 분위기, 서비스 위주로 뽑고, ' +
    '각 단어가 리뷰에서 얼마나 중요/자주 언급되는지 1~10점(score)과 좋은 맥락(positive)인지 ' +
    '나쁜 맥락(negative)인지(context)를 함께 표시.\n' +
    '3. summary: 이 가게 리뷰 전체 분위기를 한국어 한 문장으로 요약.';
}

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }

  var body = req.body || {};
  var reviews = Array.isArray(body.reviews) ? body.reviews.filter(function (r) { return r && r.text; }) : [];
  var placeName = String(body.placeName || '가게').trim().slice(0, 100);

  if (reviews.length === 0) {
    res.status(400).json({ error: 'no reviews to analyze' });
    return;
  }

  var key = process.env.GEMINI_API_KEY;
  if (!key) {
    res.status(500).json({ error: 'server not configured (GEMINI_API_KEY missing)' });
    return;
  }

  var model = process.env.GEMINI_MODEL || 'gemini-3.5-flash';

  try {
    var geminiRes = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/interactions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': key
        },
        body: JSON.stringify({
          model: model,
          input: buildPrompt(placeName, reviews),
          response_format: {
            type: 'text',
            mime_type: 'application/json',
            schema: SCHEMA
          }
        })
      }
    );

    if (!geminiRes.ok) {
      res.status(502).json({ error: 'gemini request failed' });
      return;
    }

    var data = await geminiRes.json();
    var text = data.output_text;

    if (!text) {
      res.status(502).json({ error: 'gemini empty response' });
      return;
    }

    var parsed = JSON.parse(text);
    res.status(200).json(parsed);
  } catch (e) {
    res.status(502).json({ error: 'gemini request failed' });
  }
};
