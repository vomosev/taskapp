'use strict';

const taskService = require('../services/taskService');

async function listTasks(req, res, next) {
  try {
    const tasks = await taskService.listTasks(req.user.id);
    return res.status(200).json({ tasks });
  } catch (error) {
    return next(error);
  }
}

async function createTask(req, res, next) {
  try {
    const task = await taskService.createTask(req.user.id, req.body);
    return res.status(201).json({ task });
  } catch (error) {
    return next(error);
  }
}

async function updateTask(req, res, next) {
  try {
    const task = await taskService.updateTask(
      req.user.id,
      req.params.id,
      req.body
    );

    return res.status(200).json({ task });
  } catch (error) {
    return next(error);
  }
}

async function deleteTask(req, res, next) {
  try {
    await taskService.deleteTask(req.user.id, req.params.id);
    return res.status(200).json({
      message: 'Task deleted successfully'
    });
  } catch (error) {
    return next(error);
  }
}

async function reorderTasks(req, res, next) {
  try {
    const tasks = await taskService.reorderTasks(req.user.id, req.body);
    return res.status(200).json({ tasks });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listTasks,
  createTask,
  updateTask,
  deleteTask,
  reorderTasks
};