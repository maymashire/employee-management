import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { registerServiceWorker } from './lib/pwa'
import App from './App'

if (import.meta.env.PROD) registerServiceWorker()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
