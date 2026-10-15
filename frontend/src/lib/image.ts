// ย่อรูปในเบราว์เซอร์ก่อนอัปโหลด — รูปจากมือถือ 3-5MB ย่อแล้วเหลือราว 200-500KB
// อัปโหลดเร็วขึ้น ไม่ชนลิมิต 5MB ของ backend และหน้ารายการโหลดไว
const MAX_SIDE = 1600

export async function shrinkImage(file: File): Promise<File> {
  // ไฟล์ที่เบราว์เซอร์อ่านไม่ออก (เช่น HEIC บน Chrome) จะโยน error ตรงนี้ ให้ผู้เรียกแจ้งผู้ใช้
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')!
  // รูป PNG โปร่งใสแปลงเป็น JPEG แล้วพื้นจะเป็นสีดำ — ปูพื้นขาวก่อน
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
  if (!blob) throw new Error('ย่อรูปไม่สำเร็จ')
  const name = file.name.replace(/\.[^.]+$/, '') || 'photo'
  return new File([blob], `${name}.jpg`, { type: 'image/jpeg' })
}
