import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  PayAppConfigurationError,
  PayAppResponseError,
  cancelPayAppPayment,
  getPayAppConfig,
  normalizeBuyerPhone,
  requestPayAppPayment,
  verifyPayAppFeedback,
} from '@/lib/payments/payapp';
import { getPurchasePlan } from '@/lib/purchases/plans';

describe('페이앱 서버 연동', () => {
  beforeEach(() => {
    vi.stubEnv('PAYAPP_USER_ID', 'seller-id');
    vi.stubEnv('PAYAPP_LINK_KEY', 'link-key');
    vi.stubEnv('PAYAPP_LINK_VALUE', 'link-value');
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://sketch.example.com');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('서버 상품과 구매자 전화번호로 페이앱 결제 요청을 만든다', async () => {
    const transport = vi.fn().mockResolvedValue(new Response(
      'state=1&errorMessage=&mul_no=2000&payurl=https%3A%2F%2Fpayapp.kr%2Fpay%2F2000',
    ));

    const plan = getPurchasePlan('WATERMARK_FREE');
    expect(plan).not.toBeNull();

    await expect(requestPayAppPayment({
      buyerPhone: '01012345678',
      orderId: 'order_public_random',
      plan: plan!,
      requestId: 'request-1234',
    }, transport)).resolves.toEqual({
      payUrl: 'https://payapp.kr/pay/2000',
      providerOrderId: '2000',
    });

    const [url, init] = transport.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.payapp.kr/oapi/apiLoad.html');
    expect(init.method).toBe('POST');
    expect(Object.fromEntries(init.body as URLSearchParams)).toEqual({
      checkretry: 'y',
      cmd: 'payrequest',
      feedbackurl: 'https://sketch.example.com/api/payments/payapp/feedback',
      goodname: '워터마크 제거',
      price: '1000',
      recvphone: '01012345678',
      returnurl: 'https://sketch.example.com/api/payments/payapp/return?orderId=order_public_random',
      smsuse: 'n',
      userid: 'seller-id',
      var1: 'order_public_random',
      var2: 'request-1234',
    });
  });

  it('전체 취소 요청에는 서버 비밀키와 페이앱 주문번호만 사용한다', async () => {
    const transport = vi.fn().mockResolvedValue(new Response('state=1&errorMessage='));

    await expect(cancelPayAppPayment({
      cancelMemo: '관리자 전체 취소',
      providerOrderId: '2000',
    }, transport)).resolves.toBeUndefined();

    const [, init] = transport.mock.calls[0] as [string, RequestInit];
    expect(Object.fromEntries(init.body as URLSearchParams)).toEqual({
      cancelmemo: '관리자 전체 취소',
      cmd: 'paycancel',
      linkkey: 'link-key',
      mul_no: '2000',
      userid: 'seller-id',
    });
  });

  it('페이앱 연동 값과 HTTPS 운영 주소가 없으면 외부 호출 전에 거부한다', () => {
    expect(() => getPayAppConfig({
      NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
      PAYAPP_LINK_KEY: '',
      PAYAPP_LINK_VALUE: '',
      PAYAPP_USER_ID: '',
    })).toThrow(PayAppConfigurationError);
  });

  it('변조된 결제 URL과 페이앱 실패 응답을 안전한 오류로 거부한다', async () => {
    const insecureTransport = vi.fn().mockResolvedValue(new Response(
      'state=1&mul_no=2000&payurl=http%3A%2F%2Fpayapp.kr%2Fpay%2F2000',
    ));
    await expect(requestPayAppPayment({
      buyerPhone: '01012345678',
      orderId: 'order-1',
      plan: { amount: 1000, label: '상품' },
      requestId: 'request-1',
    }, insecureTransport)).rejects.toBeInstanceOf(PayAppResponseError);

    const failedTransport = vi.fn().mockResolvedValue(new Response(
      'state=0&errno=70010&errorMessage=secret-provider-message',
    ));
    await expect(requestPayAppPayment({
      buyerPhone: '01012345678',
      orderId: 'order-1',
      plan: { amount: 1000, label: '상품' },
      requestId: 'request-1',
    }, failedTransport)).rejects.toMatchObject({
      message: '결제창을 열지 못했습니다.',
    });
  });

  it('국내 휴대전화번호를 숫자로 정규화하고 잘못된 번호는 거부한다', () => {
    expect(normalizeBuyerPhone('010-1234-5678')).toBe('01012345678');
    expect(normalizeBuyerPhone('010 1234 5678')).toBe('01012345678');
    expect(normalizeBuyerPhone('02-1234-5678')).toBeNull();
    expect(normalizeBuyerPhone('010-12-5678')).toBeNull();
  });

  it('통보의 판매자 아이디와 연동 KEY·VALUE를 모두 확인한다', () => {
    const config = getPayAppConfig();
    expect(verifyPayAppFeedback({
      linkkey: 'link-key',
      linkval: 'link-value',
      userid: 'seller-id',
    }, config)).toBe(true);
    expect(verifyPayAppFeedback({
      linkkey: 'link-key',
      linkval: 'changed',
      userid: 'seller-id',
    }, config)).toBe(false);
  });
});
