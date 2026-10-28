import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  parseId,
  parseListQuery,
  validateAvailabilityInput,
  validateMaterialInput,
} from '../utils/validation.js';
import {
  createMaterial,
  deleteMaterial,
  findMaterialById,
  listMaterials,
  updateMaterial,
} from '../services/material.service.js';

function requireValid({ data, errors }, message = 'Please correct the highlighted fields.') {
  if (Object.keys(errors).length) throw new AppError(400, message, errors);
  return data;
}

function idFrom(req) {
  const id = parseId(req.params.id);
  if (!id) throw new AppError(400, 'Invalid material id.');
  return id;
}

// Loads a material and makes sure the logged-in user owns it.
async function loadOwned(req) {
  const material = await findMaterialById(idFrom(req));
  if (!material) throw new AppError(404, 'Material not found.');
  if (material.ownerId !== req.user.id) throw new AppError(403, 'You can only modify your own listings.');
  return material;
}

export const list = asyncHandler(async (req, res) => {
  const { filters, errors } = parseListQuery(req.query, { defaultAvailability: 'available' });
  requireValid({ data: filters, errors }, 'Invalid search or filter values.');
  const { items, meta } = await listMaterials(filters);
  res.json({ success: true, data: items, meta });
});

export const mine = asyncHandler(async (req, res) => {
  const { filters, errors } = parseListQuery(req.query, { defaultAvailability: 'all' });
  requireValid({ data: filters, errors }, 'Invalid search or filter values.');
  const { items, meta } = await listMaterials(filters, { ownerId: req.user.id });
  res.json({ success: true, data: items, meta });
});

export const getOne = asyncHandler(async (req, res) => {
  const material = await findMaterialById(idFrom(req));
  if (!material) throw new AppError(404, 'Material not found.');
  res.json({ success: true, data: material });
});

export const create = asyncHandler(async (req, res) => {
  const data = requireValid(validateMaterialInput(req.body));
  const material = await createMaterial(req.user.id, data); // owner = verified session user
  res.status(201).json({ success: true, data: material });
});

export const update = asyncHandler(async (req, res) => {
  const existing = await loadOwned(req);
  const data = requireValid(validateMaterialInput(req.body));
  const material = await updateMaterial(existing.id, data);
  res.json({ success: true, data: material });
});

export const setAvailability = asyncHandler(async (req, res) => {
  const existing = await loadOwned(req);
  const data = requireValid(validateAvailabilityInput(req.body), 'Invalid availability value.');
  const material = await updateMaterial(existing.id, data);
  res.json({ success: true, data: material });
});

export const remove = asyncHandler(async (req, res) => {
  const existing = await loadOwned(req);
  await deleteMaterial(existing.id);
  res.json({ success: true, message: 'Listing deleted.' });
});
