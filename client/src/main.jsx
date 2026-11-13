import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './i18n/index.js';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { FavoritesProvider } from './context/FavoritesContext.jsx';
import { PlayerProvider } from './context/PlayerContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import './styles/global.css';

//провайдери над маршрутами: навігація їх не перемонтовує, тож музика й сповіщення не перериваються
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <FavoritesProvider>
            <PlayerProvider>
              <App />
            </PlayerProvider>
          </FavoritesProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
