importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCs2H0N2c4kz9RvNOBlfTplxLGYMfnY6IU",
  projectId: "hss-all-in-one",
  messagingSenderId: "978993384932",
  appId: "1:978993384932:web:8d841a6bb5e840f1910bf1"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification?.title || 'HSS ALL IN ONE Notification';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new update from school.',
    icon: '/icon.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
