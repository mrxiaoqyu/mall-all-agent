import { useCallback, useEffect, useState } from 'react'
import { App, Button, Card, Image, Input, Select, Space, Table, Tag } from 'antd'
import { getAdminProducts, updateAdminProductStatus } from '../../api'

const statusMap: Record<string, { color: string; text: string }> = {
  on: { color: 'green', text: '在售' },
  off: { color: 'default', text: '已下架' },
}

export default function ProductAudit() {
  const { message } = App.useApp()
  const [list, setList] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState<string>()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res: any = await getAdminProducts({ keyword, status, page, page_size: pageSize })
      setList(res.data?.list || [])
      setTotal(res.data?.total || 0)
    } finally {
      setLoading(false)
    }
  }, [keyword, status, page, pageSize])

  useEffect(() => {
    load()
  }, [load])

  const toggleStatus = async (record: any) => {
    const next = record.status === 'on' ? 'off' : 'on'
    await updateAdminProductStatus(record.id, next)
    message.success(next === 'off' ? '已强制下架' : '已上架')
    load()
  }

  return (
    <Card title="商品监管">
      <Space style={{ marginBottom: 16 }}>
        <Input.Search
          allowClear
          placeholder="商品标题关键词"
          style={{ width: 240 }}
          onSearch={(v) => {
            setPage(1)
            setKeyword(v)
          }}
        />
        <Select
          allowClear
          placeholder="状态"
          style={{ width: 140 }}
          value={status}
          onChange={(v) => {
            setPage(1)
            setStatus(v)
          }}
          options={[
            { value: 'on', label: '在售' },
            { value: 'off', label: '已下架' },
          ]}
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
          {
            title: '主图',
            dataIndex: 'main_image',
            width: 80,
            render: (v: string) =>
              v ? <Image src={v} width={48} height={48} style={{ objectFit: 'cover' }} /> : '-',
          },
          { title: '标题', dataIndex: 'title', ellipsis: true },
          {
            title: '店铺',
            dataIndex: 'shop_name',
            width: 160,
            render: (v: string, r: any) => v || r.shop?.name || '-',
          },
          {
            title: '价格',
            dataIndex: 'price',
            width: 110,
            render: (v: any, r: any) => `¥${v ?? r.min_price ?? '-'}`,
          },
          { title: '销量', dataIndex: 'sales', width: 90 },
          { title: '总库存', dataIndex: 'total_stock', width: 90 },
          {
            title: '状态',
            dataIndex: 'status',
            width: 100,
            render: (v: string) => {
              const s = statusMap[v] || { color: 'default', text: v }
              return <Tag color={s.color}>{s.text}</Tag>
            },
          },
          {
            title: '操作',
            width: 120,
            render: (_: any, record: any) =>
              record.status === 'on' ? (
                <Button size="small" danger onClick={() => toggleStatus(record)}>
                  强制下架
                </Button>
              ) : (
                <Button size="small" type="primary" onClick={() => toggleStatus(record)}>
                  上架
                </Button>
              ),
          },
        ]}
      />
    </Card>
  )
}
