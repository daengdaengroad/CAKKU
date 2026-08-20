import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';
import { AppError } from '../util/errors.js';

// 화면에서 키를 바꿀 수 있으므로, 어떤 키로 만든 클라이언트인지 같이 들고 있는다.
let cached: { key: string; client: Anthropic } | null = null;

/** API 키가 없으면 AI 기능만 꺼진다. 편집·렌더링은 키 없이도 동작한다. */
export function isAiConfigured(): boolean {
  return Boolean(config.anthropic.apiKey);
}

export function anthropic(): Anthropic {
  if (!config.anthropic.apiKey) {
    throw new AppError(
      'AI 대본 기능을 쓰려면 API 키가 필요합니다.',
      400,
      '.env 파일의 ANTHROPIC_API_KEY 를 채운 뒤 서버를 다시 시작하세요. (https://console.anthropic.com)',
    );
  }
  const key = config.anthropic.apiKey;
  if (cached?.key !== key) {
    cached = { key, client: new Anthropic({ apiKey: key }) };
  }
  return cached.client;
}

/** SDK 예외를 사용자에게 보여줄 만한 한국어 메시지로 바꾼다. */
export function describeAiError(err: unknown): AppError {
  if (err instanceof Anthropic.AuthenticationError) {
    return new AppError('API 키가 올바르지 않습니다.', 401, '.env 의 ANTHROPIC_API_KEY 를 확인하세요.');
  }
  if (err instanceof Anthropic.RateLimitError) {
    return new AppError('요청이 너무 많습니다.', 429, '잠시 후 다시 시도해 주세요.');
  }
  if (err instanceof Anthropic.BadRequestError) {
    return new AppError('AI 요청이 거절되었습니다.', 400, err.message);
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return new AppError('AI 서버에 연결하지 못했습니다.', 503, '인터넷 연결을 확인해 주세요.');
  }
  if (err instanceof Anthropic.APIError) {
    return new AppError(`AI 요청 실패 (${err.status}).`, 502, err.message);
  }
  return new AppError('대본 생성 중 알 수 없는 오류가 발생했습니다.', 500, String(err));
}
