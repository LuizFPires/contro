import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@obdc/ui';
import '@obdc/ui/styles.css';
import './styles/app.css';
import { App } from './App';
import { iniciarSentry } from './lib/sentry';
import { iniciarSync } from './lib/sync';

iniciarSentry();

const queryClient = new QueryClient();
iniciarSync(queryClient);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <App />
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
);
