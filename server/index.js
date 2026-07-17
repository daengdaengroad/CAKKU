require('dotenv').config();

const express = require('express');
const cors = require('cors');
const diagnoseRouter = require('./routes/diagnose');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString('ko-KR')}] ${req.method} ${req.originalUrl}`);
  next();
});

app.use('/api', diagnoseRouter);

app.get('/', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => console.log(`CarCare Agency 서버 실행 중: http://localhost:${PORT}`));
