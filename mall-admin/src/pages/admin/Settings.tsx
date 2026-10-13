import { useEffect, useState } from 'react'
import { App, Card, Descriptions, Space, Switch, Tag } from 'antd'
import { getAdminAiSettings, updateAdminAiSettings } from '../../api'

export default function Settings() {
  const { message } = App.useApp()
  const [loading, setLoading] = useState(true)
  const [enabled, setEnabled] = useState(false)
  const [switching, setSwitching] = useState(false)

  useEffect(() => {
    getAdminAiSettings()
      .then((res: any) => setEnabled(!!res.data?.ai_enabled))
      .finally(() => setLoading(false))
  }, [])

  const onToggle = async (checked: boolean) => {
    setSwitching(true)
    try {
      await updateAdminAiSettings({ ai_enabled: checked })
      setEnabled(checked)
      message.success(checked ? '平台智能客服已开启' : '平台智能客服已关闭')
    } finally {
      setSwitching(false)
    }
  }

  return (
    <Card title="平台设置" loading={loading}>
      <Descriptions column={1} bordered>
        <Descriptions.Item label="平台智能客服">
          <Space>
            <Switch checked={enabled} loading={switching} onChange={onToggle} />
            <Tag color={enabled ? 'green' : 'default'}>{enabled ? '已开启' : '已关闭'}</Tag>
          </Space>
          <div style={{ color: '#999', fontSize: 12, marginTop: 8 }}>
            开启后，平台客服咨询优先由智能客服接待，可随时转人工
          </div>
        </Descriptions.Item>
      </Descriptions>
    </Card>
  )
}
