import { prisma } from '../config/database.js';
import { AppError } from '../utils/AppError.js';
import { notifyPendingRequestersOfUnavailableMaterial } from './notifications.service.js';

const requestInclude = {
  material: {
    include: { owner: { select: { id: true, name: true } } },
  },
  requester: { select: { id: true, name: true } },
};

export async function createMaterialRequest(materialId, requesterId, message = null) {
  try {
    return await prisma.$transaction(async (tx) => {
      const [material] = await tx.$queryRaw`
        SELECT "id", "ownerId", "title", "isAvailable"
        FROM "materials"
        WHERE "id" = ${materialId}
        FOR UPDATE
      `;
      if (!material) throw new AppError(404, 'Material not found.');
      if (material.ownerId === requesterId) throw new AppError(403, 'You cannot request your own material.');
      if (!material.isAvailable) throw new AppError(409, 'This material is no longer available.');

      const pendingRequest = await tx.materialRequest.findFirst({
        where: { materialId, requesterId, status: 'PENDING' },
        select: { id: true },
      });
      if (pendingRequest) throw new AppError(409, 'You already have a pending request for this material.');

      const requester = await tx.user.findUnique({
        where: { id: requesterId },
        select: { name: true },
      });
      const request = await tx.materialRequest.create({
        data: { materialId, requesterId, message },
        include: requestInclude,
      });
      await tx.notification.create({
        data: {
          recipientId: material.ownerId,
          materialId,
          requestId: request.id,
          type: 'NEW_MATERIAL_REQUEST',
          title: 'New material request',
          message: `${requester?.name || 'A ReUseHub member'} requested ${material.title}.`,
        },
      });
      return request;
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
      include: requestInclude,
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

    const [material] = await tx.$queryRaw`
      SELECT "id", "ownerId", "title", "isAvailable"
      FROM "materials"
      WHERE "id" = ${request.materialId}
      FOR UPDATE
    `;
    if (!material) throw new AppError(404, 'Material not found.');

    if (status === 'ACCEPTED') {
      const alreadyAccepted = await tx.materialRequest.findFirst({
        where: { materialId: request.materialId, status: 'ACCEPTED' },
        select: { id: true },
      });
      if (alreadyAccepted) throw new AppError(409, 'A request for this material has already been accepted.');
      if (!material.isAvailable) {
        throw new AppError(409, 'This material is no longer available to accept.');
      }

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

    const updatedRequest = await tx.materialRequest.findUnique({
      where: { id: requestId },
      include: requestInclude,
    });

    const notification = status === 'ACCEPTED'
      ? {
          recipientId: request.requesterId,
          type: 'REQUEST_ACCEPTED',
          title: 'Your request was accepted',
          message: `${request.material.owner.name} accepted your request for ${request.material.title}.`,
        }
      : status === 'REJECTED'
        ? {
            recipientId: request.requesterId,
            type: 'REQUEST_REJECTED',
            title: 'Your request was declined',
            message: `${request.material.owner.name} declined your request for ${request.material.title}.`,
          }
        : {
            recipientId: request.material.ownerId,
            type: 'REQUEST_CANCELLED',
            title: 'A material request was cancelled',
            message: `${request.requester.name} cancelled their request for ${request.material.title}.`,
          };

    await tx.notification.create({
      data: {
        ...notification,
        materialId: request.materialId,
        requestId,
      },
    });

    if (status === 'ACCEPTED') {
      await notifyPendingRequestersOfUnavailableMaterial(tx, {
        materialId: request.materialId,
        excludedRequestId: requestId,
        title: 'Requested material is no longer available',
        message: `${request.material.owner.name} accepted another request for ${request.material.title}.`,
      });
    }

    return updatedRequest;
  });
}
