import {
  E2E_READINESS_EMULATOR_HEADERS,
  E2E_READINESS_ORIGIN_HEADER,
  getE2EServerReadinessState,
} from '@/lib/testing/e2e-readiness';

export const dynamic = 'force-dynamic';

const privateHeaders = {
  'Cache-Control': 'no-store',
};

export async function GET(request: Request) {
  const state = getE2EServerReadinessState(process.env, {
    auth: request.headers.get(E2E_READINESS_EMULATOR_HEADERS.auth),
    firestore: request.headers.get(E2E_READINESS_EMULATOR_HEADERS.firestore),
    origin: request.headers.get(E2E_READINESS_ORIGIN_HEADER),
    storage: request.headers.get(E2E_READINESS_EMULATOR_HEADERS.storage),
  });

  if (state === 'hidden') {
    return new Response(null, { headers: privateHeaders, status: 404 });
  }
  if (state === 'unavailable') {
    return new Response(null, { headers: privateHeaders, status: 503 });
  }
  return new Response(null, {
    headers: {
      ...privateHeaders,
      'X-Sketch-Me-E2E-Ready': '1',
    },
    status: 204,
  });
}
