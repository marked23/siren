import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { consoleInterceptor } from './utils/consoleInterceptor'
import { logger } from './utils/logger'

consoleInterceptor.init();
logger.info('Application starting up');

createRoot(document.getElementById('root')!).render(
  <App />
)
