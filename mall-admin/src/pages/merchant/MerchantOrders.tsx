import { useCallback, useEffect, useState } from 'react'
import { App, Button, Card, Descriptions, Drawer, Input, Select, Space, Table, Tag } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { auditRefund, getMerchantOrderDetail, getMerchantOrders, shipOrder } from '../../api'
import { orderStatusMap, orderStatusOptions } from '../../constants'

export function OrderDetailContent({ detail }: { detail: any }) {
  if (!detail) return null
  const items = detail.items || detail.order_items || []
  const addr = detail.address || detail.address_snapshot || {}
  return (
    <div>
      <Descriptions column={2} bordered size="small" style={{ marginBottom: 16 }}>
        <Descriptions.Item label="订单号">{detail.order_no}</Descriptions.Item>
        <Descriptions.Item label="状态">
          <Tag color={orderStatusMap[detail.status]?.color}>
            {orderStatusMap[detail.status]?.text || detail.status}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="实付金额">¥{detail.pay_amount ?? detail.total_amount}</Descriptions.Item>
        <Descriptions.Item label="下单时间">
          {detail.created_at ? dayjs(detail.created_at).format('YYYY-MM-DD HH:mm') : '-'}
        </Descriptions.Item>
        <Descriptions.Item label="收货人" span={2}>
          {addr.receiver_name || addr.name || '-'} {addr.receiver_phone || addr.phone || ''}{' '}
          {addr.full_address || addr.address || `${addr.province || ''}${addr.city || ''}${addr.district || ''}${addr.detail || ''}`}
        </Descriptions.Item>
      </Descriptions>
      <Table
        rowKey={(r: any) => r.id ?? r.sku_id}
        size="small"
        pagination={false}
        dataSource={items}
        columns={[
          {
            title: '商品',
            dataIndex: 'product_title',
            render: (v: string, r: any) => v || r.title || '-',
          },
          { title: '规格', dataIndex: 'spec_name', width: 140 },
          { title: '单价', dataIndex: 'price', width: 110, render: (v: any) => `¥${v}` },
          { title: '数量', dataIndex: 'quantity', width: 80 },
        ]}
      />
    </div>
  )
}

export default function MerchantOrders() {
  const { message, modal } = App.useApp()
  const [list, setList] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<string>()
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [detail, setDetail] = useState<any>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res: any = await getMerchantOrders({ status, keyword, page, page_size: pageSize })
      setList(res.data?.list || [])
      setTotal(res.data?.total || 0)
    } finally {
      setLoading(false)
    }
  }, [status, keyword, page, pageSize])

  useEffect(() => {
    load()
  }, [load])

  const openDetail = async (id: number) => {
    const res: any = await getMerchantOrderDetail(id)
    setDetail(res.data)
    setDrawerOpen(true)
  }

  const onShip = (record: any) => {
    modal.confirm({
      title: '确认发货',
      content: `订单 ${record.order_no} 确认发货？`,
      onOk: async () => {
        await shipOrder(record.id)
        message.success('已发货')
        load()
      },
    })
  }

  const onRefundAudit = (record: any, action: 'approve' | 'reject') => {
    modal.confirm({
      title: action === 'approve' ? '同意退款' : '拒绝退款',
      content: `订单 ${record.order_no}，确认${action === 'approve' ? '同意' : '拒绝'}退款申请？`,
      onOk: async () => {
        await auditRefund(record.id, action)
        message.success('操作成功')
        load()
      },
    })
  }

  return (
    <Card title="订单管理">
      <Space style={{ marginBottom: 16 }}>
        <Select
          allowClear
          placeholder="订单状态"
          style={{ width: 140 }}
          value={status}
          onChange={(v) => {
            setPage(1)
            setStatus(v)
          }}
          options={orderStatusOptions}
        />
        <Input.Search
          allowClear
          placeholder="订单号"
          prefix={<SearchOutlined />}
          style={{ width: 240 }}
          onSearch={(v) => {
            setPage(1)
            setKeyword(v)
          }}
        />
      </Space>
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
          { title: '订单号', dataIndex: 'order_no', width: 200 },
          {
            title: '金额',
            dataIndex: 'pay_amount',
            width: 110,
            render: (v: any, r: any) => `¥${v ?? r.total_amount}`,
          },
          {
            title: '状态',
            dataIndex: 'status',
            width: 100,
            render: (v: string) => (
              <Tag color={orderStatusMap[v]?.color}>{orderStatusMap[v]?.text || v}</Tag>
            ),
          },
          {
            title: '下单时间',
            dataIndex: 'created_at',
            width: 160,
            render: (v: string) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-'),
          },
          {
            title: '操作',
            width: 260,
            render: (_: any, record: any) => (
              <Space wrap>
                <Button size="small" onClick={() => openDetail(record.id)}>
                  详情
                </Button>
                {record.status === 'paid' && (
                  <Button size="small" type="primary" onClick={() => onShip(record)}>
                    发货
                  </Button>
                )}
                {record.status === 'refunding' && (
                  <>
                    <Button size="small" type="primary" onClick={() => onRefundAudit(record, 'approve')}>
                      同意退款
                    </Button>
                    <Button size="small" danger onClick={() => onRefundAudit(record, 'reject')}>
                      拒绝退款
                    </Button>
                  </>
                )}
              </Space>
            ),
          },
        ]}
      />
      <Drawer
        title="订单详情"
        width={640}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      >
        <OrderDetailContent detail={detail} />
      </Drawer>
    </Card>
  )
}
