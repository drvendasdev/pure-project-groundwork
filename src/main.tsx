import { createRoot } from 'react-dom/client'
import { WorkspaceProvider } from './contexts/WorkspaceContext'
import App from './App.tsx'
import './index.css'

createRoot(document.getElementById("root")!).render(
  <WorkspaceProvider>
    <App />
  </WorkspaceProvider>
);
