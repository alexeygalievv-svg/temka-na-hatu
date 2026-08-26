import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initTelegram } from './telegram'

initTelegram()
if (navigator.maxTouchPoints > 0 || 'ontouchstart' in window) {
  document.documentElement.classList.add('is-touch-map')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
