const express = require('express');
const {
  completeTask,
  createTask,
  deleteTask,
  getCreateTaskOptions,
  getDashboard,
  getReassignOptions,
  getTaskDetails,
  getTasks,
  reassignTask,
  updateTask,
} = require('../controllers/doctorTaskController');

const router = express.Router();

router.get('/dashboard', getDashboard);
router.get('/options', getCreateTaskOptions);
router.get('/', getTasks);
router.post('/', createTask);
router.get('/:taskId', getTaskDetails);
router.put('/:taskId', updateTask);
router.patch('/:taskId/complete', completeTask);
router.get('/:taskId/reassign-options', getReassignOptions);
router.patch('/:taskId/reassign', reassignTask);
router.delete('/:taskId', deleteTask);

module.exports = router;
