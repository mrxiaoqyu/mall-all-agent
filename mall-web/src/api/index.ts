import request from './request'

// ── 类型定义 ──

export interface LoginResult {
  token: string
  role: string
  user_id: number
  username: string
  nickname: string
}

export interface UserInfo {
  id: number
  username: string
  nickname: string
  avatar?: string | null
}

export interface Banner {
  id: number
  title: string
  image: string
  link_url?: string | null
  sort: number
}

export interface Category {
  id: number
  name: string
  parent_id: number | null
  sort: number
  children: Category[]
}

export interface ProductItem {
  id: number
  shop_id: number
  shop_name?: string | null
  category_id: number
  title: string
  sub_title?: string | null
  main_image?: string | null
  price: number
  sales: number
  status: string
}

export interface Sku {
  id: number
  product_id: number
  spec_name: string
  price: number
  stock: number
  sku_code?: string
}

export interface ProductDetailData extends ProductItem {
  shop_name: string
  images?: string[] | null
  detail?: string | null
  skus: Sku[]
}

export interface PageResult<T> {
  list: T[]
  total: number
  page: number
  page_size: number
}

export interface ShopBrief {
  id: number
  name: string
  logo?: string | null
  description?: string | null
}

export interface ShopDetailData extends ShopBrief {
  product_count: number
}

export interface CartLine {
  id: number
  sku_id: number
  quantity: number
  spec_name: string
  price: number
  stock: number
  product_id: number
  title: string
  main_image?: string | null
  shop_id: number
  shop_name: string
  product_status: string
}

export interface CartGroup {
  shop_id: number
  shop_name: string
  items: CartLine[]
}

export interface Address {
  id: number
  user_id: number
  receiver: string
  phone: string
  province: string
  city: string
  district: string
  detail: string
  is_default: boolean
}

export type AddressPayload = Omit<Address, 'id' | 'user_id'>

export interface Coupon {
  id: number
  title: string
  threshold_amount: number
  minus_amount: number
  total_count: number
  received_count: number
  start_at: string
  end_at: string
}

export interface UserCoupon {
  id: number
  coupon_id: number
  status: string
  title: string
  threshold_amount: number
  minus_amount: number
  start_at: string
  end_at: string
}

export interface OrderItem {
  id: number
  product_id: number
  sku_id: number
  title: string
  spec_name: string
  price: number
  quantity: number
  image?: string | null
}

export interface Order {
  id: number
  order_no: string
  batch_no: string
  user_id: number
  shop_id: number
  shop_name?: string | null
  total_amount: number
  discount_amount: number
  pay_amount: number
  status: string
  address_snapshot: {
    receiver: string
    phone: string
    province: string
    city: string
    district: string
    detail: string
  }
  coupon_id?: number | null
  created_at?: string | null
  items: OrderItem[]
}

export interface CreateOrderResult {
  batch_no: string
  order_ids: number[]
  order_nos: string[]
  pay_amount: number
}

export interface CsSession {
  id: number
  target_type: string
  shop_id?: number | null
  title: string
  shop_logo?: string | null
  status: string
  handler: 'agent' | 'human'
  last_message_at?: string | null
  unread_count: number
  last_message?: string | null
}

export interface CsMessage {
  id: number
  session_id: number
  sender_role: string
  sender_id: number
  content: string
  msg_type: string
  extra?: Record<string, any> | null
  is_read: boolean
  created_at?: string | null
}

// ── 智能客服 ──

export interface ProductCardItem {
  product_id: number
  title: string
  price: number
  image?: string | null
  shop_name?: string | null
  sales?: number
}

export interface ConfirmDraft {
  sku_id?: number
  product_id?: number
  title?: string
  spec_name?: string
  price?: number
  quantity?: number
  total?: number
  image?: string | null
  shop_name?: string
  address_text?: string
  order_no?: string
  pay_amount?: number
  reason?: string
  items?: { title: string; quantity: number }[]
}

export interface ConfirmPayload {
  action: 'buy' | 'after_sale'
  draft: ConfirmDraft
}

export interface ThreadState {
  interrupted: boolean
  pending_confirm?: ConfirmPayload | null
  running: boolean
}

export type AiEventHandler = (event: string, data: Record<string, any>) => void

