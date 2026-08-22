import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App.tsx';
import { optionsFromUrl } from './ui/urlOptions.ts';
import './index.css';

const root = document.getElementById('root');
if (!root) throw new Error('Root element #root not found');

createRoot(root).render(
  <StrictMode>
    <App {...optionsFromUrl(window.location.search)} />
  </StrictMode>,
);
