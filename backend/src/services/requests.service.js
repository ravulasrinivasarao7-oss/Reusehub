import { prisma } from '../config/database.js';
import { AppError } from '../utils/AppError.js';

const requestInclude = {
  material: {
    include: { owner: { select: { id: true, name: true } } },
  },
  requester: { select: { id: true, name: true } },
};

export async function createMaterialRequest(materialId, requesterId, message = null) {
  const material = await prisma.material.findUnique({ where: { id: materialId } });
  if (!material) throw new AppError(404, 'Material not found.');
  if (material.ownerId === requesterId) throw new AppError(403, 'You cannot request your own material.');
  if (!material.isAvailable) throw new AppError(409, 'This material is no longer available.');

  const pendingRequest = await prisma.materialRequest.findFirst({
    where: { materialId, requesterId, status: 'PENDING' },
    select: { id: true },
  });
  if (pendingRequest) throw new AppError(409, 'You already have a pending request for this material.');

  try {
    return await prisma.materialRequest.create({
      data: { materialId, requesterId, message },
      include: requestInclude,
    });
  } catch (error) {
    if (error.code === 'P2002') {
      throw new AppError(409, 'You already have a pending request for this material.');
    }
    throw error;
  }
}

export const listMyRequests = (requesterId) =>
  prisma.materialRequest.findMany({
    where: { requesterId },
    include: requestInclude,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });

export const listReceivedRequests = (ownerId) =>
  prisma.materialRequest.findMany({
    where: { material: { ownerId } },
    include: requestInclude,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });

export async function changeRequestStatus(requestId, userId, status) {
  return prisma.$transaction(async (tx) => {
    const request = await tx.materialRequest.findUnique({
      where: { id: requestId },
      include: { material: true },
    });
    if (!request) throw new AppError(404, 'Request not found.');

    const isCancellation = status === 'CANCELLED';
    if (isCancellation) {
      if (request.requesterId !== userId) throw new AppError(403, 'You can only cancel your own requests.');
    } else if (request.material.ownerId !== userId) {
      throw new AppError(403, 'Only the material owner can respond to this request.');
    }

    if (request.status !== 'PENDING') {
      throw new AppError(409, 'Only pending requests can be updated.');
    }

    if (status === 'ACCEPTED') {
      const alreadyAccepted = await tx.materialRequest.findFirst({
        where: { materialId: request.materialId, status: 'ACCEPTED' },
        select: { id: true },
      });
      if (alreadyAccepted) throw new AppError(409, 'A request for this material has already been accepted.');

      const availability = await tx.material.updateMany({
        where: { id: request.materialId, isAvailable: true },
        data: { isAvailable: false },
      });
      if (availability.count !== 1) {
        throw new AppError(409, 'This material is no longer available to accept.');
      }
    }

    const updated = await tx.materialRequest.updateMany({
      where: { id: requestId, status: 'PENDING' },
      data: { status },
    });
    if (updated.count !== 1) throw new AppError(409, 'This request has already been updated.');

    return tx.materialRequest.findUnique({
      where: { id: requestId },
      include: requestInclude,
    });
  });
}
