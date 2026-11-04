/**
 * @file Точка входу клієнта: ініціалізує локалізацію і монтує React-застосунок у DOM.
 * Провайдери стану (автентифікація, плеєр) розташовані над маршрутами, тож не
 * перемонтовуються під час навігації.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './i18n/index.js';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
