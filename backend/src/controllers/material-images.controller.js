import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { extname, join } from 'node:path';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

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

export const uploadMaterialImage = asyncHandler(async (req, res) => {
  if (!env.materialUploadDir) {
    throw new AppError(503, 'Image uploads are not configured. Set MATERIAL_UPLOAD_DIR to a persistent disk path.');
  }
  const file = req.file;
  if (!file) throw new AppError(400, 'Choose an image to upload.');

  const extension = extname(file.originalname).toLowerCase();
  if (
    formatByExtension.get(extension) !== file.mimetype
    || !hasExpectedSignature(file.buffer, file.mimetype)
  ) {
    throw new AppError(400, 'The uploaded file is not a valid JPG, JPEG, PNG, or WebP image.');
  }

  await mkdir(env.materialUploadDir, { recursive: true });
  const filename = `${randomUUID()}${extension}`;
  await writeFile(join(env.materialUploadDir, filename), file.buffer, { flag: 'wx' });
  res.status(201).json({ success: true, data: { imageUrl: `/uploads/${filename}` } });
});
