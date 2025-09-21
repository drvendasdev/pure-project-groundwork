import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { SystemCustomizationProvider } from './contexts/SystemCustomizationContext'

createRoot(document.getElementById("root")!).render(
  <SystemCustomizationProvider>
    <App />
  </SystemCustomizationProvider>
);
