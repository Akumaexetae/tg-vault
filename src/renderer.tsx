import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { applyTheme, loadTheme } from './lib/theme';
import './styles/global.css';

// Before the first render, so a dark-mode launch never flashes white.
// Settings are mirrored in memory synchronously, so this needs no await.
applyTheme(loadTheme());

createRoot(document.getElementById('root')!).render(<App />);
