const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { defineSecret } = require('firebase-functions/params');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const nodemailer = require('nodemailer');

initializeApp();

const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');
const GMAIL_APP_PASSWORD = defineSecret('GMAIL_APP_PASSWORD');
const MANAGER_EMAIL = 'cakku2026@gmail.com';

const REQUEST_TYPE_LABEL = {
  reservation: '정비소 예약 맡기기',
  estimate: '견적서 봐주세요',
  consult: '매니저에게 문의',
};

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    issue: { type: 'STRING', description: '사진 속 차량 손상/증상에 대한 한글 설명' },
    costMin: { type: 'NUMBER', description: '예상 수리비 최소 금액 (원)' },
    costMax: { type: 'NUMBER', description: '예상 수리비 최대 금액 (원)' },
    note: { type: 'STRING', description: '추가 참고사항 (한글, 1~2문장)' },
  },
  required: ['issue', 'costMin', 'costMax', 'note'],
};

const PROMPT = `당신은 자동차 정비 전문가입니다. 첨부된 사진 속 차량의 손상이나 증상을 보고,
예상되는 문제와 대한민국 기준 대략적인 수리비 범위(원화)를 추정해주세요.
이건 참고용 대략적인 추정치이며 실제 정비소 확인이 필요하다는 점을 note에 반드시 포함하세요.
사진만으로 판단이 어려우면 issue에 그 사실을 명시하고 넓은 범위로 추정하세요.`;

exports.diagnoseCarPhoto = onCall(
  { secrets: [GEMINI_API_KEY], cors: true },
  async (request) => {
    const { imageBase64, mimeType, symptomText, deviceId } = request.data || {};

    if (!imageBase64 || !mimeType || !deviceId) {
      throw new HttpsError('invalid-argument', 'imageBase64, mimeType, deviceId가 모두 필요합니다.');
    }

    const parts = [{ text: symptomText ? `${PROMPT}\n\n고객이 설명한 증상: ${symptomText}` : PROMPT }];
    parts.push({ inline_data: { mime_type: mimeType, data: imageBase64 } });

    let geminiResponse;
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY.value()}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: {
              responseMimeType: 'application/json',
              responseSchema: RESPONSE_SCHEMA,
            },
          }),
        }
      );
      if (!res.ok) {
        const errText = await res.text();
        console.error('Gemini API error', res.status, errText);
        throw new HttpsError('internal', 'AI 분석 요청이 실패했어요. 잠시 후 다시 시도해주세요.');
      }
      geminiResponse = await res.json();
    } catch (e) {
      if (e instanceof HttpsError) throw e;
      console.error('Gemini fetch failed', e);
      throw new HttpsError('internal', 'AI 분석 요청이 실패했어요. 잠시 후 다시 시도해주세요.');
    }

    const rawText = geminiResponse?.candidates?.[0]?.content?.parts?.[0]?.text;
    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch (e) {
      console.error('Failed to parse Gemini JSON', rawText);
      throw new HttpsError('internal', 'AI 응답을 해석하지 못했어요. 다시 시도해주세요.');
    }

    const result = {
      issue: String(parsed.issue || '분석 결과를 확인할 수 없어요.'),
      costMin: Number(parsed.costMin) || 0,
      costMax: Number(parsed.costMax) || 0,
      note: String(parsed.note || '실제 수리비는 정비소 확인이 필요합니다.'),
    };

    const db = getFirestore();
    await db.collection('diagnoses').add({
      deviceId,
      ...result,
      symptomText: symptomText || null,
      createdAt: FieldValue.serverTimestamp(),
    });

    return result;
  }
);

exports.onNewServiceRequest = onDocumentCreated(
  { document: 'requests/{requestId}', secrets: [GMAIL_APP_PASSWORD] },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: MANAGER_EMAIL, pass: GMAIL_APP_PASSWORD.value() },
    });

    const typeLabel = REQUEST_TYPE_LABEL[data.type] || data.type || '문의';

    try {
      await transporter.sendMail({
        from: `카쿠 <${MANAGER_EMAIL}>`,
        to: MANAGER_EMAIL,
        subject: `[카쿠] 새 요청 도착 - ${typeLabel}`,
        text: `이름: ${data.name}\n연락처: ${data.phone}\n요청유형: ${typeLabel}\n내용: ${data.message}`,
      });
    } catch (e) {
      console.error('Failed to send notification email', e);
    }
  }
);
