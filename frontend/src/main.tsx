import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import dayjs from 'dayjs'
import 'dayjs/locale/th'
import '@picocss/pico/css/pico.min.css'
import './index.css'
import App from './App.tsx'

dayjs.locale('th')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)