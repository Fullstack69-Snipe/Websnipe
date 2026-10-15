import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import dayjs from 'dayjs'
import 'dayjs/locale/th'
import buddhistEra from 'dayjs/plugin/buddhistEra'
import relativeTime from 'dayjs/plugin/relativeTime'
import '@picocss/pico/css/pico.min.css'
import './index.css'
import App from './App.tsx'

dayjs.locale('th')
// แสดงปีเป็น พ.ศ. ด้วย format 'BBBB' (ค่าที่ส่งให้ <input type="date"> ยังเป็น YYYY-MM-DD ค.ศ. ตามมาตรฐาน)
dayjs.extend(buddhistEra)
// "5 นาทีที่แล้ว" ในกระดิ่งแจ้งเตือน
dayjs.extend(relativeTime)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)