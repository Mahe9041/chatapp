import { jsx as _jsx } from "react/jsx-runtime";
// =============================================================================
// main.tsx
// Entry point — imports global styles, mounts React.
// =============================================================================
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/global.scss'; // ← global styles imported ONCE here only
console.log('🚀 main.tsx executing');
ReactDOM.createRoot(document.getElementById('root')).render(_jsx(React.StrictMode, { children: _jsx(App, {}) }));
