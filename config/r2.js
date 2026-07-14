const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

let s3Client = null;
const bucketName = process.env.R2_BUCKET_NAME;
const publicUrlPrefix = process.env.R2_PUBLIC_URL_PREFIX;

try {
  if (process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_ENDPOINT) {
    s3Client = new S3Client({
      region: 'auto',
      endpoint: process.env.R2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });
    logger.info('Cloudflare R2 client initialized.');
  } else {
    logger.warn('Cloudflare R2 credentials or endpoint missing in environment variables. File uploads will fail.');
  }
} catch (error) {
  logger.error(`Error initializing Cloudflare R2 Client: ${error.message}`, { stack: error.stack });
}

/**
 * Upload a local file to Cloudflare R2
 * @param {string} localFilePath - Path to the local file
 * @param {string} destinationKey - The destination key (filename) in R2
 * @param {string} [contentType] - Optional content type (e.g. video/mp4)
 * @returns {Promise<string>} - The public URL of the uploaded file
 */
async function uploadFile(localFilePath, destinationKey, contentType = 'video/mp4') {
  if (!s3Client) {
    throw new Error('R2 client is not initialized. Check R2 credentials in .env.');
  }

  if (!fs.existsSync(localFilePath)) {
    throw new Error(`Local file not found for R2 upload: ${localFilePath}`);
  }

  logger.info(`Starting upload of ${localFilePath} to R2 bucket "${bucketName}" as "${destinationKey}"`);
  
  const fileStream = fs.createReadStream(localFilePath);
  const fileStats = fs.statSync(localFilePath);

  const uploadParams = {
    Bucket: bucketName,
    Key: destinationKey,
    Body: fileStream,
    ContentType: contentType,
    ContentLength: fileStats.size
  };

  try {
    const command = new PutObjectCommand(uploadParams);
    await s3Client.send(command);
    
    // Construct the public URL
    const cleanPrefix = publicUrlPrefix.endsWith('/') ? publicUrlPrefix.slice(0, -1) : publicUrlPrefix;
    const publicUrl = `${cleanPrefix}/${destinationKey}`;
    logger.info(`Upload complete. R2 Public URL: ${publicUrl}`);
    return publicUrl;
  } catch (error) {
    logger.error(`R2 upload failed: ${error.message}`, { stack: error.stack });
    throw error;
  }
}

module.exports = {
  s3Client,
  uploadFile
};
