import { createContext, useContext } from 'react'
import type { FeedbackValue } from './feedback'

// อยู่ไฟล์นี้แทน feedback.tsx เพราะ Fast Refresh ต้องการให้ไฟล์ .tsx export แต่ component
export const FeedbackContext = createContext<FeedbackValue | null>(null)

export function useFeedback() {
  const ctx = useContext(FeedbackContext)
  if (!ctx) throw new Error('useFeedback ต้องอยู่ใน <FeedbackProvider>')
  return ctx
}
