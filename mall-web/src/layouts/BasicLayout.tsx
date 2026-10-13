import { useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Badge, Dropdown, Input, Layout, Menu, Space } from 'antd'
import {
  CustomerServiceOutlined,
  DownOutlined,
  ShoppingCartOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { useAuthStore } from '../stores/authStore'
import { useCartStore } from '../stores/cartStore'
import { useCsStore } from '../stores/csStore'
import { useCsSocket } from '../ws/useCsSocket'

const { Header, Content, Footer } = Layout

export default function BasicLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { token, nickname, logout } = useAuthStore()
  const cartCount = useCartStore((s) => s.count)
  const csUnread = useCsStore((s) => s.unread)
  const refreshCart = useCartStore((s) => s.refresh)
  const refreshCs = useCsStore((s) => s.refresh)

  useCsSocket()

  useEffect(() => {
    if (token) {
      refreshCart()
      refreshCs()
    }
  }, [token, refreshCart, refreshCs])

  const selectedKey =
    location.pathname === '/'
      ? 'home'
      : location.pathname.startsWith('/products') || location.pathname.startsWith('/product/')
        ? 'products'
        : ''

  return (
    <Layout style={{ minHeight: '100%' }}>
      <Header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 24,
          background: '#fff',
          borderBottom: '1px solid #f0f0f0',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          padding: '0 24px',
        }}
      >
        <div
          style={{ fontSize: 20, fontWeight: 700, color: '#ff6a00', cursor: 'pointer', whiteSpace: 'nowrap' }}
          onClick={() => navigate('/')}
        >
          橙子商城
        </div>
        <Menu
          mode="horizontal"
          selectedKeys={[selectedKey]}
          style={{ flex: 'none', minWidth: 180, borderBottom: 'none' }}
          items={[
            { key: 'home', label: '首页' },
            { key: 'products', label: '商品分类' },
          ]}
          onClick={({ key }) => navigate(key === 'home' ? '/' : '/products')}
        />
        <Input.Search
          placeholder="搜索商品"
          allowClear
          style={{ maxWidth: 360, flex: 1 }}
          onSearch={(value) => navigate(`/products${value ? `?keyword=${encodeURIComponent(value)}` : ''}`)}
        />
        <Space size="large" style={{ marginLeft: 'auto' }}>
          <Badge count={cartCount} size="small">
            <ShoppingCartOutlined
              style={{ fontSize: 20, cursor: 'pointer' }}
              onClick={() => navigate('/cart')}
            />
          </Badge>
          <Badge count={csUnread} size="small">
            <CustomerServiceOutlined
              style={{ fontSize: 20, cursor: 'pointer' }}
              onClick={() => navigate('/cs')}
            />
          </Badge>
          {token ? (
            <Dropdown
              menu={{
                items: [
                  { key: 'profile', label: '个人中心' },
                  { key: 'orders', label: '我的订单' },
                  { key: 'coupons', label: '优惠券' },
                  { type: 'divider' },
                  { key: 'logout', label: '退出登录' },
                ],
                onClick: ({ key }) => {
                  if (key === 'logout') {
                    logout()
                    navigate('/')
                  } else {
                    navigate(`/${key}`)
                  }
                },
              }}
            >
              <Space style={{ cursor: 'pointer' }}>
                <UserOutlined />
                {nickname || '用户'}
                <DownOutlined style={{ fontSize: 10 }} />
              </Space>
            </Dropdown>
          ) : (
            <Space>
              <a onClick={() => navigate('/login')}>登录</a>
              <a onClick={() => navigate('/register')}>注册</a>
            </Space>
          )}
        </Space>
      </Header>
      <Content style={{ padding: '16px 24px', maxWidth: 1200, width: '100%', margin: '0 auto' }}>
        <Outlet />
      </Content>
      <Footer style={{ textAlign: 'center', color: '#999' }}>
        橙子商城 ©2026 演示项目
      </Footer>
    </Layout>
  )
}
