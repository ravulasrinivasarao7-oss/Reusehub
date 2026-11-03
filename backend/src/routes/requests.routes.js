import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { create, mine, received, updateStatus } from '../controllers/requests.controller.js';

const router = Router();

router.use(requireAuth);
router.get('/mine', mine);
router.get('/received', received);
router.post('/materials/:materialId', create);
router.patch('/:id/status', updateStatus);

export default router;
