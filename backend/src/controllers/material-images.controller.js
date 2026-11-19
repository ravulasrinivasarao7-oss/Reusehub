import { asyncHandler } from '../utils/asyncHandler.js';
import { saveUploadedImage } from '../services/image-storage.service.js';

export const uploadMaterialImage = asyncHandler(async (req, res) => {
  const imageUrl = await saveUploadedImage(req.file);
  res.status(201).json({ success: true, data: { imageUrl } });
});
