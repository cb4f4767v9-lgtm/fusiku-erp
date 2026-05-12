import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import { I18nextProvider } from 'react-i18next';

import i18n from './i18n';

import { ErrorBoundary } from './components/ErrorBoundary';
import { Toaster } from 'react-hot-toast';

import App from './app/bootstrap';

/* Fonts */
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import '@fontsource/noto-sans-arabic/arabic-400.css';
import '@fontsource/noto-sans-arabic/arabic-500.css';
import '@fontsource/noto-sans-arabic/arabic-600.css';
import '@fontsource/noto-sans-arabic/arabic-700.css';

/* Styles */
import './styles/tailwind.css';
import './styles/tokens.css';
import './styles/global.css';
import './styles/layout.css';
import './styles/login.css';
import './styles/components.css';
import './styles/brand.css';
import './styles/design-system.css';
import './styles/datatable.css';
import './styles/final.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <I18nextProvider i18n={i18n}>
      <BrowserRouter>
        <ErrorBoundary>
          <App />

          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3200,
              className: 'fusiku-toast',
              style: {
                borderRadius: '12px',
                padding: '10px 12px',
                fontSize: '13px',
              },
            }}
          />
        </ErrorBoundary>
      </BrowserRouter>
    </I18nextProvider>
  </React.StrictMode>
);