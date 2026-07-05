import AsyncStorage from '@react-native-async-storage/async-storage';

const DEVICE_ID_KEY = 'deviceId';

const randomId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export const getDeviceId = async () => {
  let id = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = randomId();
    await AsyncStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
};
