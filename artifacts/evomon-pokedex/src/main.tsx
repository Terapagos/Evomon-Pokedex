import { createRoot } from 'react-dom/client';
import { Router } from 'wouter';
import { setBaseUrl } from '@workspace/api-client-react';

import App from './App';
import { ErrorBoundary } from '@/components/error-boundary';

import './index.css';

// Keep same-origin API requests for Replit; Pages uses the public backend origin.
setBaseUrl(import.meta.env.VITE_API_URL || null);

createRoot(document.getElementById('root')!, {
  // Keeps caught errors off reportError(), which would raise the dev overlay.
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  <ErrorBoundary>
    <Router base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <App />
    </Router>
  </ErrorBoundary>,
);
