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

const isConfigValid = Boolean(
  firebaseConfig.apiKey && 
  firebaseConfig.authDomain && 
  firebaseConfig.projectId && 
  firebaseConfig.storageBucket && 
  firebaseConfig.messagingSenderId && 
  firebaseConfig.appId
);

let app: any = null;
if (isConfigValid) {
  try {
    app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  } catch (err) {
    console.error("Firebase initialization failed:", err);
  }
} else {
  if (typeof window !== "undefined") {
    console.warn("Firebase configuration is missing or incomplete. Push notifications are disabled.");
  }
}

export const requestForToken = async () => {
  if (!isConfigValid || !app) return null;
  try {
    if (!app) {
      console.warn("Firebase app not initialized, skipping token request.");
      return null;
    }
    const supported = await isSupported();
    if (!supported) return null;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return null;
    }

    const messaging = getMessaging(app);
    
    const swUrl = `/firebase-messaging-sw.js?apiKey=${firebaseConfig.apiKey}&authDomain=${firebaseConfig.authDomain}&projectId=${firebaseConfig.projectId}&storageBucket=${firebaseConfig.storageBucket}&senderId=${firebaseConfig.messagingSenderId}&appId=${firebaseConfig.appId}`;
    const registration = await navigator.serviceWorker.register(swUrl);
    
    const currentToken = await getToken(messaging, { 
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: registration
    });
    
    return currentToken || null;
  } catch (err) {
    return null;
  }
};

export const onMessageListener = () =>
  new Promise((resolve, reject) => {
    if (!isConfigValid || !app) {
      reject(new Error("Firebase app not initialized or config invalid."));
      return;
    }
    isSupported().then((supported) => {
      if (supported) {
        try {
          const messaging = getMessaging(app);
          onMessage(messaging, (payload) => {
            resolve(payload);
          });
        } catch (err) {
          reject(err);
        }
      } else {
        reject(new Error("Messaging not supported."));
      }
    }).catch(reject);
  });

export { app };
