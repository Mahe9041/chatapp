import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// =============================================================================
// LoginPage.tsx
// Handles both "Login" and "Register" modes via a tab toggle.
// All form state is local — auth store actions are called on submit.
// Redirects to /chat on success.
// =============================================================================
import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore, useAuthIsLoading, useAuthError } from '../../store/auth.store';
import { ROUTES } from '../../constants/routes';
import styles from './LoginPage.module.scss';
const INITIAL_FORM = { email: '', password: '', displayName: '' };
// ── Component ─────────────────────────────────────────────────────────────────
/**
 * Authentication page — handles both login and registration.
 * Redirects authenticated users to /chat automatically.
 */
const LoginPage = () => {
    const navigate = useNavigate();
    const { login, register } = useAuthStore();
    const isLoading = useAuthIsLoading();
    const error = useAuthError();
    const [mode, setMode] = useState('login');
    const [form, setForm] = useState(INITIAL_FORM);
    const [fieldErrors, setFieldErrors] = useState({});
    // If already authenticated, skip the page
    const user = useAuthStore((s) => s.user);
    useEffect(() => {
        if (user)
            navigate(ROUTES.CHAT, { replace: true });
    }, [user, navigate]);
    // ── Handlers ───────────────────────────────────────────────────────────────
    /** Updates a single form field */
    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
        // Clear field-level error on change
        setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
    };
    /** Switches between login and register — resets form */
    const handleModeSwitch = (newMode) => {
        setMode(newMode);
        setForm(INITIAL_FORM);
        setFieldErrors({});
        useAuthStore.getState().clearError();
    };
    /** Client-side validation before hitting the API */
    const validate = () => {
        const errors = {};
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
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validate())
            return;
        try {
            if (mode === 'login') {
                await login({ email: form.email, password: form.password });
            }
            else {
                await register({ email: form.email, password: form.password, displayName: form.displayName });
            }
            navigate(ROUTES.CHAT, { replace: true });
        }
        catch {
            // Error is already in the store — no handling needed here
        }
    };
    // ── Render ─────────────────────────────────────────────────────────────────
    return (_jsx("div", { className: styles.page, children: _jsxs("div", { className: styles.card, children: [_jsxs("div", { className: styles.brand, children: [_jsx("div", { className: styles.brandLogo, "aria-hidden": "true" }), _jsx("h1", { className: styles.brandName, children: "ChatApp" })] }), _jsxs("div", { className: styles.tabs, role: "tablist", children: [_jsx("button", { role: "tab", "aria-selected": mode === 'login', className: `${styles.tab} ${mode === 'login' ? styles.tabActive : ''}`, onClick: () => handleModeSwitch('login'), children: "Sign in" }), _jsx("button", { role: "tab", "aria-selected": mode === 'register', className: `${styles.tab} ${mode === 'register' ? styles.tabActive : ''}`, onClick: () => handleModeSwitch('register'), children: "Create account" })] }), _jsxs("form", { className: styles.form, onSubmit: handleSubmit, noValidate: true, children: [mode === 'register' && (_jsxs("div", { className: styles.field, children: [_jsx("label", { htmlFor: "displayName", className: styles.label, children: "Display name" }), _jsx("input", { id: "displayName", name: "displayName", type: "text", autoComplete: "name", value: form.displayName, onChange: handleChange, className: `${styles.input} ${fieldErrors.displayName ? styles.inputError : ''}`, placeholder: "How should others see you?", disabled: isLoading }), fieldErrors.displayName && (_jsx("span", { className: styles.fieldError, role: "alert", children: fieldErrors.displayName }))] })), _jsxs("div", { className: styles.field, children: [_jsx("label", { htmlFor: "email", className: styles.label, children: "Email address" }), _jsx("input", { id: "email", name: "email", type: "email", autoComplete: "email", value: form.email, onChange: handleChange, className: `${styles.input} ${fieldErrors.email ? styles.inputError : ''}`, placeholder: "you@example.com", disabled: isLoading }), fieldErrors.email && (_jsx("span", { className: styles.fieldError, role: "alert", children: fieldErrors.email }))] }), _jsxs("div", { className: styles.field, children: [_jsx("label", { htmlFor: "password", className: styles.label, children: "Password" }), _jsx("input", { id: "password", name: "password", type: "password", autoComplete: mode === 'login' ? 'current-password' : 'new-password', value: form.password, onChange: handleChange, className: `${styles.input} ${fieldErrors.password ? styles.inputError : ''}`, placeholder: mode === 'login' ? '••••••••' : 'Min. 8 characters', disabled: isLoading }), fieldErrors.password && (_jsx("span", { className: styles.fieldError, role: "alert", children: fieldErrors.password }))] }), error && (_jsx("div", { className: styles.errorBanner, role: "alert", children: error })), _jsx("button", { type: "submit", className: styles.submitButton, disabled: isLoading, children: isLoading
                                ? 'Please wait...'
                                : mode === 'login' ? 'Sign in' : 'Create account' }), _jsxs("div", { className: styles.demoLink, children: ["Want to explore without an account?", ' ', _jsx(Link, { to: ROUTES.DEMO, className: styles.link, children: "Try demo mode \u2192" })] }), _jsx("div", { className: styles.demoHint, children: "Demo mode shows a live split-screen with real-time system diagrams" })] })] }) }));
};
export default LoginPage;
