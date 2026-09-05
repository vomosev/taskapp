const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db'); // this should be the setup Sequelize instance

const Task = sequelize.define('Task', {
  // Here are attributes as per taskService.js
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  completed: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  isCompleted: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  status: {
    type: DataTypes.STRING,
    allowNull: true
  },
  priority: {
    type: DataTypes.ENUM,
    values: ['low', 'medium', 'high'] // replace this with your own values if needed
  },
  dueDate: {
    type: DataTypes.DATE,
    allowNull: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  position: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  }
}, {
  // timestamps will add createdAt and updatedAt fields
  timestamps: true
});

module.exports = Task;
