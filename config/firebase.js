const { applicationDefault, cert, getApps, initializeApp } = require('firebase-admin/app');
const { getMessaging } = require('firebase-admin/messaging');

let messagingInstance;

const getFirebaseMessaging = () => {
  if (messagingInstance) return messagingInstance;

  const projectId = String(process.env.FIREBASE_PROJECT_ID || '').trim();
  if (!projectId) return null;

  let app = getApps()[0];

  if (!app) {
    const clientEmail = String(process.env.FIREBASE_CLIENT_EMAIL || '').trim();
    const privateKey = String(process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
    const credential = clientEmail && privateKey
      ? cert({ projectId, clientEmail, privateKey })
      : applicationDefault();

    app = initializeApp({ credential, projectId });
  }

  messagingInstance = getMessaging(app);
  return messagingInstance;
};

module.exports = { getFirebaseMessaging };
