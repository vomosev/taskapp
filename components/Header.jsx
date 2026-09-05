'use client';

export default function Header({ user, onCreate, onLogout }) {
  const userName = user?.name?.trim() || 'User';

  return (
    <header className="dashboard-header">
      <div className="header-content">
        <div className="header-brand">
          <h1>Taskapp</h1>
          <p className="header-welcome">
            Welcome, <strong>{userName}</strong>
          </p>
        </div>

        <div className="header-actions">
          <button
            type="button"
            className="button button-primary"
            onClick={onCreate}
          >
            Add Task
          </button>
          <button
            type="button"
            className="button button-secondary"
            onClick={onLogout}
          >
            Log out
          </button>
        </div>
      </div>
    </header>
  );
}