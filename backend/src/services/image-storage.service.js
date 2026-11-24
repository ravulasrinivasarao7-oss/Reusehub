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

  if (!process.env.CLOUDINARY_URL?.trim()) {
    throw new AppError(503, 'Image uploads are not configured. Set CLOUDINARY_URL.');
  }

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
    const errorName = typeof error?.name === 'string' && /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/.test(error.name)
      ? error.name
      : 'Error';
    const errorCode = typeof error?.code === 'string' && /^[A-Za-z0-9_.-]{1,40}$/.test(error.code)
      ? error.code
      : undefined;
    const httpStatus = [error?.http_code, error?.statusCode]
      .find((value) => Number.isInteger(value) && value >= 100 && value <= 599);
    console.error('Cloudinary image upload failed:', {
      errorName,
      ...(errorCode && { errorCode }),
      ...(httpStatus && { httpStatus }),
    });
    throw new AppError(502, 'Image storage is temporarily unavailable. Please try again.');
  }

  return result.secure_url;
}
