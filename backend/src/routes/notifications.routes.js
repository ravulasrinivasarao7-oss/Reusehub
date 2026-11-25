import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  list,
  markAllRead,
  markRead,
  remove,
  streamUnreadCount,
  unreadCount,
} from '../controllers/notifications.controller.js';

const router = Router();

router.use(requireAuth);
router.get('/stream', streamUnreadCount);
router.get('/unread-count', unreadCount);
router.get('/', list);
router.patch('/read-all', markAllRead);
router.patch('/:id/read', markRead);
router.delete('/:id', remove);

export default router;
