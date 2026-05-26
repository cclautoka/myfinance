import { Capacitor } from '@capacitor/core';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/plus-jakarta-sans/wght.css';
import '@fontsource-variable/syne/wght.css';
import './index.css';
import App from './App.tsx';
import { configureNativeSafeArea } from './native/configureNativeSafeArea';
import { bootstrapPublicApiConfig } from './utils/publicApiBootstrap';

/** Native WebView: clip horizontal overflow and tune layout (see index.css `.cap-native`). */
if (Capacitor.isNativePlatform()) {
  document.documentElement.classList.add('cap-native');
  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }
  configureNativeSafeArea();
  bootstrapPublicApiConfig();
}
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
