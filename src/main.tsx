import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/plus-jakarta-sans/wght.css';
import '@fontsource-variable/syne/wght.css';
import './index.css';
import App from './App.tsx';
import { preloadWorkbookModule } from './SignedInWorkbook';
import { readHouseholdSession } from './utils/householdSession';

if (readHouseholdSession()?.token) {
  void preloadWorkbookModule();
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
