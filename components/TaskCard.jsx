'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function getDueDateDetails(dueDate, status) {
  if (!dueDate) {
    return null;
  }

  const date = new Date(dueDate);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const now = new Date();
  const isComplete = status === 'done';
  const isOverdue = !isComplete && date.getTime() < now.getTime();
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  let state = 'upcoming';
  let label = 'Due';

  if (isComplete) {
    state = 'complete';
  } else if (isOverdue) {
    state = 'overdue';
    label = 'Overdue';
  } else if (isToday) {
    state = 'today';
    label = 'Due today';
  }

  const formattedDate = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);

  return {
    state,
    text: isToday && !isOverdue ? `${label} at ${new Intl.DateTimeFormat(undefined, {
      timeStyle: 'short',
    }).format(date)}` : `${label}: ${formattedDate}`,
  };
}

export default function TaskCard({ task, onEdit, onDelete }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const dueDate = getDueDateDetails(task.dueDate, task.status);
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const stopDragStart = (event) => {
    event.stopPropagation();
  };

  const handleEdit = (event) => {
    event.stopPropagation();
    onEdit(task);
  };

  const handleDelete = (event) => {
    event.stopPropagation();
    onDelete(task);
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`task-card${isDragging ? ' task-card--dragging dragging' : ''}`}
      {...attributes}
      {...listeners}
    >
      <div className="task-card-header">
        <h3 className="task-card-title">{task.title}</h3>
        <div className="task-card-actions" aria-label={`Actions for ${task.title}`}>
          <button
            type="button"
            className="task-card-action edit-button"
            aria-label={`Edit ${task.title}`}
            onPointerDown={stopDragStart}
            onKeyDown={stopDragStart}
            onClick={handleEdit}
          >
            Edit
          </button>
          <button
            type="button"
            className="task-card-action delete-button"
            aria-label={`Delete ${task.title}`}
            onPointerDown={stopDragStart}
            onKeyDown={stopDragStart}
            onClick={handleDelete}
          >
            Delete
          </button>
        </div>
      </div>

      {task.description ? (
        <p className="task-card-description">{task.description}</p>
      ) : null}

      {dueDate ? (
        <time
          className={`task-card-due task-card-due--${dueDate.state}`}
          dateTime={task.dueDate}
        >
          {dueDate.text}
        </time>
      ) : null}
    </article>
  );
}