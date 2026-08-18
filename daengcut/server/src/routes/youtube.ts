import { Router } from 'express';
import { z } from 'zod';
import { authUrl, channelInfo, clearToken, isYoutubeConfigured, oauthClient, saveToken } from '../youtube/auth.js';
import { uploadToYoutube } from '../youtube/upload.js';
import { getProject, resolveProjectPath, updateProject } from '../store/projects.js';
import { runJob } from '../jobs/runner.js';
import { AppError } from '../util/errors.js';

export const youtubeRouter = Router();

youtubeRouter.get('/status', async (_req, res, next) => {
  try {
    if (!isYoutubeConfigured()) {
      res.json({ configured: false, connected: false, channel: null });
      return;
    }
    const channel = await channelInfo();
    res.json({ configured: true, connected: Boolean(channel), channel });
  } catch (err) {
    next(err);
  }
});

/** 브라우저를 구글 동의 화면으로 보낸다. */
youtubeRouter.get('/auth', (_req, res, next) => {
  try {
    res.redirect(authUrl());
  } catch (err) {
    next(err);
  }
});

/** 구글이 돌려보내는 곳. 토큰을 저장하고 UI 로 되돌린다. */
youtubeRouter.get('/callback', async (req, res, next) => {
  try {
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    if (!code) {
      const reason = typeof req.query.error === 'string' ? req.query.error : '알 수 없는 이유';
      throw new AppError(`유튜브 연결이 취소되었습니다: ${reason}`, 400);
    }

    const client = oauthClient();
    const { tokens } = await client.getToken(code);

    if (!tokens.refresh_token) {
      throw new AppError(
        '갱신 토큰을 받지 못했습니다.',
        400,
        '구글 계정 설정에서 이 앱의 권한을 삭제한 뒤 다시 연결해 주세요.',
      );
    }

    await saveToken(tokens);
    res.redirect('/?youtube=connected');
  } catch (err) {
    next(err);
  }
});

youtubeRouter.post('/disconnect', async (_req, res, next) => {
  try {
    await clearToken();
    res.json({ connected: false });
  } catch (err) {
    next(err);
  }
});

const uploadSchema = z.object({
  privacyStatus: z.enum(['private', 'unlisted', 'public']).default('private'),
  madeForKids: z.boolean().default(false),
  title: z.string().max(100).optional(),
  description: z.string().max(5000).optional(),
  tags: z.array(z.string().max(40)).max(30).optional(),
});

youtubeRouter.post('/upload/:projectId', async (req, res, next) => {
  try {
    const projectId = req.params.projectId;
    const body = uploadSchema.parse(req.body ?? {});
    const project = await getProject(projectId);

    if (!project.render) {
      throw new AppError('렌더링된 영상이 없습니다.', 400, '먼저 영상을 완성해 주세요.');
    }
    if (project.render.quality !== 'final') {
      throw new AppError(
        '미리보기 화질로 렌더된 영상입니다.',
        400,
        '최종 화질로 다시 렌더링한 뒤 업로드해 주세요.',
      );
    }

    const filePath = resolveProjectPath(projectId, project.render.file);
    const meta = project.timeline?.meta;

    void runJob(projectId, 'upload', async (ctx) => {
      ctx.step('유튜브에 올리는 중', 0.02);
      await updateProject(projectId, (current) => ({ ...current, status: 'uploading' }));

      try {
        const result = await uploadToYoutube({
          filePath,
          title: body.title ?? meta?.title ?? project.title,
          description: body.description ?? meta?.description ?? '',
          tags: body.tags ?? meta?.tags ?? [],
          privacyStatus: body.privacyStatus,
          madeForKids: body.madeForKids,
          onProgress: (ratio) => ctx.progress(0.02 + ratio * 0.97),
        });

        await updateProject(projectId, (current) => ({
          ...current,
          status: 'uploaded',
          youtube: {
            videoId: result.videoId,
            url: result.url,
            uploadedAt: new Date().toISOString(),
            privacyStatus: body.privacyStatus,
          },
          error: null,
        }));
      } catch (err) {
        await updateProject(projectId, (current) => ({ ...current, status: 'rendered' }));
        throw err;
      }
    });

    res.status(202).json({ started: true });
  } catch (err) {
    next(err);
  }
});
