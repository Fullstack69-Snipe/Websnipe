import './App.css'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router'
import { RoleProvider } from './lib/role'
import Layout from './components/Layout'
import EquipmentList from './pages/EquipmentList'
import MyBorrows from './pages/MyBorrows'
import ManageEquipment from './pages/ManageEquipment'
import BorrowRequests from './pages/BorrowRequests'

export default function App() {
  return (
    <RoleProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Navigate to="/equipment" replace />} />
            <Route path="/equipment" element={<EquipmentList />} />
            <Route path="/my-borrows" element={<MyBorrows />} />

            {/* staff + admin */}
            <Route path="/manage/equipment" element={<ManageEquipment />} />
            <Route path="/manage/requests" element={<BorrowRequests />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </RoleProvider>
  )
}