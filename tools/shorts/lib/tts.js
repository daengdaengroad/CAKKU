// 문장 하나당 mp3 하나. 구글 Cloud Text-to-Speech REST API를 쓴다.
// 키가 없으면 offline 모드로 같은 길이의 무음 mp3를 만들어 파이프라인만 검증한다.

const fs = require('fs');
const path = require('path');
const { ffmpeg, durationOf } = require('./ffmpeg');
const { CHARS_PER_SECOND } = require('./script');

const ENDPOINT = 'https://texttospeech.googleapis.com/v1/text:synthesize';
const DEFAULT_VOICE = process.env.TTS_VOICE || 'ko-KR-Neural2-C';
const DEFAULT_RATE = Number(process.env.TTS_SPEAKING_RATE || 1.05);

async function synthesizeGoogle({ text, outFile, apiKey, voice, rate }) {
  const res = await fetch(`${ENDPOINT}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode: 'ko-KR', name: voice },
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate: rate,
        pitch: 0,
        // 휴대폰 스피커에서 들리게 살짝 올린다.
        effectsProfileId: ['handset-class-device'],
      },
    }),
  });
  if (!res.ok) throw new Error(`Google TTS ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  if (!data.audioContent) throw new Error('Google TTS 응답에 audioContent 없음');
  fs.writeFileSync(outFile, Buffer.from(data.audioContent, 'base64'));
}

// 글자 수로 길이를 추정해 무음 mp3를 만든다 (키 없이 렌더링 시간 측정용).
async function synthesizeSilent({ text, outFile }) {
  const seconds = Math.max(1.2, text.replace(/\s/g, '').length / CHARS_PER_SECOND + 0.4);
  await ffmpeg([
    '-f', 'lavfi',
    '-i', 'anullsrc=channel_layout=mono:sample_rate=24000',
    '-t', seconds.toFixed(3),
    '-c:a', 'libmp3lame', '-q:a', '9',
    outFile,
  ], { capture: true });
}

/**
 * 문장 배열 -> { engine, clips: [{ index, text, file }] }
 * 길이는 measureClips()에서 따로 잰다 (단계별 소요 시간을 나눠 재기 위해).
 */
async function synthesizeLines(lines, { outDir, mode = 'auto', voice = DEFAULT_VOICE, rate = DEFAULT_RATE } = {}) {
  fs.mkdirSync(outDir, { recursive: true });
  const apiKey = process.env.GOOGLE_TTS_API_KEY || process.env.GOOGLE_API_KEY;

  let engine = mode;
  if (mode === 'auto') engine = apiKey ? 'google' : 'offline';
  if (engine === 'google' && !apiKey) {
    throw new Error('GOOGLE_TTS_API_KEY 가 없습니다. .env에 넣거나 --tts=offline 으로 돌리세요.');
  }

  const clips = [];
  for (let i = 0; i < lines.length; i += 1) {
    const text = lines[i];
    const file = path.join(outDir, `line-${String(i + 1).padStart(2, '0')}.mp3`);
    if (engine === 'google') {
      await synthesizeGoogle({ text, outFile: file, apiKey, voice, rate });
    } else {
      await synthesizeSilent({ text, outFile: file });
    }
    clips.push({ index: i, text, file });
  }
  return { engine, clips };
}

// 각 mp3의 실제 길이(초)를 ffprobe로 잰다. 자막/사진 타이밍의 기준값.
async function measureClips(clips) {
  const measured = [];
  for (const clip of clips) {
    measured.push({ ...clip, seconds: await durationOf(clip.file) });
  }
  return measured;
}

module.exports = { synthesizeLines, measureClips, DEFAULT_VOICE };
