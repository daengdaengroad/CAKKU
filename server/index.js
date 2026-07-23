require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const diagnoseRouter = require('./routes/diagnose');
const shopsRouter = require('./routes/shops');
const chatRouter = require('./routes/chat');
const directoryRouter = require('./routes/directory');
const roadviewRouter = require('./routes/roadview');
const reservationRouter = require('./routes/reservation');
const { initReservations } = require('./services/db');

const app = express();
const PORT = process.env.PORT || 3001;
const WEB_BUILD_DIR = path.join(__dirname, '..', 'dist');

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString('ko-KR')}] ${req.method} ${req.originalUrl}`);
  next();
});

app.use('/api', diagnoseRouter);
app.use('/api', shopsRouter);
app.use('/api', chatRouter);
app.use('/api', directoryRouter);
app.use('/api', roadviewRouter);
app.use('/api', reservationRouter);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use(express.static(WEB_BUILD_DIR, { extensions: ['html'] }));

app.listen(PORT, () => {
  console.log(`CarCare Agency 서버 실행 중: http://localhost:${PORT}`);
  initReservations().catch((e) => console.error('예약 테이블 초기화 실패:', e.message));
});
