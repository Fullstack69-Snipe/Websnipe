import './App.css'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider } from './lib/auth'
import { FeedbackProvider } from './lib/feedback'
import { useAuth } from './lib/useAuth'
import Layout from './components/Layout'
import SignIn from './pages/SignIn'
import Home from './pages/Home'
import EquipmentList from './pages/EquipmentList'
import EquipmentDetail from './pages/EquipmentDetail'
import MyBorrows from './pages/MyBorrows'
import ManageEquipment from './pages/ManageEquipment'
import BorrowRequests from './pages/BorrowRequests'
import ManageCategories from './pages/ManageCategories'
import ManageUsers from './pages/ManageUsers'
import ManageDepartments from './pages/ManageDepartments'
import QrLabels from './pages/QrLabels'
import Reports from './pages/Reports'
import type { Role } from './types'

// ยังไม่ได้ login -> ไปหน้า sign-in
// role ไม่ถึง -> เด้งกลับหน้าแรก (เมนูซ่อนให้อยู่แล้ว กันเข้าผ่าน URL ตรงๆ)
//
// นี่เป็นแค่การกันฝั่งหน้าจอ — สิทธิ์จริงตรวจที่ backend ทุก request
function Guard({ allow, children }: { allow?: Role[]; children: React.ReactNode }) {
  const { user, role, loading } = useAuth()
  const location = useLocation()

  if (loading) return <main className="container" aria-busy="true">กำลังตรวจสอบสิทธิ์...</main>
  if (!user) {
    // จำหน้าไว้ เช่น สแกน QR ตอนยังไม่ login -> login เสร็จแล้วกลับมาหน้านี้
    const next = location.pathname + location.search
    return <Navigate to={`/signin?next=${encodeURIComponent(next)}`} replace />
  }
  if (allow && role && !allow.includes(role)) return <Navigate to="/equipment" replace />

  return <>{children}</>
}

// login อยู่แล้วไม่ต้องเห็นหน้า sign-in อีก
function SignInRoute() {
  const { user, loading } = useAuth()
  if (loading) return <main className="container" aria-busy="true">กำลังโหลด...</main>
  return user ? <Navigate to="/" replace /> : <SignIn />
}

const STAFF: Role[] = ['staff', 'admin']

export default function App() {
  return (
    <AuthProvider>
      <FeedbackProvider>
      <Routes>
          <Route path="/signin" element={<SignInRoute />} />

          <Route
            element={
              <Guard>
                <Layout />
              </Guard>
            }
          >
            <Route index element={<Home />} />
            <Route path="/equipment" element={<EquipmentList />} />
            <Route path="/equipment/:id" element={<EquipmentDetail />} />
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
              path="/manage/reports"
              element={
                <Guard allow={STAFF}>
                  <Reports />
                </Guard>
              }
            />
            <Route
              path="/manage/qr"
              element={
                <Guard allow={STAFF}>
                  <QrLabels />
                </Guard>
              }
            />
            <Route
              path="/manage/categories"
              element={
                <Guard allow={STAFF}>
                  <ManageCategories />
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
            <Route
              path="/admin/departments"
              element={
                <Guard allow={['admin']}>
                  <ManageDepartments />
                </Guard>
              }
            />
          </Route>
      </Routes>
      </FeedbackProvider>
    </AuthProvider>
  )
}
