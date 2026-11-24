import { randomUUID } from 'node:crypto';
import { v2 as cloudinary } from 'cloudinary';
import { AppError } from '../utils/AppError.js';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const formatByExtension = new Map([
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp'],
]);

function configureCloudinary() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();
  const individualValues = [cloudName, apiKey, apiSecret];

  if (individualValues.some(Boolean)) {
    if (!individualValues.every(Boolean)) {
      throw new AppError(503, 'Image uploads are not configured. Set all three CLOUDINARY_* values.');
    }
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });
    return;
  }

  if (process.env.CLOUDINARY_URL?.trim()) {
    try {
      const { cloud_name: configuredCloud, api_key: configuredKey, api_secret: configuredSecret } = cloudinary.config();
      if (configuredCloud && configuredKey && configuredSecret) return;
    } catch {
      throw new AppError(503, 'Image uploads are not configured. Check the Cloudinary environment variables.');
    }
  }

  throw new AppError(503, 'Image uploads are not configured. Set the Cloudinary environment variables.');
}

function getErrorCause(error) {
  return error?.error && typeof error.error === 'object' ? error.error : error;
}

function safeErrorMessage(value) {
  if (typeof value !== 'string') return undefined;

  let message = value;
  const sensitiveValues = [
    process.env.CLOUDINARY_URL,
    process.env.CLOUDINARY_API_KEY,
    process.env.CLOUDINARY_API_SECRET,
    process.env.CLOUDINARY_CLOUD_NAME,
  ].filter((item) => typeof item === 'string' && item.length > 0);
  sensitiveValues.sort((left, right) => right.length - left.length);
  for (const sensitiveValue of sensitiveValues) {
    message = message.split(sensitiveValue).join('[REDACTED]');
  }

  return message
    .replace(/cloudinary:\/\/[^\s"'<>]+/gi, '[REDACTED_CLOUDINARY_URL]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[REDACTED_EMAIL]')
    .replace(/\bBearer\s+\S+/gi, 'Bearer [REDACTED]')
    .replace(/[\r\n\t]+/g, ' ')
    .slice(0, 400);
}

function getSafeErrorDetails(error, file) {
  const cause = getErrorCause(error);
  const errorName = typeof cause?.name === 'string' && /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/.test(cause.name)
    ? cause.name
    : 'Error';
  const errorCode = [cause?.code, error?.code]
    .find((value) => typeof value === 'string' && /^[A-Za-z0-9_.-]{1,40}$/.test(value));
  const cloudinaryHttpStatus = [cause?.http_code, error?.http_code]
    .find((value) => Number.isInteger(value) && value >= 100 && value <= 599);
  const uploadResponseStatus = [
    cause?.response?.statusCode,
    cause?.response?.status,
    error?.response?.statusCode,
    error?.response?.status,
    cause?.statusCode,
    cause?.status,
    cloudinaryHttpStatus,
  ].find((value) => Number.isInteger(value) && value >= 100 && value <= 599);

  return {
    errorName,
    ...(safeErrorMessage(cause?.message || error?.message) && {
      errorMessage: safeErrorMessage(cause?.message || error?.message),
    }),
    ...(errorCode && { errorCode }),
    ...(cloudinaryHttpStatus && { cloudinaryHttpStatus }),
    ...(uploadResponseStatus && { uploadResponseStatus }),
    ...(Number.isInteger(file?.buffer?.length) && { fileSizeBytes: file.buffer.length }),
    ...(typeof file?.mimetype === 'string' && { mimeType: file.mimetype }),
  };
}

function hasExpectedSignature(buffer, mimeType) {
  if (mimeType === 'image/jpeg') {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimeType === 'image/png') {
    return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'));
  }
  return mimeType === 'image/webp'
    && buffer.length >= 12
    && buffer.toString('ascii', 0, 4) === 'RIFF'
    && buffer.toString('ascii', 8, 12) === 'WEBP';
}

export async function saveUploadedImage(file) {
  if (!file) throw new AppError(400, 'Choose an image to upload.');

  const extension = file.originalname?.match(/\.[^.]+$/)?.[0]?.toLowerCase() || '';
  if (file.buffer.length > MAX_IMAGE_SIZE) {
    throw new AppError(413, 'Image must be 5 MB or smaller.');
  }
  if (
    formatByExtension.get(extension) !== file.mimetype
    || !hasExpectedSignature(file.buffer, file.mimetype)
  ) {
    throw new AppError(400, 'The uploaded file is not a valid JPG, JPEG, PNG, or WebP image.');
  }

  configureCloudinary();

  let result;
  try {
    result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream({
        resource_type: 'image',
        folder: 'reusehub',
        public_id: randomUUID(),
        overwrite: false,
      }, (error, uploadResult) => {
        if (error) {
          reject(error);
        } else if (!uploadResult?.secure_url) {
          reject(new Error('Cloudinary did not return a secure image URL.'));
        } else {
          resolve(uploadResult);
        }
      });

      uploadStream.end(file.buffer);
    });
  } catch (error) {
    console.error('Cloudinary image upload failed:', getSafeErrorDetails(error, file));
    throw new AppError(502, 'Image storage is temporarily unavailable. Please try again.');
  }

  return result.secure_url;
}
