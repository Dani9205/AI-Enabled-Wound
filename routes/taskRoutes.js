const express = require('express');
const {
  completeTask,
  createTask,
  deleteTask,
  getTasks,
  reassignTask,
  updateTask,
} = require('../controllers/taskController');

const router = express.Router();

router.post('/create-task', createTask);
router.get('/get-task', getTasks);
router.get('/get-task/:id', getTasks);
router.put('/update-task/:id', updateTask);
router.patch('/complete-task/:id', completeTask);
router.patch('/reassign-task/:id', reassignTask);
router.delete('/delete-task/:id', deleteTask);

module.exports = router;
