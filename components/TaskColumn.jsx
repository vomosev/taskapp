'use client';

import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import TaskCard from './TaskCard';

export default function TaskColumn({
  id,
  status,
  title,
  tasks = [],
  onEdit,
  onDelete,
}) {
  const columnId = status ?? id;
  const { isOver, setNodeRef } = useDroppable({
    id: columnId,
    data: {
      type: 'column',
      status: columnId,
    },
  });

  const taskIds = tasks.map((task) => task.id);

  return (
    <section
      ref={setNodeRef}
      className={`kanban-column${isOver ? ' drag-over' : ''}`}
      aria-labelledby={`${columnId}-column-title`}
    >
      <div className="column-header">
        <h2 id={`${columnId}-column-title`} className="column-title">
          {title}
        </h2>
        <span
          className="task-count"
          aria-label={`${tasks.length} ${tasks.length === 1 ? 'task' : 'tasks'}`}
        >
          {tasks.length}
        </span>
      </div>

      <SortableContext
        items={taskIds}
        strategy={verticalListSortingStrategy}
      >
        <div className="task-list">
          {tasks.length === 0 ? (
            <p className="empty-column">Drop tasks here</p>
          ) : (
            tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))
          )}
        </div>
      </SortableContext>
    </section>
  );
}