import { useCallback, useEffect, useState } from 'react'
import { App, Button, Card, DatePicker, Form, Input, InputNumber, Modal, Space, Table, Tag } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { createCoupon, getAdminCoupons, toggleCoupon, updateCoupon } from '../../api'

export default function Coupons() {
  const { message, modal } = App.useApp()
  const [list, setList] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res: any = await getAdminCoupons({ page, page_size: pageSize })
      setList(res.data?.list || res.data || [])
      setTotal(res.data?.total || 0)
    } finally {
      setLoading(false)
    }
  }, [page, pageSize])

  useEffect(() => {
    load()
  }, [load])

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    setModalOpen(true)
  }

  const openEdit = (record: any) => {
    setEditing(record)
    form.setFieldsValue({
      title: record.title,
      threshold_amount: record.threshold_amount,
      minus_amount: record.minus_amount,
      total_count: record.total_count,
      range: [
        record.start_at ? dayjs(record.start_at) : null,
        record.end_at ? dayjs(record.end_at) : null,
      ],
    })
    setModalOpen(true)
  }

  const onSubmit = async () => {
    const values = await form.validateFields()
    const payload = {
      title: values.title,
      threshold_amount: values.threshold_amount,
      minus_amount: values.minus_amount,
      total_count: values.total_count,
      start_at: values.range?.[0]?.toISOString(),
      end_at: values.range?.[1]?.toISOString(),
    }
    setSaving(true)
    try {
      if (editing) {
        await updateCoupon(editing.id, payload)
        message.success('保存成功')
      } else {
        await createCoupon(payload)
        message.success('创建成功')
      }
      setModalOpen(false)
      load()
    } finally {
      setSaving(false)
    }
  }

  const onToggle = (record: any) => {
    modal.confirm({
      title: record.is_enabled ? '停用优惠券' : '启用优惠券',
      content: `确认${record.is_enabled ? '停用' : '启用'}优惠券「${record.title}」？`,
      onOk: async () => {
        await toggleCoupon(record.id)
        message.success('操作成功')
        load()
      },
    })
  }

  return (
    <Card
      title="优惠券管理"
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          新增优惠券
        </Button>
      }
    >
      <Table
        rowKey="id"
        loading={loading}
        dataSource={list}
        pagination={{
          current: page,
          pageSize,
          total,
          showTotal: (t) => `共 ${t} 条`,
          onChange: (p, ps) => {
            setPage(p)
            setPageSize(ps)
          },
        }}
        columns={[
          { title: '标题', dataIndex: 'title' },
          {
            title: '门槛金额',
            dataIndex: 'threshold_amount',
            width: 110,
            render: (v: any) => `¥${v}`,
          },
          {
            title: '减免金额',
            dataIndex: 'minus_amount',
            width: 110,
            render: (v: any) => `¥${v}`,
          },
          { title: '发行总量', dataIndex: 'total_count', width: 100 },
          { title: '已领取', dataIndex: 'received_count', width: 90, render: (v: any) => v ?? '-' },
          {
            title: '有效期',
            width: 230,
            render: (_: any, r: any) =>
              `${r.start_at ? dayjs(r.start_at).format('YYYY-MM-DD HH:mm') : '-'} ~ ${
                r.end_at ? dayjs(r.end_at).format('YYYY-MM-DD HH:mm') : '-'
              }`,
          },
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
                <Button
                  size="small"
                  danger={!!record.is_enabled}
                  type={record.is_enabled ? 'default' : 'primary'}
                  onClick={() => onToggle(record)}
                >
                  {record.is_enabled ? '停用' : '启用'}
                </Button>
              </Space>
            ),
          },
        ]}
      />
      <Modal
        title={editing ? '编辑优惠券' : '新增优惠券'}
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
          <Form.Item
            name="threshold_amount"
            label="门槛金额（元）"
            rules={[{ required: true, message: '请输入门槛金额' }]}
          >
            <InputNumber min={0} precision={2} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="minus_amount"
            label="减免金额（元）"
            rules={[{ required: true, message: '请输入减免金额' }]}
          >
            <InputNumber min={0} precision={2} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="total_count"
            label="发行总量"
            rules={[{ required: true, message: '请输入发行总量' }]}
          >
            <InputNumber min={1} precision={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="range" label="有效期" rules={[{ required: true, message: '请选择有效期' }]}>
            <DatePicker.RangePicker showTime style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}
