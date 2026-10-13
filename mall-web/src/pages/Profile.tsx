import { useCallback, useEffect, useState } from 'react'
import { Button, Card, Col, Form, Input, List, Popconfirm, Row, Space, Tag, message } from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import { addressApi, authApi, type Address, type AddressPayload } from '../api'
import AddressForm from '../components/AddressForm'
import { useAuthStore } from '../stores/authStore'

export default function Profile() {
  const { username, nickname, fetchMe } = useAuthStore()
  const [addresses, setAddresses] = useState<Address[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Address | null>(null)
  const [nicknameForm] = Form.useForm<{ nickname: string }>()
  const [passwordForm] = Form.useForm<{ old_password: string; new_password: string; confirm: string }>()

  const loadAddresses = useCallback(async () => {
    const list = await addressApi.list()
    setAddresses(list)
  }, [])

  useEffect(() => {
    nicknameForm.setFieldsValue({ nickname })
    loadAddresses().catch(() => {})
  }, [nickname, nicknameForm, loadAddresses])

  const submitNickname = async (values: { nickname: string }) => {
    await authApi.updateProfile(values)
    message.success('昵称已更新')
    await fetchMe()
  }

  const submitPassword = async (values: { old_password: string; new_password: string }) => {
    await authApi.updatePassword(values)
    message.success('密码修改成功')
    passwordForm.resetFields()
  }

  const submitAddress = async (values: AddressPayload) => {
    if (editing) {
      await addressApi.update(editing.id, values)
      message.success('地址已更新')
    } else {
      await addressApi.create(values)
      message.success('地址已添加')
    }
    setModalOpen(false)
    setEditing(null)
    await loadAddresses()
  }

  const setDefault = async (address: Address) => {
    const { receiver, phone, province, city, district, detail } = address
    await addressApi.update(address.id, {
      receiver,
      phone,
      province,
      city,
      district,
      detail,
      is_default: true,
    })
    message.success('已设为默认地址')
    await loadAddresses()
  }

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} md={10}>
        <Card title={`我的资料（${username}）`} style={{ marginBottom: 16 }}>
          <Form form={nicknameForm} layout="vertical" onFinish={submitNickname}>
            <Form.Item name="nickname" label="昵称" rules={[{ required: true, message: '请输入昵称' }]}>
              <Input placeholder="昵称" maxLength={30} />
            </Form.Item>
            <Button type="primary" htmlType="submit">
              保存昵称
            </Button>
          </Form>
        </Card>
        <Card title="修改密码">
          <Form form={passwordForm} layout="vertical" onFinish={submitPassword}>
            <Form.Item
              name="old_password"
              label="原密码"
              rules={[{ required: true, message: '请输入原密码' }]}
            >
              <Input.Password autoComplete="current-password" />
            </Form.Item>
            <Form.Item
              name="new_password"
              label="新密码"
              rules={[
                { required: true, message: '请输入新密码' },
                { min: 6, message: '密码至少 6 位' },
              ]}
            >
              <Input.Password autoComplete="new-password" />
            </Form.Item>
            <Form.Item
              name="confirm"
              label="确认新密码"
              dependencies={['new_password']}
              rules={[
                { required: true, message: '请再次输入新密码' },
                ({ getFieldValue }) => ({
                  validator: (_, value) =>
                    !value || getFieldValue('new_password') === value
                      ? Promise.resolve()
                      : Promise.reject(new Error('两次输入的密码不一致')),
                }),
              ]}
            >
              <Input.Password autoComplete="new-password" />
            </Form.Item>
            <Button type="primary" htmlType="submit">
              修改密码
            </Button>
          </Form>
        </Card>
      </Col>
      <Col xs={24} md={14}>
        <Card
          title="收货地址管理"
          extra={
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditing(null)
                setModalOpen(true)
              }}
            >
              新建地址
            </Button>
          }
        >
          <List
            dataSource={addresses}
            locale={{ emptyText: '暂无地址' }}
            renderItem={(a) => (
              <List.Item
                actions={[
                  <Button
                    key="edit"
                    type="text"
                    icon={<EditOutlined />}
                    onClick={() => {
                      setEditing(a)
                      setModalOpen(true)
                    }}
                  />,
                  <Popconfirm
                    key="del"
                    title="确定删除该地址？"
                    onConfirm={async () => {
                      await addressApi.remove(a.id)
                      message.success('已删除')
                      await loadAddresses()
                    }}
                  >
                    <Button type="text" danger icon={<DeleteOutlined />} />
                  </Popconfirm>,
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      {a.receiver}　{a.phone}
                      {a.is_default && <Tag color="orange">默认</Tag>}
                      {!a.is_default && (
                        <Button type="link" size="small" onClick={() => setDefault(a)}>
                          设为默认
                        </Button>
                      )}
                    </Space>
                  }
                  description={`${a.province} ${a.city} ${a.district} ${a.detail}`}
                />
              </List.Item>
            )}
          />
        </Card>
      </Col>
      <AddressForm
        open={modalOpen}
        initial={editing}
        onCancel={() => {
          setModalOpen(false)
          setEditing(null)
        }}
        onSubmit={submitAddress}
      />
    </Row>
  )
}
