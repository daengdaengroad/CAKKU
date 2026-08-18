import path from 'node:path';
import { Router } from 'express';
import { config } from '../config.js';
import { isAiConfigured } from '../ai/anthropic.js';
import { isTtsConfigured } from '../ai/tts.js';
import { availableFonts } from '../render/fonts.js';
import { ffmpegPath } from '../media/ffmpeg.js';

export const systemRouter = Router();

const FONT_DIR = path.resolve(import.meta.dirname, '..', '..', '..', 'assets', 'fonts');

/**
 * UI 가 첫 화면에서 "무엇이 준비됐고 무엇이 빠졌는지" 안내하기 위한 엔드포인트.
 * 키가 없어도 서버는 뜨고, 빠진 기능만 꺼진다.
 */
systemRouter.get('/health', (_req, res) => {
  const fonts = availableFonts(FONT_DIR);
  const koreanFonts = fonts.filter((font) => font.hangul);

  let ffmpeg = false;
  try {
    ffmpegPath();
    ffmpeg = true;
  } catch {
    ffmpeg = false;
  }

  res.json({
    ok: true,
    features: {
      ffmpeg,
      script: isAiConfigured(),
      tts: isTtsConfigured(),
      ttsProvider: config.tts.provider,
      youtube: Boolean(config.youtube.clientId && config.youtube.clientSecret),
      fonts: koreanFonts.length > 0,
    },
    hints: [
      isAiConfigured() ? null : '.env 의 ANTHROPIC_API_KEY 를 채우면 대본을 자동으로 써줍니다.',
      isTtsConfigured() ? null : '.env 의 TTS_PROVIDER 를 설정하면 내레이션 목소리가 들어갑니다.',
      koreanFonts.length > 0 ? null : 'npm run setup 을 실행해 자막용 한글 폰트를 받아주세요.',
      config.youtube.clientId ? null : '.env 의 YOUTUBE_CLIENT_ID/SECRET 을 채우면 바로 업로드됩니다.',
    ].filter(Boolean),
  });
});

/** 자막 폰트 고르기 드롭다운용 */
systemRouter.get('/fonts', (_req, res) => {
  res.json(
    availableFonts(FONT_DIR)
      .filter((font) => font.hangul)
      .map((font) => ({ family: font.family })),
  );
});
