import { useCallback, useEffect, useState } from 'react'
import { App, Button, Card, Form, Image, Input, InputNumber, Modal, Popconfirm, Space, Switch, Table, Tag } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { createBanner, deleteBanner, getAdminBanners, updateBanner } from '../../api'

export default function Banners() {
  const { message } = App.useApp()
  const [list, setList] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res: any = await getAdminBanners()
      setList(res.data?.list || res.data || [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ sort: 0, is_enabled: true })
    setModalOpen(true)
  }

  const openEdit = (record: any) => {
    setEditing(record)
    form.setFieldsValue({
      title: record.title,
      image: record.image,
      link_url: record.link_url,
      sort: record.sort,
      is_enabled: record.is_enabled,
    })
    setModalOpen(true)
  }

  const onSubmit = async () => {
    const values = await form.validateFields()
    setSaving(true)
    try {
      if (editing) {
        await updateBanner(editing.id, values)
        message.success('保存成功')
      } else {
        await createBanner(values)
        message.success('创建成功')
      }
      setModalOpen(false)
      load()
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async (id: number) => {
    await deleteBanner(id)
    message.success('删除成功')
    load()
  }

  return (
    <Card
      title="轮播管理"
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          新增轮播
        </Button>
      }
    >
      <Table
        rowKey="id"
        loading={loading}
        dataSource={list}
        pagination={false}
        columns={[
          {
            title: '图片',
            dataIndex: 'image',
            width: 120,
            render: (v: string) =>
              v ? <Image src={v} width={96} height={40} style={{ objectFit: 'cover' }} /> : '-',
          },
          { title: '标题', dataIndex: 'title' },
          { title: '跳转链接', dataIndex: 'link_url', ellipsis: true, render: (v: string) => v || '-' },
          { title: '排序', dataIndex: 'sort', width: 80 },
          {
            title: '状态',
            dataIndex: 'is_enabled',
            width: 90,
            render: (v: boolean) => (v ? <Tag color="green">启用</Tag> : <Tag>停用</Tag>),
          },
          {
            title: '操作',
            width: 180,
            render: (_: any, record: any) => (
              <Space>
                <Button size="small" onClick={() => openEdit(record)}>
                  编辑
                </Button>
                <Popconfirm title="确认删除该轮播？" onConfirm={() => onDelete(record.id)}>
                  <Button size="small" danger>
                    删除
                  </Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />
      <Modal
        title={editing ? '编辑轮播' : '新增轮播'}
        open={modalOpen}
        onOk={onSubmit}
        onCancel={() => setModalOpen(false)}
        confirmLoading={saving}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="image" label="图片 URL" rules={[{ required: true, message: '请输入图片 URL' }]}>
            <Input placeholder="https://..." />
          </Form.Item>
          <Form.Item name="link_url" label="跳转链接">
            <Input placeholder="选填" />
          </Form.Item>
          <Form.Item name="sort" label="排序">
            <InputNumber min={0} precision={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="is_enabled" label="是否启用" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}
