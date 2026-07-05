import { httpsCallable } from 'firebase/functions';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db, functions } from './firebase';
import { getDeviceId } from './device';

export const runDiagnosis = async (imageBase64, mimeType, symptomText) => {
  const deviceId = await getDeviceId();
  const diagnoseCarPhoto = httpsCallable(functions, 'diagnoseCarPhoto');
  const res = await diagnoseCarPhoto({ imageBase64, mimeType, symptomText, deviceId });
  return res.data;
};

export const loadDiagnosisHistory = async () => {
  const deviceId = await getDeviceId();
  const q = query(
    collection(db, 'diagnoses'),
    where('deviceId', '==', deviceId),
    orderBy('createdAt', 'desc'),
    limit(10)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};
