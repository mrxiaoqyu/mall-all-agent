import axios from 'axios'
import { message } from 'antd'

const request = axios.create({
  baseURL: '/api',
  timeout: 15000,
})

request.interceptors.request.use((config) => {
  const token = localStorage.getItem('mall_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

request.interceptors.response.use(
  (response) => {
    const body = response.data
    if (body && body.code === 0) {
      return body.data
    }
    const msg = body?.message || '请求失败'
    message.error(msg)
    return Promise.reject(new Error(msg))
  },
  (error) => {
    const status = error.response?.status
    const data = error.response?.data
    const msg = data?.message || data?.detail || error.message || '网络错误'
    if (status === 401) {
      localStorage.removeItem('mall_token')
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login'
      }
    }
    message.error(typeof msg === 'string' ? msg : '请求失败')
    return Promise.reject(error)
  },
)

export default request
