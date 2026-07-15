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
        logger.info(`FIREBASE_CREDENTIALS env var length: ${process.env.FIREBASE_CREDENTIALS.length}`);
        serviceAccount = JSON.parse(process.env.FIREBASE_CREDENTIALS);
        logger.info('Firebase Admin SDK parsed environment credentials JSON successfully.');
        
        if (serviceAccount && serviceAccount.private_key) {
          const pk = serviceAccount.private_key;
          logger.info(`Parsed private_key length: ${pk.length}`);
          logger.info(`Private key starts with: "${pk.slice(0, 40)}..."`);
          logger.info(`Private key ends with: "...${pk.slice(-40)}"`);
          logger.info(`Contains literal \\n: ${pk.includes('\\n')}, Contains real newline: ${pk.includes('\n')}`);
          
          // Print char codes for the first 35 characters to verify if backslashes or newlines exist
          const codes = [];
          for (let i = 0; i < Math.min(pk.length, 35); i++) {
            codes.push(`${pk[i]} (${pk.charCodeAt(i)})`);
          }
          logger.info(`Private key char codes: ${codes.join(', ')}`);
        } else {
          logger.warn('Parsed service account JSON has no private_key field.');
        }
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
