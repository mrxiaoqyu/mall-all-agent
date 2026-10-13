import { useEffect } from 'react'
import { Form, Input, Modal, Switch } from 'antd'
import type { Address, AddressPayload } from '../api'

interface Props {
  open: boolean
  initial?: Address | null
  onCancel: () => void
  onSubmit: (values: AddressPayload) => Promise<void> | void
}

export default function AddressForm({ open, initial, onCancel, onSubmit }: Props) {
  const [form] = Form.useForm<AddressPayload>()

  useEffect(() => {
    if (open) {
      if (initial) {
        form.setFieldsValue({
          receiver: initial.receiver,
          phone: initial.phone,
          province: initial.province,
          city: initial.city,
          district: initial.district,
          detail: initial.detail,
          is_default: initial.is_default,
        })
      } else {
        form.resetFields()
      }
    }
  }, [open, initial, form])

  return (
    <Modal
      title={initial ? '编辑地址' : '新建地址'}
      open={open}
      onCancel={onCancel}
      onOk={() => form.submit()}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" onFinish={onSubmit} initialValues={{ is_default: false }}>
        <Form.Item name="receiver" label="收货人" rules={[{ required: true, message: '请输入收货人' }]}>
          <Input placeholder="收货人姓名" maxLength={50} />
        </Form.Item>
        <Form.Item
          name="phone"
          label="手机号"
          rules={[
            { required: true, message: '请输入手机号' },
            { pattern: /^1\d{10}$/, message: '手机号格式不正确' },
          ]}
        >
          <Input placeholder="手机号" maxLength={20} />
        </Form.Item>
        <Form.Item name="province" label="省份" rules={[{ required: true, message: '请输入省份' }]}>
          <Input placeholder="如：浙江省" />
        </Form.Item>
        <Form.Item name="city" label="城市" rules={[{ required: true, message: '请输入城市' }]}>
          <Input placeholder="如：杭州市" />
        </Form.Item>
        <Form.Item name="district" label="区/县" rules={[{ required: true, message: '请输入区/县' }]}>
          <Input placeholder="如：西湖区" />
        </Form.Item>
        <Form.Item name="detail" label="详细地址" rules={[{ required: true, message: '请输入详细地址' }]}>
          <Input.TextArea placeholder="街道、门牌号等" rows={2} />
        </Form.Item>
        <Form.Item name="is_default" label="设为默认地址" valuePropName="checked">
          <Switch />
        </Form.Item>
      </Form>
    </Modal>
  )
}
