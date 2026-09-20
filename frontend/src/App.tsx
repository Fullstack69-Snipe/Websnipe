import './App.css'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './lib/auth'
import { useAuth } from './lib/useAuth'
import Layout from './components/Layout'
import SignIn from './pages/SignIn'
import EquipmentList from './pages/EquipmentList'
import MyBorrows from './pages/MyBorrows'
import ManageEquipment from './pages/ManageEquipment'
import BorrowRequests from './pages/BorrowRequests'
import ManageUsers from './pages/ManageUsers'
import type { Role } from './types'

// ยังไม่ได้ login -> ไปหน้า sign-in
// role ไม่ถึง -> เด้งกลับหน้าแรก (เมนูซ่อนให้อยู่แล้ว กันเข้าผ่าน URL ตรงๆ)
//
// นี่เป็นแค่การกันฝั่งหน้าจอ — สิทธิ์จริงตรวจที่ backend ทุก request
function Guard({ allow, children }: { allow?: Role[]; children: React.ReactNode }) {
  const { user, role, loading } = useAuth()

  if (loading) return <main className="container" aria-busy="true">กำลังตรวจสอบสิทธิ์...</main>
  if (!user) return <Navigate to="/signin" replace />
  if (allow && role && !allow.includes(role)) return <Navigate to="/equipment" replace />

  return <>{children}</>
}

// login อยู่แล้วไม่ต้องเห็นหน้า sign-in อีก
function SignInRoute() {
  const { user, loading } = useAuth()
  if (loading) return <main className="container" aria-busy="true">กำลังโหลด...</main>
  return user ? <Navigate to="/equipment" replace /> : <SignIn />
}

const STAFF: Role[] = ['staff', 'admin']

export default function App() {
  return (
    <AuthProvider>
      <Routes>
          <Route path="/signin" element={<SignInRoute />} />

          <Route
            element={
              <Guard>
                <Layout />
              </Guard>
            }
          >
            <Route index element={<Navigate to="/equipment" replace />} />
            <Route path="/equipment" element={<EquipmentList />} />
            <Route path="/my-borrows" element={<MyBorrows />} />

            <Route
              path="/manage/equipment"
              element={
                <Guard allow={STAFF}>
                  <ManageEquipment />
                </Guard>
              }
            />
            <Route
              path="/manage/requests"
              element={
                <Guard allow={STAFF}>
                  <BorrowRequests />
                </Guard>
              }
            />
            <Route
              path="/admin/users"
              element={
                <Guard allow={['admin']}>
                  <ManageUsers />
                </Guard>
              }
            />
          </Route>
      </Routes>
    </AuthProvider>
  )
}
