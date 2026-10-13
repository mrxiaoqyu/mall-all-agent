import { useState } from 'react'
import { Button, Card, Form, Input, Tabs, Alert, App } from 'antd'
import { LockOutlined, UserOutlined, ShopOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { adminLogin, merchantLogin, merchantRegister } from '../api'
import { useAuthStore } from '../stores/authStore'

export default function Login() {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const login = useAuthStore((s) => s.login)
  const [adminLoading, setAdminLoading] = useState(false)
  const [merchantLoading, setMerchantLoading] = useState(false)
  const [registerLoading, setRegisterLoading] = useState(false)
  const [merchantError, setMerchantError] = useState('')

  const onAdminLogin = async (values: { username: string; password: string }) => {
    setAdminLoading(true)
    try {
      const res: any = await adminLogin(values)
      login({
        token: res.data.token,
        role: 'admin',
        userId: res.data.user_id ?? res.data.id,
        username: res.data.username ?? values.username,
      })
      message.success('登录成功')
      navigate('/')
    } finally {
        setAdminLoading(false)
    }
  }

  const onMerchantLogin = async (values: { username: string; password: string }) => {
    setMerchantLoading(true)
    setMerchantError('')
    try {
      const res: any = await merchantLogin(values)
      login({
        token: res.data.token,
        role: 'merchant',
        userId: res.data.user_id ?? res.data.id,
        username: res.data.username ?? values.username,
        shopId: res.data.shop_id,
      })
      message.success('登录成功')
      navigate('/')
    } catch (err: any) {
      if (err?.response?.status === 403) {
        setMerchantError(err.response.data?.message || '店铺状态异常，无法登录')
      } else if (err?.response?.data?.message) {
        message.error(err.response.data.message)
      } else if (!err?.response) {
        message.error('网络异常，请稍后重试')
      }
    } finally {
      setMerchantLoading(false)
    }
  }

  const onRegister = async (values: any) => {
    setRegisterLoading(true)
    try {
      await merchantRegister(values)
      message.success('入驻申请已提交，请等待平台审核')
    } finally {
      setRegisterLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #1677ff 0%, #69b1ff 100%)',
      }}
    >
      <Card style={{ width: 420 }} title="商城维护端" styles={{ header: { textAlign: 'center', fontSize: 18 } }}>
        <Tabs
          defaultActiveKey="admin"
          centered
          items={[
            {
              key: 'admin',
              label: '平台管理员登录',
              children: (
                <Form onFinish={onAdminLogin} size="large">
                  <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
                    <Input prefix={<UserOutlined />} placeholder="用户名" />
                  </Form.Item>
                  <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
                    <Input.Password prefix={<LockOutlined />} placeholder="密码" />
                  </Form.Item>
                  <Button type="primary" htmlType="submit" block loading={adminLoading}>
                    登录
                  </Button>
                </Form>
              ),
            },
            {
              key: 'merchant',
              label: '商家通道',
              children: (
                <Tabs
                  defaultActiveKey="login"
                  centered
                  items={[
                    {
                      key: 'login',
                      label: '商家登录',
                      children: (
                        <Form onFinish={onMerchantLogin} size="large">
                          {merchantError && (
                            <Form.Item>
                              <Alert type="error" showIcon message={merchantError} />
                            </Form.Item>
                          )}
                          <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
                            <Input prefix={<UserOutlined />} placeholder="商家账号" />
                          </Form.Item>
                          <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
                            <Input.Password prefix={<LockOutlined />} placeholder="密码" />
                          </Form.Item>
                          <Button type="primary" htmlType="submit" block loading={merchantLoading}>
                            登录
                          </Button>
                        </Form>
                      ),
                    },
                    {
                      key: 'register',
                      label: '入驻申请',
                      children: (
                        <Form onFinish={onRegister} layout="vertical">
                          <Form.Item name="username" label="账号" rules={[{ required: true, message: '请输入账号' }]}>
                            <Input placeholder="登录账号" />
                          </Form.Item>
                          <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
                            <Input.Password placeholder="登录密码" />
                          </Form.Item>
                          <Form.Item
                            name="shop_name"
                            label="店铺名称"
                            rules={[{ required: true, message: '请输入店铺名称' }]}
                          >
                            <Input prefix={<ShopOutlined />} placeholder="店铺名称" />
                          </Form.Item>
                          <Form.Item name="shop_logo" label="店铺 Logo URL">
                            <Input placeholder="选填" />
                          </Form.Item>
                          <Form.Item name="shop_description" label="店铺简介">
                            <Input.TextArea rows={2} placeholder="选填" />
                          </Form.Item>
                          <Button type="primary" htmlType="submit" block loading={registerLoading}>
                            提交入驻申请
                          </Button>
                        </Form>
                      ),
                    },
                  ]}
                />
              ),
            },
          ]}
        />
      </Card>
    </div>
  )
}
