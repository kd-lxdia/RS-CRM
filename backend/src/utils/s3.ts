import AWS from 'aws-sdk';

// Configure S3 instances grabbing ENV defaults
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'mock',
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'mock',
  region: process.env.AWS_REGION || 'ap-south-1',
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || 'slar-crm-documents';

/**
 * Uploads a raw buffer to S3 paths.
 */
export async function uploadBufferToS3(buffer: Buffer, keyPath: string, contentType: string): Promise<string> {
  const params = {
    Bucket: BUCKET_NAME,
    Key: keyPath,
    Body: buffer,
    ContentType: contentType,
  };

  const data = await s3.upload(params).promise();
  return data.Location;
}

/**
 * Converts a Base64 string (typically from Canvas PNG) to a buffer and uploads to S3.
 */
export async function uploadBase64ToS3(base64DataUrl: string, keyPath: string): Promise<string> {
  // Strip off standard data URL preamble if it exists (e.g. data:image/png;base64,)
  const base64Data = base64DataUrl.replace(/^data:image\/\\w+;base64,/, '');
  const buffer = Buffer.from(base64Data, 'base64');
  
  return uploadBufferToS3(buffer, keyPath, 'image/png');
}
