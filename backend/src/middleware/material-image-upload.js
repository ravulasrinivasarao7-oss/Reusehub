import multer from 'multer';
import { AppError } from '../utils/AppError.js';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_SIZE, files: 1 },
  fileFilter(req, file, callback) {
    if (!allowedTypes.has(file.mimetype)) {
      callback(new AppError(400, 'Choose a JPG, JPEG, PNG, or WebP image.'));
      return;
    }
    callback(null, true);
  },
});

export function receiveMaterialImage(req, res, next) {
  upload.single('image')(req, res, (error) => {
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        next(new AppError(413, 'Image must be 5 MB or smaller.'));
        return;
      }
      next(new AppError(400, 'Please upload one image file.'));
      return;
    }
    next(error);
  });
}
