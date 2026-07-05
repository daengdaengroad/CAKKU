import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';
import { getDeviceId } from './device';

export const loadCar = async () => {
  const deviceId = await getDeviceId();
  const snap = await getDoc(doc(db, 'cars', deviceId));
  return snap.exists() ? snap.data() : null;
};

export const saveCar = async (car) => {
  const deviceId = await getDeviceId();
  await setDoc(doc(db, 'cars', deviceId), car);
  return car;
};

export const deleteCar = async () => {
  const deviceId = await getDeviceId();
  await deleteDoc(doc(db, 'cars', deviceId));
};
