import fs from 'node:fs';
import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { readSettings, updateSettings } from '../store/settings.js';
import { currentVoiceId, listVoices, previewVoice, PREVIEW_TEXT } from '../ai/voices.js';
import { resetTtsProvider } from '../ai/tts.js';
import { AppError } from '../util/errors.js';

export const settingsRouter = Router();

/** 키 전체를 화면에 돌려주지 않는다. 설정됐는지와 끝 네 글자만 보여준다. */
function mask(value: string): string {
  if (!value) return '';
  if (value.length <= 8) return '•'.repeat(value.length);
  return `${'•'.repeat(6)}${value.slice(-4)}`;
}

/** 이 값이 화면에서 저장한 것인지, .env 에서 온 것인지 알려준다. */
function sourceOf(settingsValue: string | undefined, effective: string): 'app' | 'env' | 'none' {
  if (!effective) return 'none';
  return settingsValue?.trim() ? 'app' : 'env';
}

settingsRouter.get('/settings', (_req, res) => {
  const saved = readSettings();

  res.json({
    anthropic: {
      configured: Boolean(config.anthropic.apiKey),
      masked: mask(config.anthropic.apiKey),
      source: sourceOf(saved.anthropicApiKey, config.anthropic.apiKey),
      model: config.anthropic.model,
    },
    tts: {
      provider: config.tts.provider,
      voiceId: currentVoiceId(),
      google: {
        credentials: config.tts.google.credentials,
        configured: Boolean(config.tts.google.credentials),
      },
      elevenlabs: {
        configured: Boolean(config.tts.elevenlabs.apiKey),
        masked: mask(config.tts.elevenlabs.apiKey),
      },
      openai: {
        configured: Boolean(config.tts.openai.apiKey),
        masked: mask(config.tts.openai.apiKey),
      },
    },
    youtube: {
      configured: Boolean(config.youtube.clientId && config.youtube.clientSecret),
      clientIdMasked: mask(config.youtube.clientId),
      redirectUri: config.youtube.redirectUri,
    },
  });
});

const settingsSchema = z.object({
  anthropicApiKey: z.string().max(300).optional(),
  anthropicModel: z.string().max(80).optional(),

  ttsProvider: z.enum(['none', 'google', 'elevenlabs', 'openai']).optional(),
  googleVoice: z.string().max(120).optional(),
  googleCredentials: z.string().max(500).optional(),
  elevenlabsApiKey: z.string().max(300).optional(),
  elevenlabsVoiceId: z.string().max(120).optional(),
  openaiApiKey: z.string().max(300).optional(),
  openaiVoice: z.string().max(80).optional(),

  youtubeClientId: z.string().max(300).optional(),
  youtubeClientSecret: z.string().max(300).optional(),
});

settingsRouter.put('/settings', (req, res, next) => {
  try {
    const patch = settingsSchema.parse(req.body ?? {});

    // 서비스 계정 파일은 경로만 받으므로, 실제로 있는 파일인지 여기서 확인해 준다.
    if (patch.googleCredentials?.trim()) {
      const filePath = patch.googleCredentials.trim().replace(/^["']|["']$/g, '');
      if (!fs.existsSync(filePath)) {
        throw new AppError(
          '그 경로에 파일이 없습니다.',
          400,
          '구글 클라우드에서 받은 서비스 계정 JSON 파일의 전체 경로를 넣어주세요.',
        );
      }
      patch.googleCredentials = filePath;
    }

    updateSettings(patch);
    // 제공자나 키가 바뀌었을 수 있으니 다음 요청 때 다시 만들게 한다.
    resetTtsProvider();

    res.json({ saved: true });
  } catch (err) {
    next(err);
  }
});

// ── 목소리 ─────────────────────────────────────────────────────────
settingsRouter.get('/tts/voices', async (_req, res, next) => {
  try {
    const { provider, voices } = await listVoices();
    res.json({ provider, current: currentVoiceId(), voices, previewText: PREVIEW_TEXT });
  } catch (err) {
    next(err);
  }
});

settingsRouter.get('/tts/preview', async (req, res, next) => {
  try {
    const voiceId = typeof req.query.voice === 'string' ? req.query.voice : currentVoiceId();
    if (!voiceId) throw new AppError('들어볼 목소리를 지정해 주세요.', 400);

    const filePath = await previewVoice(voiceId);
    res.sendFile(filePath, { dotfiles: 'deny' }, (err) => {
      if (err) next(err);
    });
  } catch (err) {
    next(err);
  }
});
