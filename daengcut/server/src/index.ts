import path from 'node:path';
import fs from 'node:fs';
import cors from 'cors';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { config } from './config.js';
import { projectsRouter } from './routes/projects.js';
import { systemRouter } from './routes/system.js';
import { youtubeRouter } from './routes/youtube.js';
import { isAppError } from './util/errors.js';
import { logger } from './util/log.js';

const log = logger('server');

const app = express();

app.use(cors());
app.use(express.json({ limit: '4mb' }));

app.use('/api', systemRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/youtube', youtubeRouter);

// 빌드된 편집 UI 를 같이 서빙한다 (npm run build 후 단일 프로세스로 배포할 때).
const webDist = path.resolve(import.meta.dirname, '..', '..', 'web', 'dist');
log.info(`편집 UI 경로: ${webDist} (${fs.existsSync(webDist) ? '있음' : '없음'})`);
if (fs.existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get('*splat', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(webDist, 'index.html'));
  });
}

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ZodError) {
    const first = err.issues[0];
    res.status(400).json({
      error: '입력값이 올바르지 않습니다.',
      hint: first ? `${first.path.join('.')}: ${first.message}` : undefined,
    });
    return;
  }

  if (isAppError(err)) {
    res.status(err.status).json({ error: err.message, hint: err.hint });
    return;
  }

  log.error('처리하지 못한 오류', err);
  res.status(500).json({ error: '서버에서 오류가 발생했습니다.', hint: String(err) });
});

app.listen(config.port, () => {
  log.info(`서버 시작 → http://localhost:${config.port}`);
  log.info(`작업 폴더: ${config.workspace}`);
});
