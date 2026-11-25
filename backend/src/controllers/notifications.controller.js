import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { parseId } from '../utils/validation.js';
import {
  countUnreadNotifications,
  deleteNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../services/notifications.service.js';

function notificationIdFrom(value) {
  const id = parseId(value);
  if (!id) throw new AppError(400, 'Invalid notification id.');
  return id;
}

export const list = asyncHandler(async (req, res) => {
  const data = await listNotifications(req.user.id);
  res.json({ success: true, data: data.notifications, meta: { unreadCount: data.unreadCount } });
});

export const unreadCount = asyncHandler(async (req, res) => {
  const count = await countUnreadNotifications(req.user.id);
  res.json({ success: true, data: { unreadCount: count } });
});

export const markRead = asyncHandler(async (req, res) => {
  const notification = await markNotificationRead(notificationIdFrom(req.params.id), req.user.id);
  res.json({ success: true, data: notification });
});

export const markAllRead = asyncHandler(async (req, res) => {
  const result = await markAllNotificationsRead(req.user.id);
  res.json({ success: true, data: { updatedCount: result.count } });
});

export const remove = asyncHandler(async (req, res) => {
  await deleteNotification(notificationIdFrom(req.params.id), req.user.id);
  res.json({ success: true, data: { deleted: true } });
});

export const streamUnreadCount = (req, res) => {
  res.status(200).set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  res.write('retry: 10000\n\n');

  const recipientId = req.user.id;
  let closed = false;
  let checking = false;
  const sendUnreadCount = async () => {
    if (closed || checking) return;
    checking = true;
    try {
      const unreadCount = await countUnreadNotifications(recipientId);
      if (!closed) {
        res.write(`event: unread-count\ndata: ${JSON.stringify({ unreadCount })}\n\n`);
      }
    } catch (error) {
      console.error('Notification stream poll failed:', {
        errorName: typeof error?.name === 'string' ? error.name : 'Error',
        ...(typeof error?.code === 'string' && { errorCode: error.code }),
      });
      clearInterval(interval);
      if (!res.writableEnded) res.end();
    } finally {
      checking = false;
    }
  };
  const interval = setInterval(sendUnreadCount, 10000);
  res.on('close', () => {
    closed = true;
    clearInterval(interval);
  });
  sendUnreadCount();
};
