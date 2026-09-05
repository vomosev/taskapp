'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from './Header';
import KanbanBoard from './KanbanBoard';
import TaskModal from './TaskModal';
import {
  createTask,
  deleteTask,
  getCurrentUser,
  listTasks,
  reorderTasks,
  updateTask,
} from '../lib/api';
import { clearToken, getToken } from '../lib/auth';

function getErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  return error?.message || error?.error?.message || fallback;
}

function isUnauthorizedError(error) {
  const status = error?.status || error?.statusCode || error?.response?.status;
  const message = getErrorMessage(error, '').toLowerCase();

  return status === 401 || message.includes('unauthorized') || message.includes('invalid token');
}

function extractUser(response) {
  return response?.user || response?.data?.user || response;
}

function extractTasks(response) {
  if (Array.isArray(response)) {
    return response;
  }

  if (Array.isArray(response?.tasks)) {
    return response.tasks;
  }

  if (Array.isArray(response?.data?.tasks)) {
    return response.data.tasks;
  }

  return [];
}

function extractTask(response) {
  return response?.task || response?.data?.task || response;
}

function taskId(value) {
  return typeof value === 'object' && value !== null ? value.id : value;
}

export default function Dashboard() {
  const router = useRouter();
  const mountedRef = useRef(false);
  const reorderVersionRef = useRef(0);

  const [user, setUser] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalState, setModalState] = useState({
    open: false,
    task: null,
  });

  const redirectToLogin = useCallback(() => {
    clearToken();
    router.replace('/login');
  }, [router]);

  const handleApiError = useCallback(
    (apiError, fallbackMessage) => {
      if (isUnauthorizedError(apiError)) {
        redirectToLogin();
        return true;
      }

      if (mountedRef.current) {
        setError(getErrorMessage(apiError, fallbackMessage));
      }

      return false;
    },
    [redirectToLogin],
  );

  const loadDashboard = useCallback(async () => {
    if (!getToken()) {
      redirectToLogin();
      return;
    }

    if (mountedRef.current) {
      setLoading(true);
      setError('');
    }

    try {
      const [userResponse, tasksResponse] = await Promise.all([
        getCurrentUser(),
        listTasks(),
      ]);

      if (!mountedRef.current) {
        return;
      }

      const loadedUser = extractUser(userResponse);

      if (!loadedUser?.id) {
        throw new Error('Unable to load the authenticated user.');
      }

      setUser(loadedUser);
      setTasks(extractTasks(tasksResponse));
    } catch (loadError) {
      handleApiError(loadError, 'Unable to load your dashboard.');
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [handleApiError, redirectToLogin]);

  useEffect(() => {
    mountedRef.current = true;
    loadDashboard();

    return () => {
      mountedRef.current = false;
    };
  }, [loadDashboard]);

  const handleLogout = useCallback(() => {
    clearToken();
    setUser(null);
    setTasks([]);
    router.replace('/login');
  }, [router]);

  const openCreateModal = useCallback(() => {
    setError('');
    setModalState({
      open: true,
      task: null,
    });
  }, []);

  const openEditModal = useCallback(
    (taskOrId) => {
      const selectedId = taskId(taskOrId);
      const selectedTask =
        typeof taskOrId === 'object' && taskOrId !== null
          ? taskOrId
          : tasks.find((task) => String(task.id) === String(selectedId));

      if (!selectedTask) {
        setError('The selected task could not be found.');
        return;
      }

      setError('');
      setModalState({
        open: true,
        task: selectedTask,
      });
    },
    [tasks],
  );

  const closeModal = useCallback(() => {
    setModalState({
      open: false,
      task: null,
    });
  }, []);

  const handleTaskSubmit = useCallback(
    async (taskData) => {
      setError('');

      try {
        if (modalState.task) {
          const response = await updateTask(modalState.task.id, taskData);
          const savedTask = extractTask(response);

          if (!savedTask?.id) {
            throw new Error('The server did not return the updated task.');
          }

          setTasks((currentTasks) =>
            currentTasks.map((task) =>
              String(task.id) === String(savedTask.id) ? savedTask : task,
            ),
          );
        } else {
          const response = await createTask(taskData);
          const savedTask = extractTask(response);

          if (!savedTask?.id) {
            throw new Error('The server did not return the created task.');
          }

          setTasks((currentTasks) => [...currentTasks, savedTask]);
        }

        closeModal();
      } catch (submitError) {
        handleApiError(
          submitError,
          modalState.task ? 'Unable to update the task.' : 'Unable to create the task.',
        );
        throw submitError;
      }
    },
    [closeModal, handleApiError, modalState.task],
  );

  const handleDelete = useCallback(
    async (taskOrId) => {
      const id = taskId(taskOrId);
      const selectedTask =
        typeof taskOrId === 'object' && taskOrId !== null
          ? taskOrId
          : tasks.find((task) => String(task.id) === String(id));

      if (id === undefined || id === null) {
        setError('The selected task could not be found.');
        return;
      }

      const confirmed = window.confirm(
        selectedTask?.title
          ? `Delete “${selectedTask.title}”? This action cannot be undone.`
          : 'Delete this task? This action cannot be undone.',
      );

      if (!confirmed) {
        return;
      }

      setError('');

      try {
        await deleteTask(id);
        setTasks((currentTasks) =>
          currentTasks.filter((task) => String(task.id) !== String(id)),
        );

        if (
          modalState.task &&
          String(modalState.task.id) === String(id)
        ) {
          closeModal();
        }
      } catch (deleteError) {
        handleApiError(deleteError, 'Unable to delete the task.');
      }
    },
    [closeModal, handleApiError, modalState.task, tasks],
  );

  const handleReorder = useCallback(
    async (nextTasksOrUpdates, possibleUpdates) => {
      const firstList = Array.isArray(nextTasksOrUpdates) ? nextTasksOrUpdates : [];
      const secondList = Array.isArray(possibleUpdates) ? possibleUpdates : null;
      const optimisticSource =
        secondList && firstList.some((task) => task && ('title' in task || 'description' in task))
          ? firstList
          : null;
      const updateSource = secondList || firstList;

      if (updateSource.length === 0) {
        return;
      }

      const previousTasks = tasks;
      const optimisticTasks =
        optimisticSource ||
        tasks.map((task) => {
          const update = updateSource.find(
            (item) => String(item.id) === String(task.id),
          );

          return update ? { ...task, ...update } : task;
        });

      const payload = updateSource.map((task) => ({
        id: task.id,
        status: task.status,
        position: task.position,
      }));

      const version = reorderVersionRef.current + 1;
      reorderVersionRef.current = version;
      setError('');
      setTasks(optimisticTasks);

      try {
        const response = await reorderTasks(payload);
        const savedTasks = extractTasks(response);

        if (
          mountedRef.current &&
          reorderVersionRef.current === version &&
          savedTasks.length > 0
        ) {
          setTasks(savedTasks);
        }
      } catch (reorderError) {
        if (mountedRef.current && reorderVersionRef.current === version) {
          setTasks(previousTasks);
        }

        handleApiError(reorderError, 'Unable to save the new task order.');
      }
    },
    [handleApiError, tasks],
  );

  if (loading) {
    return (
      <main className="loading-screen" aria-busy="true" aria-live="polite">
        <div className="loading-spinner" aria-hidden="true" />
        <p>Loading your tasks…</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="loading-screen" aria-live="polite">
        {error ? (
          <>
            <p className="error-message" role="alert">
              {error}
            </p>
            <button type="button" className="primary-button" onClick={loadDashboard}>
              Try again
            </button>
          </>
        ) : (
          <p>Redirecting to login…</p>
        )}
      </main>
    );
  }

  return (
    <div className="dashboard-page">
      <Header
        user={user}
        userName={user.name}
        onCreate={openCreateModal}
        onLogout={handleLogout}
      />

      <main className="dashboard-main">
        {error && (
          <div className="error-banner" role="alert">
            <span>{error}</span>
            <button
              type="button"
              aria-label="Dismiss error"
              onClick={() => setError('')}
            >
              ×
            </button>
          </div>
        )}

        <KanbanBoard
          tasks={tasks}
          onReorder={handleReorder}
          onEdit={openEditModal}
          onDelete={handleDelete}
        />
      </main>

      {modalState.open && (
        <TaskModal
          task={modalState.task}
          onSubmit={handleTaskSubmit}
          onClose={closeModal}
        />
      )}
    </div>
  );
}