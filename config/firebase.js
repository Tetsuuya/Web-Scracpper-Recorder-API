const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

let db = null;

try {
  if (admin.getApps().length === 0) {
    let serviceAccount = null;

    if (process.env.FIREBASE_CREDENTIALS) {
      try {
        serviceAccount = JSON.parse(process.env.FIREBASE_CREDENTIALS);
        logger.info('Firebase Admin SDK initialized with environment credentials JSON.');
      } catch (err) {
        logger.error(`Failed to parse FIREBASE_CREDENTIALS env variable: ${err.message}`);
      }
    }

    if (!serviceAccount) {
      const credentialsPath = process.env.FIREBASE_CREDENTIALS_PATH || './config/firebase-service-account.json';
      const absolutePath = path.isAbsolute(credentialsPath)
        ? credentialsPath
        : path.join(__dirname, '..', credentialsPath);

      if (fs.existsSync(absolutePath)) {
        serviceAccount = require(absolutePath);
        logger.info('Firebase Admin SDK initialized with service account file.');
      }
    }

    if (serviceAccount) {
      if (serviceAccount.private_key) {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
      }
      admin.initializeApp({
        credential: admin.cert(serviceAccount)
      });
      logger.info('Firebase Admin SDK initialized with service account.');
    } else {
      // Fallback: Try initializing with default credentials (useful for GCP environments or if configured via environment variables)
      admin.initializeApp();
      logger.info('Firebase Admin SDK initialized with default application credentials.');
    }
  }
  
  db = getFirestore();
} catch (error) {
  logger.error(`Failed to initialize Firebase Admin SDK: ${error.message}. Firestore operations will fail.`, { stack: error.stack });
}

module.exports = db;