/** POST + SSE 流读取（fetch ReadableStream，EventSource 不支持 POST/Header） */
async function ssePost(url: string, body: unknown, onEvent: AiEventHandler): Promise<void> {
  const token = localStorage.getItem('mall_token')
  const resp = await fetch(`/api${url}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })
  if (!resp.ok || !resp.body) {
    const err = await resp.json().catch(() => null)
    throw new Error(err?.message || `请求失败(${resp.status})`)
  }
  const reader = resp.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  let event = ''
  let dataLines: string[] = []
  const dispatch = () => {
    if (!event) return
    try {
      onEvent(event, JSON.parse(dataLines.join('')))
    } catch {
      // 忽略无法解析的事件
    }
    event = ''
    dataLines = []
  }
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    let idx: number
    while ((idx = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, idx).replace(/\r$/, '')
      buf = buf.slice(idx + 1)
      if (line.startsWith('event: ')) event = line.slice(7)
      else if (line.startsWith('data: ')) dataLines.push(line.slice(6))
      else if (line === '') dispatch()
    }
  }
  dispatch()
}

export const aiApi = {
  /** 发送消息并流式接收；lastSeq>0 且 content 空时为断线重连续传 */
  chatStream: (sessionId: number, content: string, lastSeq: number, onEvent: AiEventHandler) =>
    ssePost('/v1/ai/chat/stream', { session_id: sessionId, content, last_seq: lastSeq }, onEvent),
  /** 确认卡片决策（流式） */
  confirmStream: (sessionId: number, decision: 'confirm' | 'cancel', onEvent: AiEventHandler) =>
    ssePost('/v1/ai/confirm', { session_id: sessionId, decision }, onEvent),
  transfer: (sessionId: number) =>
    request.post<unknown, null>('/v1/ai/transfer', { session_id: sessionId }),
  threadState: (sessionId: number) =>
    request.get<unknown, ThreadState>(`/v1/ai/thread/${sessionId}/state`),
}

// ── 认证 ──

export const authApi = {
  login: (data: { username: string; password: string }) =>
    request.post<unknown, LoginResult>('/v1/auth/login', data),
  register: (data: { username: string; password: string; nickname?: string }) =>
    request.post<unknown, { id: number }>('/v1/auth/register', data),
  me: () => request.get<unknown, UserInfo>('/v1/auth/me'),
  updateProfile: (data: { nickname?: string; avatar?: string }) =>
    request.put<unknown, null>('/v1/auth/profile', data),
  updatePassword: (data: { old_password: string; new_password: string }) =>
    request.put<unknown, null>('/v1/auth/password', data),
}

// ── 轮播图 ──

export const bannerApi = {
  list: () => request.get<unknown, Banner[]>('/v1/banners'),
}

// ── 商品 ──

export const productApi = {
  categories: () => request.get<unknown, Category[]>('/v1/products/categories'),
  list: (params: {
    keyword?: string
    category_id?: number
    shop_id?: number
    sort?: string
    page?: number
    page_size?: number
  }) => request.get<unknown, PageResult<ProductItem>>('/v1/products', { params }),
  detail: (id: number | string) =>
    request.get<unknown, ProductDetailData>(`/v1/products/${id}`),
}

// ── 店铺 ──

export const shopApi = {
  recommend: () => request.get<unknown, ShopBrief[]>('/v1/shops/recommend'),
  detail: (id: number | string) => request.get<unknown, ShopDetailData>(`/v1/shops/${id}`),
}

// ── 购物车 ──

export const cartApi = {
  list: () => request.get<unknown, CartGroup[]>('/v1/cart'),
  add: (data: { sku_id: number; quantity: number }) =>
    request.post<unknown, null>('/v1/cart', data),
  update: (id: number, quantity: number) =>
    request.put<unknown, null>(`/v1/cart/${id}`, { quantity }),
  remove: (id: number) => request.delete<unknown, null>(`/v1/cart/${id}`),
}

// ── 地址 ──

export const addressApi = {
  list: () => request.get<unknown, Address[]>('/v1/addresses'),
  create: (data: AddressPayload) => request.post<unknown, Address>('/v1/addresses', data),
  update: (id: number, data: AddressPayload) =>
    request.put<unknown, null>(`/v1/addresses/${id}`, data),
  remove: (id: number) => request.delete<unknown, null>(`/v1/addresses/${id}`),
}

// ── 优惠券 ──

export const couponApi = {
  list: () => request.get<unknown, Coupon[]>('/v1/coupons'),
  mine: () => request.get<unknown, UserCoupon[]>('/v1/coupons/mine'),
  receive: (id: number) => request.post<unknown, null>(`/v1/coupons/${id}/receive`),
}

// ── 订单 ──

export const orderApi = {
  create: (data: {
    address_id: number
    items: { sku_id: number; quantity: number }[]
    use_cart: boolean
    user_coupon_id?: number | null
  }) => request.post<unknown, CreateOrderResult>('/v1/orders', data),
  payBatch: (batch_no: string) =>
    request.post<unknown, { paid: number }>('/v1/orders/pay_batch', { batch_no }),
  list: (params: { status?: string; page?: number; page_size?: number }) =>
    request.get<unknown, PageResult<Order>>('/v1/orders', { params }),
  detail: (id: number | string) => request.get<unknown, Order>(`/v1/orders/${id}`),
  cancel: (id: number) => request.post<unknown, null>(`/v1/orders/${id}/cancel`),
  confirm: (id: number) => request.post<unknown, null>(`/v1/orders/${id}/confirm`),
  refund: (id: number) => request.post<unknown, null>(`/v1/orders/${id}/refund`),
}

// ── 客服 ──

export const csApi = {
  createSession: (data: { target_type: 'platform' | 'shop'; shop_id?: number }) =>
    request.post<unknown, { id: number; target_type: string; shop_id?: number | null }>(
      '/v1/cs/sessions',
      data,
    ),
  sessions: () => request.get<unknown, CsSession[]>('/v1/cs/sessions'),
  unread: () => request.get<unknown, { unread: number }>('/v1/cs/unread'),
  messages: (sessionId: number | string, params?: { page?: number; page_size?: number }) =>
    request.get<unknown, { list: CsMessage[] }>(`/v1/cs/sessions/${sessionId}/messages`, {
      params,
    }),
  read: (sessionId: number | string) =>
    request.post<unknown, null>(`/v1/cs/sessions/${sessionId}/read`),
}
