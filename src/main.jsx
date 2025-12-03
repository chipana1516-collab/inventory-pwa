import React from 'react';
import { createRoot } from 'react-dom/client';
import InventoryApp from './components/InventoryApp';
import './index.css';

// Render principal
const rootElement = document.getElementById('root');

if (rootElement) {
  const root = createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <InventoryApp />
    </React.StrictMode>
  );
} else {
  console.error("❌ No se encontró el elemento #root en index.html");
}

