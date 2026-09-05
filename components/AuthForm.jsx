'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { login, signup } from '../lib/api';
import { setToken } from '../lib/auth';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getErrorMessage(error) {
  if (error?.details) {
    if (Array.isArray(error.details)) {
      const messages = error.details
        .map((detail) =>
          typeof detail === 'string' ? detail : detail?.message
        )
        .filter(Boolean);

      if (messages.length > 0) {
        return messages.join(' ');
      }
    }

    if (typeof error.details === 'string') {
      return error.details;
    }
  }

  return error?.message || 'Unable to complete your request. Please try again.';
}

export default function AuthForm({ mode }) {
  const router = useRouter();
  const isSignup = mode === 'signup';

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));

    setFieldErrors((current) => {
      if (!current[name]) {
        return current;
      }

      const next = { ...current };
      delete next[name];
      return next;
    });

    setServerError('');
  }

  function validate() {
    const errors = {};
    const name = form.name.trim();
    const email = form.email.trim();

    if (isSignup) {
      if (!name) {
        errors.name = 'Name is required.';
      } else if (name.length > 100) {
        errors.name = 'Name must be 100 characters or fewer.';
      }
    }

    if (!email) {
      errors.email = 'Email is required.';
    } else if (!EMAIL_PATTERN.test(email)) {
      errors.email = 'Enter a valid email address.';
    } else if (email.length > 255) {
      errors.email = 'Email must be 255 characters or fewer.';
    }

    if (!form.password) {
      errors.password = 'Password is required.';
    } else if (isSignup && form.password.length < 8) {
      errors.password = 'Password must be at least 8 characters.';
    } else if (form.password.length > 72) {
      errors.password = 'Password must be 72 characters or fewer.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setServerError('');

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const credentials = {
        email: form.email.trim().toLowerCase(),
        password: form.password,
      };

      const response = isSignup
        ? await signup({
            ...credentials,
            name: form.name.trim(),
          })
        : await login(credentials);

      if (!response?.token) {
        throw new Error('Authentication succeeded without returning a token.');
      }

      setToken(response.token);
      router.replace('/dashboard');
      router.refresh();
    } catch (error) {
      setServerError(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-card-header">
          <h1 id="auth-title">{isSignup ? 'Create your account' : 'Welcome back'}</h1>
          <p>
            {isSignup
              ? 'Sign up to organize your tasks and due dates.'
              : 'Sign in to continue to your task dashboard.'}
          </p>
        </div>

        {serverError && (
          <div className="error-message" role="alert">
            {serverError}
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          {isSignup && (
            <div className="form-group">
              <label htmlFor="name">Name</label>
              <input
                id="name"
                name="name"
                type="text"
                value={form.name}
                onChange={handleChange}
                autoComplete="name"
                maxLength={100}
                disabled={isSubmitting}
                aria-invalid={Boolean(fieldErrors.name)}
                aria-describedby={fieldErrors.name ? 'name-error' : undefined}
                autoFocus
              />
              {fieldErrors.name && (
                <p id="name-error" className="field-error" role="alert">
                  {fieldErrors.name}
                </p>
              )}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              autoComplete="email"
              maxLength={255}
              disabled={isSubmitting}
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? 'email-error' : undefined}
              autoFocus={!isSignup}
            />
            {fieldErrors.email && (
              <p id="email-error" className="field-error" role="alert">
                {fieldErrors.email}
              </p>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              maxLength={72}
              disabled={isSubmitting}
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={
                fieldErrors.password ? 'password-error' : undefined
              }
            />
            {fieldErrors.password && (
              <p id="password-error" className="field-error" role="alert">
                {fieldErrors.password}
              </p>
            )}
          </div>

          <button
            className="primary-button auth-submit"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting
              ? isSignup
                ? 'Creating account…'
                : 'Signing in…'
              : isSignup
                ? 'Create account'
                : 'Sign in'}
          </button>
        </form>

        <p className="auth-link">
          {isSignup ? 'Already have an account?' : 'Need an account?'}{' '}
          <Link href={isSignup ? '/login' : '/signup'}>
            {isSignup ? 'Sign in' : 'Sign up'}
          </Link>
        </p>
      </section>
    </main>
  );
}