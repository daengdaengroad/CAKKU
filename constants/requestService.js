import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { getDeviceId } from './device';

export const createServiceRequest = async ({ type, name, phone, message }) => {
  const deviceId = await getDeviceId();
  await addDoc(collection(db, 'requests'), {
    type,
    name,
    phone,
    message,
    deviceId,
    status: 'pending',
    createdAt: serverTimestamp(),
  });
};
