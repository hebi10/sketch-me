import { timingSafeEqual } from 'node:crypto';

const PAYAPP_API_URL = 'https://api.payapp.kr/oapi/apiLoad.html';

export interface PayAppConfig {
  appOrigin: string;
  linkKey: string;
  linkValue: string;
  userId: string;
}

export interface PayAppPaymentRequest {
  buyerPhone: string;
  orderId: string;
  plan: {
    amount: number;
    label: string;
  };
  requestId: string;
}

export interface PayAppPaymentResult {
  payUrl: string;
  providerOrderId: string;
}

export interface PayAppCancelRequest {
  cancelMemo: string;
  providerOrderId: string;
}

export type PayAppTransport = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

export class PayAppConfigurationError extends Error {
  constructor() {
    super('결제 서비스 설정을 확인해 주세요.');
    this.name = 'PayAppConfigurationError';
  }
}

export class PayAppResponseError extends Error {
  constructor(message = '결제창을 열지 못했습니다.') {
    super(message);
    this.name = 'PayAppResponseError';
  }
}

function isPayAppUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:'
      && (url.hostname === 'payapp.kr' || url.hostname.endsWith('.payapp.kr'));
  } catch {
    return false;
  }
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length
    && timingSafeEqual(leftBuffer, rightBuffer);
}

function parseResponseBody(body: string): URLSearchParams {
  return new URLSearchParams(body);
}

export function getPayAppConfig(
  environment: NodeJS.ProcessEnv = process.env,
): PayAppConfig {
  const userId = environment.PAYAPP_USER_ID?.trim() ?? '';
  const linkKey = environment.PAYAPP_LINK_KEY?.trim() ?? '';
  const linkValue = environment.PAYAPP_LINK_VALUE?.trim() ?? '';
  const appUrl = environment.NEXT_PUBLIC_APP_URL?.trim() ?? '';

  if (!userId || !linkKey || !linkValue || !appUrl) {
    throw new PayAppConfigurationError();
  }

  try {
    const parsedAppUrl = new URL(appUrl);
    if (
      parsedAppUrl.protocol !== 'https:'
      || parsedAppUrl.username
      || parsedAppUrl.password
      || parsedAppUrl.search
      || parsedAppUrl.hash
      || (parsedAppUrl.pathname !== '/' && parsedAppUrl.pathname !== '')
    ) {
      throw new PayAppConfigurationError();
    }

    return {
      appOrigin: parsedAppUrl.origin,
      linkKey,
      linkValue,
      userId,
    };
  } catch (error) {
    if (error instanceof PayAppConfigurationError) {
      throw error;
    }
    throw new PayAppConfigurationError();
  }
}

export function normalizeBuyerPhone(value: string): string | null {
  const normalized = value.replace(/[\s-]/g, '');
  return /^01(?:0\d{8}|[16789]\d{7,8})$/.test(normalized)
    ? normalized
    : null;
}

export function verifyPayAppFeedback(
  values: { linkkey?: string; linkval?: string; userid?: string },
  config: PayAppConfig,
): boolean {
  return safeEqual(values.userid ?? '', config.userId)
    && safeEqual(values.linkkey ?? '', config.linkKey)
    && safeEqual(values.linkval ?? '', config.linkValue);
}

export async function requestPayAppPayment(
  input: PayAppPaymentRequest,
  transport: PayAppTransport = fetch,
): Promise<PayAppPaymentResult> {
  const config = getPayAppConfig();
  const buyerPhone = normalizeBuyerPhone(input.buyerPhone);
  if (!buyerPhone) {
    throw new PayAppResponseError('휴대전화번호를 확인해 주세요.');
  }

  const body = new URLSearchParams({
    checkretry: 'y',
    cmd: 'payrequest',
    feedbackurl: `${config.appOrigin}/api/payments/payapp/feedback`,
    goodname: input.plan.label,
    price: String(input.plan.amount),
    recvphone: buyerPhone,
    returnurl: `${config.appOrigin}/api/payments/payapp/return?orderId=${encodeURIComponent(input.orderId)}`,
    smsuse: 'n',
    userid: config.userId,
    var1: input.orderId,
    var2: input.requestId,
  });

  let response: Response;
  try {
    response = await transport(PAYAPP_API_URL, {
      body,
      method: 'POST',
    });
  } catch {
    throw new PayAppResponseError();
  }

  if (!response.ok) {
    throw new PayAppResponseError();
  }

  const values = parseResponseBody(await response.text());
  const providerOrderId = values.get('mul_no') ?? '';
  const payUrl = values.get('payurl') ?? '';
  if (
    values.get('state') !== '1'
    || !/^\d+$/.test(providerOrderId)
    || !isPayAppUrl(payUrl)
  ) {
    throw new PayAppResponseError();
  }

  return { payUrl, providerOrderId };
}

export async function cancelPayAppPayment(
  input: PayAppCancelRequest,
  transport: PayAppTransport = fetch,
): Promise<void> {
  const config = getPayAppConfig();
  const body = new URLSearchParams({
    cancelmemo: input.cancelMemo,
    cmd: 'paycancel',
    linkkey: config.linkKey,
    mul_no: input.providerOrderId,
    userid: config.userId,
  });

  let response: Response;
  try {
    response = await transport(PAYAPP_API_URL, {
      body,
      method: 'POST',
    });
  } catch {
    throw new PayAppResponseError('결제 취소 요청을 처리하지 못했습니다.');
  }

  if (!response.ok) {
    throw new PayAppResponseError('결제 취소 요청을 처리하지 못했습니다.');
  }

  const values = parseResponseBody(await response.text());
  if (values.get('state') !== '1') {
    throw new PayAppResponseError('결제 취소 요청을 처리하지 못했습니다.');
  }
}
