import { useEffect, useState } from 'react'
import { App, Button, Card, Descriptions, Form, Input, Image, Space, Switch, Tag } from 'antd'
import { getMerchantShop, updateMerchantShop } from '../../api'

const statusMap: Record<string, { color: string; text: string }> = {
  pending: { color: 'orange', text: '审核中' },
  approved: { color: 'green', text: '已通过' },
  rejected: { color: 'red', text: '已拒绝' },
  disabled: { color: 'default', text: '已停用' },
}

export default function MyShop() {
  const { message } = App.useApp()
  const [shop, setShop] = useState<any>(null)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [aiSwitching, setAiSwitching] = useState(false)
  const [form] = Form.useForm()

  const load = () => {
    getMerchantShop().then((res: any) => setShop(res.data))
  }

  useEffect(() => {
    load()
  }, [])

  const onSave = async (values: any) => {
    setSaving(true)
    try {
      await updateMerchantShop({
        name: values.name,
        logo: values.logo,
        description: values.description,
      })
      message.success('保存成功')
      setEditing(false)
      load()
    } finally {
      setSaving(false)
    }
  }

  const onToggleAi = async (checked: boolean) => {
    setAiSwitching(true)
    try {
      await updateMerchantShop({ ai_enabled: checked })
      setShop((prev: any) => ({ ...prev, ai_enabled: checked }))
      message.success(checked ? '智能客服已开启' : '智能客服已关闭')
    } finally {
      setAiSwitching(false)
    }
  }

  if (!shop) return <Card loading />

  const status = statusMap[shop.status] || { color: 'default', text: shop.status }

  return (
    <Card
      title="我的店铺"
      extra={
        !editing && (
          <Button type="primary" onClick={() => {
            form.setFieldsValue({ name: shop.name, logo: shop.logo, description: shop.description })
            setEditing(true)
          }}>
            编辑
          </Button>
        )
      }
    >
      {editing ? (
        <Form form={form} layout="vertical" onFinish={onSave} style={{ maxWidth: 520 }}>
          <Form.Item name="name" label="店铺名称" rules={[{ required: true, message: '请输入店铺名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="logo" label="店铺 Logo URL">
            <Input placeholder="https://..." />
          </Form.Item>
          <Form.Item name="description" label="店铺简介">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" loading={saving}>保存</Button>
            <Button onClick={() => setEditing(false)}>取消</Button>
          </Space>
        </Form>
      ) : (
        <Descriptions column={1} bordered>
          <Descriptions.Item label="店铺 Logo">
            {shop.logo ? <Image src={shop.logo} width={64} height={64} style={{ objectFit: 'cover' }} /> : '未设置'}
          </Descriptions.Item>
          <Descriptions.Item label="店铺名称">{shop.name}</Descriptions.Item>
          <Descriptions.Item label="店铺简介">{shop.description || '暂无'}</Descriptions.Item>
          <Descriptions.Item label="状态"><Tag color={status.color}>{status.text}</Tag></Descriptions.Item>
          <Descriptions.Item label="智能客服">
            <Space>
              <Switch
                checked={!!shop.ai_enabled}
                loading={aiSwitching}
                onChange={onToggleAi}
              />
              <span style={{ color: '#999', fontSize: 12 }}>
                开启后，店铺咨询优先由智能客服接待，可随时转人工
              </span>
            </Space>
          </Descriptions.Item>
        </Descriptions>
      )}
    </Card>
  )
}
