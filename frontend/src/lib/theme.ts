// โหมดสว่าง/มืด — ไม่เลือก = ตามการตั้งค่าของเครื่อง (Pico จัดการให้)
// เลือกแล้วจำไว้ใน localStorage และใส่ data-theme ที่ <html> ซึ่ง Pico ใช้สลับสี
// index.html ใส่ค่าที่จำไว้ตั้งแต่ก่อนหน้าโหลด จะได้ไม่กะพริบเป็นสีสว่างก่อน

export type Theme = 'light' | 'dark'

const KEY = 'theme'

export function currentTheme(): Theme {
  const set = document.documentElement.dataset.theme
  if (set === 'light' || set === 'dark') return set
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function setTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    // โหมดส่วนตัวบางเบราว์เซอร์เขียน localStorage ไม่ได้ — สลับได้แค่รอบนี้ ไม่เป็นไร
  }
}
