import { useCallback, useEffect, useState } from 'react'
import { App, Button, Card, Image, Input, Popconfirm, Select, Space, Table, Tag } from 'antd'
import { PlusOutlined, SearchOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { deleteProduct, getMerchantProducts, updateProductStatus } from '../../api'

const statusMap: Record<string, { color: string; text: string }> = {
  on: { color: 'green', text: '在售' },
  off: { color: 'default', text: '已下架' },
}

export default function ProductList() {
  const { message } = App.useApp()
  const navigate = useNavigate()
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
      const res: any = await getMerchantProducts({ keyword, status, page, page_size: pageSize })
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
    await updateProductStatus(record.id, next)
    message.success(next === 'on' ? '已上架' : '已下架')
    load()
  }

  const onDelete = async (id: number) => {
    await deleteProduct(id)
    message.success('删除成功')
    load()
  }

  return (
    <Card
      title="商品管理"
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/product/edit')}>
          新增商品
        </Button>
      }
    >
      <Space style={{ marginBottom: 16 }}>
        <Input
          allowClear
          placeholder="商品标题关键词"
          prefix={<SearchOutlined />}
          style={{ width: 240 }}
          onPressEnter={(e) => {
            setPage(1)
            setKeyword((e.target as HTMLInputElement).value)
          }}
          onChange={(e) => {
            if (!e.target.value) {
              setPage(1)
              setKeyword('')
            }
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
            title: '价格',
            dataIndex: 'price',
            width: 120,
            render: (v: any, r: any) => `¥${v ?? r.min_price ?? '-'}`,
          },
          { title: '销量', dataIndex: 'sales', width: 90 },
          {
            title: 'SKU 数',
            dataIndex: 'skus',
            width: 90,
            render: (v: any[], r: any) => r.sku_count ?? v?.length ?? '-',
          },
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
            width: 220,
            render: (_: any, record: any) => (
              <Space>
                <Button size="small" onClick={() => navigate(`/product/edit/${record.id}`)}>
                  编辑
                </Button>
                <Button size="small" onClick={() => toggleStatus(record)}>
                  {record.status === 'on' ? '下架' : '上架'}
                </Button>
                <Popconfirm title="确认删除该商品？" onConfirm={() => onDelete(record.id)}>
                  <Button size="small" danger>
                    删除
                  </Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />
    </Card>
  )
}
