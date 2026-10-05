// 택배 조회 중계 서버 (Cloudflare Worker)
//
// deliveryapi.co.kr 의 Secret Key 는 브라우저에 노출하면 안 됩니다.
// 이 작은 서버가 키를 숨긴 채 택배 API 를 대신 불러 주고, 결과만 데모 페이지로 돌려줍니다.
//
// 필요한 설정 (Cloudflare 대시보드 > Workers > Settings > Variables)
//   DELIVERY_API_KEY     : API Key (Secret 으로 등록)
//   DELIVERY_SECRET_KEY  : Secret Key (Secret 으로 등록)
//   ALLOWED_ORIGIN       : 데모 페이지 주소. 예) https://papertone.github.io

const API_URL = 'https://api.deliveryapi.co.kr/v1/tracking/trace';

export default {
  async fetch(request, env) {
    const allowed = env.ALLOWED_ORIGIN || 'https://papertone.github.io';
    const cors = {
      'Access-Control-Allow-Origin': allowed,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin',
    };

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return json({ isSuccess: false, error: { code: 'METHOD_NOT_ALLOWED' } }, 405, cors);

    // 다른 사이트에서 이 서버를 부르지 못하게 막습니다. (완벽한 보호는 아니니 공개 시연 때만 켜 두세요)
    if ((request.headers.get('Origin') || '') !== allowed) {
      return json({ isSuccess: false, error: { code: 'FORBIDDEN_ORIGIN', message: '허용되지 않은 주소입니다.' } }, 403, cors);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ isSuccess: false, error: { code: 'INVALID_PARAMS', message: '요청을 읽지 못했습니다.' } }, 400, cors);
    }

    // 필요한 값만 골라서 넘깁니다. 한 번에 최대 50건.
    const items = (Array.isArray(body.items) ? body.items : []).slice(0, 50).map((i) => ({
      clientId: String(i.clientId || '').slice(0, 64),
      courierCode: String(i.courierCode || ''),
      trackingNumber: String(i.trackingNumber || '').replace(/\D/g, ''),
    }));
    if (!items.length) {
      return json({ isSuccess: false, error: { code: 'INVALID_PARAMS', message: '조회할 송장이 없습니다.' } }, 400, cors);
    }

    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.DELIVERY_API_KEY}:${env.DELIVERY_SECRET_KEY}`,
      },
      body: JSON.stringify({ items, includeProgresses: true, skipCache: false }),
    });

    return new Response(await res.text(), {
      status: res.status,
      headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' },
    });
  },
};

function json(obj, status, headers) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' },
  });
}
