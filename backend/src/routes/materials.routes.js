import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
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

router.use(requireAuth); // every materials endpoint requires a verified session

router.get('/', list);
router.get('/mine', mine); // must be declared before '/:id'
router.post('/', create);
router.get('/:id', getOne);
router.put('/:id', update);
router.patch('/:id/availability', setAvailability);
router.delete('/:id', remove);

export default router;
