'use client';

import { useEffect, useRef, useState } from 'react';
import {
  closestCorners,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import TaskColumn from './TaskColumn';

const COLUMNS = [
  { status: 'todo', title: 'To Do' },
  { status: 'in_progress', title: 'In Progress' },
  { status: 'done', title: 'Done' },
];

const STATUS_VALUES = COLUMNS.map((column) => column.status);

function idsEqual(first, second) {
  return String(first) === String(second);
}

function normalizeColumns(columns) {
  const normalized = {};

  COLUMNS.forEach(({ status }) => {
    normalized[status] = (columns[status] || []).map((task, position) => ({
      ...task,
      status,
      position,
    }));
  });

  return normalized;
}

function createColumns(tasks) {
  const columns = Object.fromEntries(
    COLUMNS.map(({ status }) => [status, []]),
  );

  (Array.isArray(tasks) ? tasks : []).forEach((task) => {
    const status = STATUS_VALUES.includes(task.status) ? task.status : 'todo';
    columns[status].push(task);
  });

  COLUMNS.forEach(({ status }) => {
    columns[status].sort((first, second) => {
      const firstPosition = Number.isFinite(Number(first.position))
        ? Number(first.position)
        : Number.MAX_SAFE_INTEGER;
      const secondPosition = Number.isFinite(Number(second.position))
        ? Number(second.position)
        : Number.MAX_SAFE_INTEGER;

      return firstPosition - secondPosition;
    });
  });

  return normalizeColumns(columns);
}

function flattenColumns(columns) {
  return COLUMNS.flatMap(({ status }) => columns[status] || []);
}

function getContainer(columns, id) {
  const column = STATUS_VALUES.find((status) => idsEqual(status, id));

  if (column) {
    return column;
  }

  return STATUS_VALUES.find((status) =>
    (columns[status] || []).some((task) => idsEqual(task.id, id)),
  );
}

function getTaskIndex(tasks, id) {
  return tasks.findIndex((task) => idsEqual(task.id, id));
}

function getLayoutSignature(columns) {
  return COLUMNS.flatMap(({ status }) =>
    (columns[status] || []).map(
      (task, position) => `${String(task.id)}:${status}:${position}`,
    ),
  ).join('|');
}

export default function KanbanBoard({
  tasks = [],
  onReorder,
  onEdit,
  onDelete,
}) {
  const [columns, setColumns] = useState(() => createColumns(tasks));
  const [activeId, setActiveId] = useState(null);
  const columnsRef = useRef(columns);
  const dragSnapshotRef = useRef(null);
  const mutationIdRef = useRef(0);
  const draggingRef = useRef(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const updateColumns = (nextValue) => {
    setColumns((currentColumns) => {
      const nextColumns =
        typeof nextValue === 'function'
          ? nextValue(currentColumns)
          : nextValue;

      columnsRef.current = nextColumns;
      return nextColumns;
    });
  };

  useEffect(() => {
    if (draggingRef.current) {
      return;
    }

    const nextColumns = createColumns(tasks);
    columnsRef.current = nextColumns;
    setColumns(nextColumns);
  }, [tasks]);

  const handleDragStart = ({ active }) => {
    draggingRef.current = true;
    dragSnapshotRef.current = columnsRef.current;
    setActiveId(active.id);
  };

  const handleDragOver = ({ active, over }) => {
    if (!over) {
      return;
    }

    const currentColumns = columnsRef.current;
    const sourceStatus = getContainer(currentColumns, active.id);
    const targetStatus = getContainer(currentColumns, over.id);

    if (
      !sourceStatus ||
      !targetStatus ||
      sourceStatus === targetStatus
    ) {
      return;
    }

    const sourceTasks = currentColumns[sourceStatus] || [];
    const targetTasks = currentColumns[targetStatus] || [];
    const sourceIndex = getTaskIndex(sourceTasks, active.id);

    if (sourceIndex < 0) {
      return;
    }

    const movingTask = sourceTasks[sourceIndex];
    const nextSourceTasks = sourceTasks.filter(
      (task) => !idsEqual(task.id, active.id),
    );
    const nextTargetTasks = [...targetTasks];

    let insertionIndex = nextTargetTasks.length;
    const overTaskIndex = getTaskIndex(nextTargetTasks, over.id);

    if (overTaskIndex >= 0) {
      const translatedRect = active.rect.current.translated;
      const activeCenter = translatedRect
        ? translatedRect.top + translatedRect.height / 2
        : null;
      const overCenter = over.rect.top + over.rect.height / 2;
      const insertAfter =
        activeCenter !== null && activeCenter > overCenter;

      insertionIndex = overTaskIndex + (insertAfter ? 1 : 0);
    }

    nextTargetTasks.splice(insertionIndex, 0, {
      ...movingTask,
      status: targetStatus,
    });

    updateColumns(
      normalizeColumns({
        ...currentColumns,
        [sourceStatus]: nextSourceTasks,
        [targetStatus]: nextTargetTasks,
      }),
    );
  };

  const handleDragEnd = ({ active, over }) => {
    const snapshot = dragSnapshotRef.current;
    draggingRef.current = false;
    dragSnapshotRef.current = null;
    setActiveId(null);

    if (!over) {
      if (snapshot) {
        updateColumns(snapshot);
      }
      return;
    }

    const currentColumns = columnsRef.current;
    const sourceStatus = getContainer(currentColumns, active.id);
    const targetStatus = getContainer(currentColumns, over.id);

    if (!sourceStatus || !targetStatus) {
      if (snapshot) {
        updateColumns(snapshot);
      }
      return;
    }

    let nextColumns = currentColumns;

    if (!idsEqual(active.id, over.id)) {
      const sourceTasks = [...(currentColumns[sourceStatus] || [])];
      const sourceIndex = getTaskIndex(sourceTasks, active.id);

      if (sourceIndex >= 0) {
        const [movingTask] = sourceTasks.splice(sourceIndex, 1);
        const targetTasks =
          sourceStatus === targetStatus
            ? sourceTasks
            : [...(currentColumns[targetStatus] || [])];

        let insertionIndex = targetTasks.length;
        const overTaskIndex = getTaskIndex(targetTasks, over.id);

        if (overTaskIndex >= 0) {
          const translatedRect = active.rect.current.translated;
          let insertAfter;

          if (translatedRect) {
            const activeCenter =
              translatedRect.top + translatedRect.height / 2;
            const overCenter = over.rect.top + over.rect.height / 2;
            insertAfter = activeCenter > overCenter;
          } else if (sourceStatus === targetStatus) {
            const originalOverIndex = getTaskIndex(
              currentColumns[targetStatus] || [],
              over.id,
            );
            insertAfter = sourceIndex < originalOverIndex;
          } else {
            insertAfter = false;
          }

          insertionIndex = overTaskIndex + (insertAfter ? 1 : 0);
        }

        targetTasks.splice(insertionIndex, 0, {
          ...movingTask,
          status: targetStatus,
        });

        nextColumns = normalizeColumns({
          ...currentColumns,
          [sourceStatus]:
            sourceStatus === targetStatus ? targetTasks : sourceTasks,
          [targetStatus]: targetTasks,
        });
      }
    } else {
      nextColumns = normalizeColumns(currentColumns);
    }

    updateColumns(nextColumns);

    const previousSignature = getLayoutSignature(
      snapshot || createColumns(tasks),
    );
    const nextSignature = getLayoutSignature(nextColumns);

    if (previousSignature === nextSignature || typeof onReorder !== 'function') {
      return;
    }

    const mutationId = mutationIdRef.current + 1;
    mutationIdRef.current = mutationId;
    const reorderedTasks = flattenColumns(nextColumns);

    Promise.resolve()
      .then(() => onReorder(reorderedTasks))
      .catch(() => {
        if (
          mutationIdRef.current === mutationId &&
          !draggingRef.current &&
          snapshot
        ) {
          updateColumns(snapshot);
        }
      });
  };

  const handleDragCancel = () => {
    draggingRef.current = false;
    setActiveId(null);

    if (dragSnapshotRef.current) {
      updateColumns(dragSnapshotRef.current);
    }

    dragSnapshotRef.current = null;
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div
        className="kanban-board"
        aria-label="Task board"
        data-dragging={activeId !== null ? 'true' : 'false'}
      >
        {COLUMNS.map(({ status, title }) => (
          <TaskColumn
            key={status}
            status={status}
            title={title}
            tasks={columns[status] || []}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>
    </DndContext>
  );
}