// =============================================================================
// LoginPage.tsx
// Handles both "Login" and "Register" modes via a tab toggle.
// All form state is local — auth store actions are called on submit.
// Redirects to /chat on success.
// =============================================================================

import React, { useState, useEffect }  from 'react';
import { useNavigate, Link }           from 'react-router-dom';
import { useAuthStore, useAuthIsLoading, useAuthError } from '../../store/auth.store';
import { ROUTES }                      from '../../constants/routes';
import styles from './LoginPage.module.scss';

// ── Types ─────────────────────────────────────────────────────────────────────

type Mode = 'login' | 'register';

interface FormState {
  email:       string;
  password:    string;
  displayName: string; // only used in register mode
}

const INITIAL_FORM: FormState = { email: '', password: '', displayName: '' };

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Authentication page — handles both login and registration.
 * Redirects authenticated users to /chat automatically.
 */
const LoginPage: React.FC = () => {
  const navigate             = useNavigate();
  const { login, register }  = useAuthStore();
  // const isLoading            = useAuthIsLoading();
  // const error                = useAuthError();
  const isLoading = useAuthIsLoading();
  const error     = useAuthError();

  const [mode, setMode]       = useState<Mode>('login');
  const [form, setForm]       = useState<FormState>(INITIAL_FORM);
  const [fieldErrors, setFieldErrors] = useState<Partial<FormState>>({});

  // If already authenticated, skip the page
  const user = useAuthStore((s) => s.user);
  useEffect(() => {
    if (user) navigate(ROUTES.CHAT, { replace: true });
  }, [user, navigate]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  /** Updates a single form field */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    // Clear field-level error on change
    setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  /** Switches between login and register — resets form */
  const handleModeSwitch = (newMode: Mode) => {
    setMode(newMode);
    setForm(INITIAL_FORM);
    setFieldErrors({});
    useAuthStore.getState().clearError();
  };

  /** Client-side validation before hitting the API */
  const validate = (): boolean => {
    const errors: Partial<FormState> = {};

    if (!form.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      errors.email = 'Please enter a valid email address';
    }
    if (form.password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    }
    if (mode === 'register' && form.displayName.trim().length < 2) {
      errors.displayName = 'Display name must be at least 2 characters';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  /** Submits the form */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      if (mode === 'login') {
        await login({ email: form.email, password: form.password });
      } else {
        await register({ email: form.email, password: form.password, displayName: form.displayName });
      }
      navigate(ROUTES.CHAT, { replace: true });
    } catch {
      // Error is already in the store — no handling needed here
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        {/* Logo / Brand */}
        <div className={styles.brand}>
          <div className={styles.brandLogo} aria-hidden="true" />
          <h1 className={styles.brandName}>ChatApp</h1>
        </div>

        {/* Mode tabs */}
        <div className={styles.tabs} role="tablist">
          <button
            role="tab"
            aria-selected={mode === 'login'}
            className={`${styles.tab} ${mode === 'login' ? styles.tabActive : ''}`}
            onClick={() => handleModeSwitch('login')}
          >
            Sign in
          </button>
          <button
            role="tab"
            aria-selected={mode === 'register'}
            className={`${styles.tab} ${mode === 'register' ? styles.tabActive : ''}`}
            onClick={() => handleModeSwitch('register')}
          >
            Create account
          </button>
        </div>

        {/* Form */}
        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          {/* Display name — register only */}
          {mode === 'register' && (
            <div className={styles.field}>
              <label htmlFor="displayName" className={styles.label}>
                Display name
              </label>
              <input
                id="displayName"
                name="displayName"
                type="text"
                autoComplete="name"
                value={form.displayName}
                onChange={handleChange}
                className={`${styles.input} ${fieldErrors.displayName ? styles.inputError : ''}`}
                placeholder="How should others see you?"
                disabled={isLoading}
              />
              {fieldErrors.displayName && (
                <span className={styles.fieldError} role="alert">
                  {fieldErrors.displayName}
                </span>
              )}
            </div>
          )}

          {/* Email */}
          <div className={styles.field}>
            <label htmlFor="email" className={styles.label}>
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={handleChange}
              className={`${styles.input} ${fieldErrors.email ? styles.inputError : ''}`}
              placeholder="you@example.com"
              disabled={isLoading}
            />
            {fieldErrors.email && (
              <span className={styles.fieldError} role="alert">
                {fieldErrors.email}
              </span>
            )}
          </div>

          {/* Password */}
          <div className={styles.field}>
            <label htmlFor="password" className={styles.label}>
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={form.password}
              onChange={handleChange}
              className={`${styles.input} ${fieldErrors.password ? styles.inputError : ''}`}
              placeholder={mode === 'login' ? '••••••••' : 'Min. 8 characters'}
              disabled={isLoading}
            />
            {fieldErrors.password && (
              <span className={styles.fieldError} role="alert">
                {fieldErrors.password}
              </span>
            )}
          </div>

          {/* API error banner */}
          {error && (
            <div className={styles.errorBanner} role="alert">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            className={styles.submitButton}
            disabled={isLoading}
          >
            {isLoading
              ? 'Please wait...'
              : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>

          {/* Demo mode link */}
          <div className={styles.demoLink}>
            Want to explore without an account?{' '}
            <Link to={ROUTES.DEMO} className={styles.link}>
              Try demo mode
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
