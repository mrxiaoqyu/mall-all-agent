import { Layout, Menu, Tag, Dropdown, Avatar, theme } from 'antd'
import {
  DashboardOutlined,
  ShopOutlined,
  ShoppingOutlined,
  OrderedListOutlined,
  CustomerServiceOutlined,
  AppstoreOutlined,
  AuditOutlined,
  UserOutlined,
  PictureOutlined,
  GiftOutlined,
  SettingOutlined,
  LogoutOutlined,
} from '@ant-design/icons'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'

const { Sider, Header, Content } = Layout

const merchantMenus = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: '店铺看板' },
  { key: '/shop', icon: <ShopOutlined />, label: '我的店铺' },
  { key: '/product', icon: <ShoppingOutlined />, label: '商品管理' },
  { key: '/order', icon: <OrderedListOutlined />, label: '订单管理' },
  { key: '/cs', icon: <CustomerServiceOutlined />, label: '客服工作台' },
]

const adminMenus = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: '全局看板' },
  { key: '/shops', icon: <ShopOutlined />, label: '店铺管理' },
  { key: '/category', icon: <AppstoreOutlined />, label: '分类管理' },
  { key: '/product-audit', icon: <AuditOutlined />, label: '商品监管' },
  { key: '/orders', icon: <OrderedListOutlined />, label: '订单监管' },
  { key: '/users', icon: <UserOutlined />, label: '用户管理' },
  { key: '/banner', icon: <PictureOutlined />, label: '轮播管理' },
  { key: '/coupon', icon: <GiftOutlined />, label: '优惠券管理' },
  { key: '/settings', icon: <SettingOutlined />, label: '平台设置' },
  { key: '/cs', icon: <CustomerServiceOutlined />, label: '客服工作台' },
]

export default function AdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { role, username, logout } = useAuthStore()
  const {
    token: { colorBgContainer },
  } = theme.useToken()

  const menus = role === 'admin' ? adminMenus : merchantMenus
  const selectedKey =
    menus.find((m) => location.pathname === m.key || location.pathname.startsWith(m.key + '/'))
      ?.key || '/dashboard'

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider theme="dark">
        <div
          style={{
            height: 56,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: 17,
            fontWeight: 600,
          }}
        >
          商城维护端
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menus}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            background: colorBgContainer,
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 12,
          }}
        >
          <Tag color={role === 'admin' ? 'blue' : 'green'}>
            {role === 'admin' ? '平台管理员' : '商家'}
          </Tag>
          <Dropdown
            menu={{
              items: [
                {
                  key: 'logout',
                  icon: <LogoutOutlined />,
                  label: '退出登录',
                  onClick: () => {
                    logout()
                    navigate('/login')
                  },
                },
              ],
            }}
          >
            <span style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Avatar size="small" icon={<UserOutlined />} />
              {username}
            </span>
          </Dropdown>
        </Header>
        <Content style={{ margin: 16 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
