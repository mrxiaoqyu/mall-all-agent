import request from './request'

// ---------- 认证 ----------
export const adminLogin = (data: { username: string; password: string }) =>
  request.post('/admin/auth/login', data)

export const merchantLogin = (data: { username: string; password: string }) =>
  request.post('/merchant/auth/login', data, { skipErrorMessage: true } as any)

export const merchantRegister = (data: {
  username: string
  password: string
  shop_name: string
  shop_logo?: string
  shop_description?: string
}) => request.post('/merchant/auth/register', data)

// ---------- 商家端 ----------
export const getMerchantDashboard = () => request.get('/merchant/dashboard')

export const getMerchantShop = () => request.get('/merchant/shop')

export const updateMerchantShop = (data: {
  name?: string
  logo?: string
  description?: string
  ai_enabled?: boolean
}) => request.put('/merchant/shop', data)

export const getMerchantProducts = (params: {
  keyword?: string
  status?: string
  page?: number
  page_size?: number
}) => request.get('/merchant/products', { params })

export const updateProductStatus = (id: number, status: 'on' | 'off') =>
  request.put(`/merchant/products/${id}/status`, { status })

export const deleteProduct = (id: number) =>
  request.delete(`/merchant/products/${id}`)

export const getProductDetail = (id: number) =>
  request.get(`/merchant/products/${id}`)

export const createProduct = (data: any) => request.post('/merchant/products', data)

export const updateProduct = (id: number, data: any) =>
  request.put(`/merchant/products/${id}`, data)

export const getCategories = () => request.get('/products/categories')

export const getMerchantOrders = (params: {
  status?: string
  keyword?: string
  page?: number
  page_size?: number
}) => request.get('/merchant/orders', { params })

export const getMerchantOrderDetail = (id: number) =>
  request.get(`/merchant/orders/${id}`)

export const shipOrder = (id: number) =>
  request.post(`/merchant/orders/${id}/ship`)

export const auditRefund = (id: number, action: 'approve' | 'reject') =>
  request.post(`/merchant/orders/${id}/refund_audit`, { action })

// ---------- 客服 ----------
export const getCsSessions = () => request.get('/cs/workbench/sessions')

export const getCsMessages = (sessionId: number) =>
  request.get(`/cs/sessions/${sessionId}/messages`)

export const readCsSession = (sessionId: number) =>
  request.post(`/cs/sessions/${sessionId}/read`)

export const updateSessionHandler = (sessionId: number, handler: 'agent' | 'human') =>
  request.patch(`/cs/sessions/${sessionId}/handler`, { handler })

// ---------- 平台管理员 ----------
export const getAdminDashboard = () => request.get('/admin/dashboard')

export const getAdminShops = (params: {
  status?: string
  keyword?: string
  page?: number
  page_size?: number
}) => request.get('/admin/shops', { params })

export const auditShop = (id: number, data: { action: 'approve' | 'reject'; reject_reason?: string }) =>
  request.post(`/admin/shops/${id}/audit`, data)

export const updateShopStatus = (id: number, action: 'disable' | 'enable') =>
  request.post(`/admin/shops/${id}/status`, { action })

export const getAdminCategories = () => request.get('/admin/categories')

export const createCategory = (data: { name: string; parent_id?: number; sort?: number }) =>
  request.post('/admin/categories', data)

export const updateCategory = (id: number, data: { name?: string; sort?: number }) =>
  request.put(`/admin/categories/${id}`, data)

export const deleteCategory = (id: number) => request.delete(`/admin/categories/${id}`)

export const getAdminProducts = (params: {
  keyword?: string
  shop_id?: number
  status?: string
  page?: number
  page_size?: number
}) => request.get('/admin/products', { params })

export const updateAdminProductStatus = (id: number, status: 'on' | 'off') =>
  request.put(`/admin/products/${id}/status`, { status })

export const getAdminOrders = (params: {
  status?: string
  keyword?: string
  page?: number
  page_size?: number
}) => request.get('/admin/orders', { params })

export const getAdminOrderDetail = (id: number) => request.get(`/admin/orders/${id}`)

export const getAdminUsers = (params: {
  keyword?: string
  page?: number
  page_size?: number
}) => request.get('/admin/users', { params })

export const updateUserStatus = (id: number, is_active: boolean) =>
  request.put(`/admin/users/${id}/status`, { is_active })

export const getAdminBanners = () => request.get('/admin/banners')

export const createBanner = (data: any) => request.post('/admin/banners', data)

export const updateBanner = (id: number, data: any) =>
  request.put(`/admin/banners/${id}`, data)

export const deleteBanner = (id: number) => request.delete(`/admin/banners/${id}`)

export const getAdminCoupons = (params?: { page?: number; page_size?: number }) =>
  request.get('/admin/coupons', { params })

export const createCoupon = (data: any) => request.post('/admin/coupons', data)

export const updateCoupon = (id: number, data: any) =>
  request.put(`/admin/coupons/${id}`, data)

export const toggleCoupon = (id: number) => request.post(`/admin/coupons/${id}/toggle`)

export const getAdminAiSettings = () => request.get('/admin/settings/ai')
export const updateAdminAiSettings = (data: { ai_enabled: boolean }) =>
  request.put('/admin/settings/ai', data)
