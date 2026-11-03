/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import DeferredAnalytics from './components/DeferredAnalytics.jsx';
import {registerOfflineApp} from './lib/offlineApp.js';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { LogSyncProvider } from './context/LogSyncContext.jsx';
import './styles/design-system.css';
import './styles/global.css';
import './styles/shell.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <LogSyncProvider><App /></LogSyncProvider>
      </AuthProvider>
    </BrowserRouter>
    <DeferredAnalytics />
  </React.StrictMode>
);
registerOfflineApp();
