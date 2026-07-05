import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyD5M9ZoMkorp-mQqT1cg9UCZ2M5uXlywdQ",
  authDomain: "cakku-e4dc4.firebaseapp.com",
  projectId: "cakku-e4dc4",
  storageBucket: "cakku-e4dc4.firebasestorage.app",
  messagingSenderId: "786430828834",
  appId: "1:786430828834:web:92f84f3d212dced016057b",
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
