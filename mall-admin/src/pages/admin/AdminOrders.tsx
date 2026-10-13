import { useCallback, useEffect, useState } from 'react'
import { Button, Card, Drawer, Input, Select, Space, Table, Tag } from 'antd'
import dayjs from 'dayjs'
import { getAdminOrderDetail, getAdminOrders } from '../../api'
import { orderStatusMap, orderStatusOptions } from '../../constants'
import { OrderDetailContent } from '../merchant/MerchantOrders'

export default function AdminOrders() {
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
      const res: any = await getAdminOrders({ status, keyword, page, page_size: pageSize })
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
    const res: any = await getAdminOrderDetail(id)
    setDetail(res.data)
    setDrawerOpen(true)
  }

  return (
    <Card title="订单监管">
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
            title: '店铺',
            dataIndex: 'shop_name',
            width: 160,
            render: (v: string, r: any) => v || r.shop?.name || '-',
          },
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
            width: 100,
            render: (_: any, record: any) => (
              <Button size="small" onClick={() => openDetail(record.id)}>
                详情
              </Button>
            ),
          },
        ]}
      />
      <Drawer title="订单详情" width={640} open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <OrderDetailContent detail={detail} />
      </Drawer>
    </Card>
  )
}
