import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { parseId } from '../utils/validation.js';
import {
  changeRequestStatus,
  createMaterialRequest,
  listMyRequests,
  listReceivedRequests,
} from '../services/requests.service.js';

function idFrom(value, message = 'Invalid request id.') {
  const id = parseId(value);
  if (!id) throw new AppError(400, message);
  return id;
}

export const create = asyncHandler(async (req, res) => {
  const materialId = idFrom(req.params.materialId, 'Invalid material id.');
  const request = await createMaterialRequest(materialId, req.user.id);
  res.status(201).json({ success: true, data: request });
});

export const mine = asyncHandler(async (req, res) => {
  const requests = await listMyRequests(req.user.id);
  res.json({ success: true, data: requests });
});

export const received = asyncHandler(async (req, res) => {
  const requests = await listReceivedRequests(req.user.id);
  res.json({ success: true, data: requests });
});

export const updateStatus = asyncHandler(async (req, res) => {
  const id = idFrom(req.params.id);
  const status = req.body?.status;
  if (!['ACCEPTED', 'REJECTED', 'CANCELLED'].includes(status)) {
    throw new AppError(400, 'Status must be ACCEPTED, REJECTED, or CANCELLED.');
  }
  const request = await changeRequestStatus(id, req.user.id, status);
  res.json({ success: true, data: request });
});
