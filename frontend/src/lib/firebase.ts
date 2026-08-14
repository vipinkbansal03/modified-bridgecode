import { initializeApp, getApps, getApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const requestForToken = async () => {
  try {
    const supported = await isSupported();
    if (!supported) return null;

    // Explicitly ask for permission (some browsers require this before getToken)
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('Notification permission not granted:', permission);
      return null;
    }

    const messaging = getMessaging(app);
    
    // Explicitly register the service worker and pass config via query params
    const swUrl = `/firebase-messaging-sw.js?apiKey=${firebaseConfig.apiKey}&authDomain=${firebaseConfig.authDomain}&projectId=${firebaseConfig.projectId}&storageBucket=${firebaseConfig.storageBucket}&senderId=${firebaseConfig.messagingSenderId}&appId=${firebaseConfig.appId}`;
    const registration = await navigator.serviceWorker.register(swUrl);
    
    const currentToken = await getToken(messaging, { 
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: registration
    });
    
    if (currentToken) {
      return currentToken;
    } else {
      console.log('No registration token available. Request permission to generate one.');
      return null;
    }
  } catch (err) {
    console.error('An error occurred while retrieving token. ', err);
    return null;
  }
};

export const onMessageListener = () =>
  new Promise((resolve) => {
    isSupported().then((supported) => {
      if (supported) {
        const messaging = getMessaging(app);
        onMessage(messaging, (payload) => {
          resolve(payload);
        });
      }
    });
  });

export { app };
