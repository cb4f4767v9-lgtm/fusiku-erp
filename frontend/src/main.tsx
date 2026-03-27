import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './hooks/useAuth';
import './i18n';
import App from './App';
import './styles/global.css';
import './styles/layout.css';
import './styles/login.css';
import './styles/components.css';
import './styles/brand.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <AuthProvider>
        <App />
        <Toaster position="top-right" />
      </AuthProvider>
    </HashRouter>
  </React.StrictMode>
);
