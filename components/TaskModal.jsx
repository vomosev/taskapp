'use client';

import { useEffect, useId, useRef, useState } from 'react';

const TASK_STATUSES = [
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'done', label: 'Done' },
];

const MAX_TITLE_LENGTH = 255;
const MAX_DESCRIPTION_LENGTH = 2000;

function toLocalDateTimeValue(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const pad = (part) => String(part).padStart(2, '0');

  return [
    date.getFullYear(),
    '-',
    pad(date.getMonth() + 1),
    '-',
    pad(date.getDate()),
    'T',
    pad(date.getHours()),
    ':',
    pad(date.getMinutes()),
  ].join('');
}

function getErrorMessage(error) {
  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  if (error?.message) {
    return error.message;
  }

  if (error?.error?.message) {
    return error.error.message;
  }

  return 'Unable to save the task. Please try again.';
}

export default function TaskModal({ task = null, onSubmit, onClose }) {
  const isEditing = Boolean(task?.id);
  const titleId = useId();
  const descriptionId = useId();
  const statusId = useId();
  const dueDateId = useId();
  const dialogTitleId = useId();
  const errorId = useId();

  const modalRef = useRef(null);
  const titleInputRef = useRef(null);

  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [status, setStatus] = useState(task?.status || 'todo');
  const [dueDate, setDueDate] = useState(
    toLocalDateTimeValue(task?.dueDate ?? task?.due_date)
  );
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setTitle(task?.title || '');
    setDescription(task?.description || '');
    setStatus(
      TASK_STATUSES.some((option) => option.value === task?.status)
        ? task.status
        : 'todo'
    );
    setDueDate(toLocalDateTimeValue(task?.dueDate ?? task?.due_date));
    setError('');
    setIsSubmitting(false);
  }, [task]);

  useEffect(() => {
    const previouslyFocusedElement = document.activeElement;
    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = 'hidden';

    const focusTimer = window.setTimeout(() => {
      titleInputRef.current?.focus();
    }, 0);

    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;

      if (
        previouslyFocusedElement &&
        typeof previouslyFocusedElement.focus === 'function'
      ) {
        previouslyFocusedElement.focus();
      }
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !isSubmitting) {
        event.preventDefault();
        onClose?.();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSubmitting, onClose]);

  const handleDialogKeyDown = (event) => {
    if (event.key !== 'Tab' || !modalRef.current) {
      return;
    }

    const focusableElements = Array.from(
      modalRef.current.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
      )
    ).filter((element) => !element.hasAttribute('hidden'));

    if (focusableElements.length === 0) {
      event.preventDefault();
      modalRef.current.focus();
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey) {
      if (
        document.activeElement === firstElement ||
        !modalRef.current.contains(document.activeElement)
      ) {
        event.preventDefault();
        lastElement.focus();
      }
    } else if (document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose?.();
    }
  };

  const handleBackdropMouseDown = (event) => {
    if (event.target === event.currentTarget) {
      handleClose();
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const normalizedTitle = title.trim();
    const normalizedDescription = description.trim();

    if (!normalizedTitle) {
      setError('Title is required.');
      titleInputRef.current?.focus();
      return;
    }

    if (normalizedTitle.length > MAX_TITLE_LENGTH) {
      setError(`Title must be ${MAX_TITLE_LENGTH} characters or fewer.`);
      titleInputRef.current?.focus();
      return;
    }

    if (normalizedDescription.length > MAX_DESCRIPTION_LENGTH) {
      setError(
        `Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer.`
      );
      return;
    }

    if (!TASK_STATUSES.some((option) => option.value === status)) {
      setError('Please select a valid task status.');
      return;
    }

    let dueDateIso = null;

    if (dueDate) {
      const parsedDueDate = new Date(dueDate);

      if (Number.isNaN(parsedDueDate.getTime())) {
        setError('Please enter a valid due date and time.');
        return;
      }

      dueDateIso = parsedDueDate.toISOString();
    }

    if (typeof onSubmit !== 'function') {
      setError('Unable to save the task. Please try again.');
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      await onSubmit({
        title: normalizedTitle,
        description: normalizedDescription,
        status,
        dueDate: dueDateIso,
      });
    } catch (submissionError) {
      setError(getErrorMessage(submissionError));
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      onMouseDown={handleBackdropMouseDown}
      role="presentation"
    >
      <div
        ref={modalRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={dialogTitleId}
        aria-describedby={error ? errorId : undefined}
        onKeyDown={handleDialogKeyDown}
        tabIndex={-1}
      >
        <div className="modal-header">
          <h2 id={dialogTitleId}>
            {isEditing ? 'Edit Task' : 'Create Task'}
          </h2>
          <button
            type="button"
            className="modal-close"
            onClick={handleClose}
            disabled={isSubmitting}
            aria-label="Close task dialog"
          >
            <span aria-hidden="true">&times;</span>
          </button>
        </div>

        <form className="task-form" onSubmit={handleSubmit} noValidate>
          {error ? (
            <div id={errorId} className="form-error" role="alert">
              {error}
            </div>
          ) : null}

          <div className="form-group">
            <label htmlFor={titleId}>Title</label>
            <input
              ref={titleInputRef}
              id={titleId}
              name="title"
              type="text"
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                setError('');
              }}
              maxLength={MAX_TITLE_LENGTH}
              required
              disabled={isSubmitting}
              autoComplete="off"
              aria-invalid={Boolean(error && !title.trim())}
            />
          </div>

          <div className="form-group">
            <label htmlFor={descriptionId}>Description</label>
            <textarea
              id={descriptionId}
              name="description"
              value={description}
              onChange={(event) => {
                setDescription(event.target.value);
                setError('');
              }}
              maxLength={MAX_DESCRIPTION_LENGTH}
              rows={5}
              disabled={isSubmitting}
            />
            <span className="character-count" aria-live="polite">
              {description.length}/{MAX_DESCRIPTION_LENGTH}
            </span>
          </div>

          <div className="form-group">
            <label htmlFor={statusId}>Status</label>
            <select
              id={statusId}
              name="status"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setError('');
              }}
              disabled={isSubmitting}
            >
              {TASK_STATUSES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor={dueDateId}>Due date</label>
            <input
              id={dueDateId}
              name="dueDate"
              type="datetime-local"
              value={dueDate}
              onChange={(event) => {
                setDueDate(event.target.value);
                setError('');
              }}
              disabled={isSubmitting}
            />
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="button secondary-button"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="button primary-button"
              disabled={isSubmitting}
            >
              {isSubmitting
                ? 'Saving…'
                : isEditing
                  ? 'Save Changes'
                  : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}