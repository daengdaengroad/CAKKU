import fs from 'node:fs';
import { google } from 'googleapis';
import { AppError } from '../util/errors.js';
import { logger } from '../util/log.js';
import { requireAuthorizedClient } from './auth.js';

const log = logger('youtube');

export type PrivacyStatus = 'private' | 'unlisted' | 'public';

export interface UploadRequest {
  filePath: string;
  title: string;
  description: string;
  tags: string[];
  privacyStatus: PrivacyStatus;
  /** 만든 사람이 아이용 콘텐츠인지 표시. 유튜브가 요구하는 필수 항목이다. */
  madeForKids: boolean;
  onProgress?: (ratio: number) => void;
}

export interface UploadResult {
  videoId: string;
  url: string;
}

/** 반려동물 카테고리. 숏츠 자동 분류에 영향을 준다. */
const CATEGORY_PETS_AND_ANIMALS = '15';

/** 유튜브 제목은 100자, 설명은 5000자 제한이다. 넘으면 API 가 400 을 준다. */
function trim(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1)}…`;
}

export async function uploadToYoutube(req: UploadRequest): Promise<UploadResult> {
  const stats = await fs.promises.stat(req.filePath).catch(() => null);
  if (!stats) {
    throw new AppError('업로드할 영상 파일이 없습니다.', 400, '먼저 렌더링을 완료해 주세요.');
  }

  const auth = await requireAuthorizedClient();
  const youtube = google.youtube({ version: 'v3', auth });

  // 세로 60초 이하 영상은 유튜브가 알아서 숏츠로 잡지만, 해시태그를 넣어두면 더 확실하다.
  const title = trim(req.title || '오늘의 강아지', 100);
  const description = trim(req.description, 4900);

  log.info(`업로드 시작: ${title} (${(stats.size / 1024 / 1024).toFixed(1)}MB)`);

  try {
    const res = await youtube.videos.insert(
      {
        part: ['snippet', 'status'],
        requestBody: {
          snippet: {
            title,
            description,
            tags: req.tags.slice(0, 30).map((tag) => tag.slice(0, 30)),
            categoryId: CATEGORY_PETS_AND_ANIMALS,
          },
          status: {
            privacyStatus: req.privacyStatus,
            selfDeclaredMadeForKids: req.madeForKids,
          },
        },
        media: { body: fs.createReadStream(req.filePath) },
      },
      {
        // 큰 파일은 재개 가능 업로드로 올라간다. 진행률은 바이트 기준.
        onUploadProgress: (event: { bytesRead: number }) => {
          req.onProgress?.(Math.min(1, event.bytesRead / stats.size));
        },
      },
    );

    const videoId = res.data.id;
    if (!videoId) {
      throw new AppError('업로드는 됐지만 영상 ID 를 받지 못했습니다.', 502);
    }

    log.info(`업로드 완료: https://youtu.be/${videoId}`);
    return { videoId, url: `https://youtu.be/${videoId}` };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw describeUploadError(err);
  }
}

function describeUploadError(err: unknown): AppError {
  const message = err instanceof Error ? err.message : String(err);

  if (message.includes('quotaExceeded') || message.includes('uploadLimitExceeded')) {
    return new AppError(
      '오늘 업로드 할당량을 다 썼습니다.',
      429,
      '유튜브 API 는 하루 업로드 횟수가 제한됩니다. 내일 다시 시도해 주세요.',
    );
  }
  if (message.includes('youtubeSignupRequired')) {
    return new AppError(
      '연결한 구글 계정에 유튜브 채널이 없습니다.',
      400,
      '유튜브에서 채널을 먼저 만들어 주세요.',
    );
  }
  if (message.includes('invalid_grant')) {
    return new AppError(
      '유튜브 계정 연결이 만료되었습니다.',
      401,
      '설정 화면에서 계정을 다시 연결해 주세요.',
    );
  }

  return new AppError('유튜브 업로드에 실패했습니다.', 502, message);
}
