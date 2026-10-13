import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import AdminLayout from './layouts/AdminLayout'
import Login from './pages/Login'
import { useAuthStore } from './stores/authStore'

import MerchantDashboard from './pages/merchant/Dashboard'
import MyShop from './pages/merchant/MyShop'
import ProductList from './pages/merchant/ProductList'
import ProductEdit from './pages/merchant/ProductEdit'
import MerchantOrders from './pages/merchant/MerchantOrders'
import CsWorkbench from './pages/cs/Workbench'

import AdminDashboard from './pages/admin/Dashboard'
import Shops from './pages/admin/Shops'
import Categories from './pages/admin/Categories'
import ProductAudit from './pages/admin/ProductAudit'
import AdminOrders from './pages/admin/AdminOrders'
import Users from './pages/admin/Users'
import Banners from './pages/admin/Banners'
import Coupons from './pages/admin/Coupons'
import Settings from './pages/admin/Settings'

function RequireAuth() {
  const token = useAuthStore((s) => s.token)
  if (!token) return <Navigate to="/login" replace />
  return <Outlet />
}

function DashboardEntry() {
  const role = useAuthStore((s) => s.role)
  return role === 'admin' ? <AdminDashboard /> : <MerchantDashboard />
}

function RoleRoute({ allow, children }: { allow: ('admin' | 'merchant')[]; children: React.ReactNode }) {
  const role = useAuthStore((s) => s.role)
  if (!role || !allow.includes(role)) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<RequireAuth />}>
          <Route element={<AdminLayout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardEntry />} />
            <Route path="/shop" element={<RoleRoute allow={['merchant']}><MyShop /></RoleRoute>} />
            <Route path="/product" element={<RoleRoute allow={['merchant']}><ProductList /></RoleRoute>} />
            <Route path="/product/edit/:id?" element={<RoleRoute allow={['merchant']}><ProductEdit /></RoleRoute>} />
            <Route path="/order" element={<RoleRoute allow={['merchant']}><MerchantOrders /></RoleRoute>} />
            <Route path="/cs" element={<CsWorkbench />} />
            <Route path="/shops" element={<RoleRoute allow={['admin']}><Shops /></RoleRoute>} />
            <Route path="/category" element={<RoleRoute allow={['admin']}><Categories /></RoleRoute>} />
            <Route path="/product-audit" element={<RoleRoute allow={['admin']}><ProductAudit /></RoleRoute>} />
            <Route path="/orders" element={<RoleRoute allow={['admin']}><AdminOrders /></RoleRoute>} />
            <Route path="/users" element={<RoleRoute allow={['admin']}><Users /></RoleRoute>} />
            <Route path="/banner" element={<RoleRoute allow={['admin']}><Banners /></RoleRoute>} />
            <Route path="/coupon" element={<RoleRoute allow={['admin']}><Coupons /></RoleRoute>} />
            <Route path="/settings" element={<RoleRoute allow={['admin']}><Settings /></RoleRoute>} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
