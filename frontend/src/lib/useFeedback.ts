import { useContext } from 'react'
import { FeedbackContext } from './feedback'

export function useFeedback() {
  const ctx = useContext(FeedbackContext)
  if (!ctx) throw new Error('useFeedback ต้องอยู่ใน <FeedbackProvider>')
  return ctx
}
