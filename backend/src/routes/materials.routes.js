import { Router } from 'express';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import {
  create,
  getOne,
  list,
  mine,
  remove,
  setAvailability,
  update,
} from '../controllers/materials.controller.js';

const router = Router();

router.get('/', optionalAuth, list);
router.get('/mine', requireAuth, mine); // must be declared before '/:id'
router.post('/', requireAuth, create);
router.get('/:id', optionalAuth, getOne);
router.put('/:id', requireAuth, update);
router.patch('/:id/availability', requireAuth, setAvailability);
router.delete('/:id', requireAuth, remove);

export default router;
