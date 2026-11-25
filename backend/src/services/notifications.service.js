import { prisma } from '../config/database.js';
import { AppError } from '../utils/AppError.js';

const notificationSelect = {
  id: true,
  materialId: true,
  requestId: true,
  type: true,
  title: true,
  message: true,
  isRead: true,
  createdAt: true,
};

export async function listNotifications(recipientId) {
  const [notifications, unreadCount] = await prisma.$transaction([
    prisma.notification.findMany({
      where: { recipientId },
      select: notificationSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    }),
    prisma.notification.count({ where: { recipientId, isRead: false } }),
  ]);
  return { notifications, unreadCount };
}

export const countUnreadNotifications = (recipientId) =>
  prisma.notification.count({ where: { recipientId, isRead: false } });

export async function notifyPendingRequestersOfUnavailableMaterial(
  tx,
  { materialId, excludedRequestId, title, message },
) {
  const pendingRequests = await tx.materialRequest.findMany({
    where: {
      materialId,
      status: 'PENDING',
      ...(excludedRequestId && { id: { not: excludedRequestId } }),
    },
    select: { id: true, requesterId: true },
  });
  if (!pendingRequests.length) return;

  await tx.notification.createMany({
    data: pendingRequests.map((request) => ({
      recipientId: request.requesterId,
      materialId,
      requestId: request.id,
      type: 'MATERIAL_UNAVAILABLE',
      title,
      message,
    })),
    skipDuplicates: true,
  });
}

export async function markNotificationRead(notificationId, recipientId) {
  const result = await prisma.notification.updateMany({
    where: { id: notificationId, recipientId },
    data: { isRead: true },
  });
  if (result.count !== 1) throw new AppError(404, 'Notification not found.');

  return prisma.notification.findUnique({
    where: { id: notificationId },
    select: notificationSelect,
  });
}

export const markAllNotificationsRead = (recipientId) =>
  prisma.notification.updateMany({
    where: { recipientId, isRead: false },
    data: { isRead: true },
  });

export async function deleteNotification(notificationId, recipientId) {
  const result = await prisma.notification.deleteMany({
    where: { id: notificationId, recipientId },
  });
  if (result.count !== 1) throw new AppError(404, 'Notification not found.');
}
