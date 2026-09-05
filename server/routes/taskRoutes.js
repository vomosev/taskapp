const express = require('express');
const {
  listTasks,
  createTask,
  updateTask,
  deleteTask,
  reorderTasks,
} = require('../controllers/taskController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

router.get('/', listTasks);
router.post('/', createTask);
router.patch('/reorder', reorderTasks);
router.put('/:id', updateTask);
router.delete('/:id', deleteTask);

module.exports = router;