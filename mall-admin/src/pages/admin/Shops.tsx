import { useCallback, useEffect, useState } from 'react'
import { App, Avatar, Button, Card, Input, Select, Space, Table, Tag } from 'antd'
import { ShopOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { auditShop, getAdminShops, updateShopStatus } from '../../api'

const statusMap: Record<string, { color: string; text: string }> = {
  pending: { color: 'orange', text: '待审核' },
  approved: { color: 'green', text: '已通过' },
  rejected: { color: 'red', text: '已拒绝' },
  disabled: { color: 'default', text: '已停用' },
}

export default function Shops() {
  const { message, modal } = App.useApp()
  const [list, setList] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<string>()
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res: any = await getAdminShops({ status, keyword, page, page_size: pageSize })
      setList(res.data?.list || [])
      setTotal(res.data?.total || 0)
    } finally {
      setLoading(false)
    }
  }, [status, keyword, page, pageSize])

  useEffect(() => {
    load()
  }, [load])

  const onApprove = (record: any) => {
    modal.confirm({
      title: '通过审核',
      content: `确认通过店铺「${record.name}」的入驻申请？`,
      onOk: async () => {
        await auditShop(record.id, { action: 'approve' })
        message.success('已通过')
        load()
      },
    })
  }

  const onReject = (record: any) => {
    let reason = ''
    modal.confirm({
      title: '拒绝入驻申请',
      content: (
        <Input.TextArea
          rows={3}
          placeholder="请输入拒绝原因"
          onChange={(e) => {
            reason = e.target.value
          }}
        />
      ),
      onOk: async () => {
        if (!reason.trim()) {
          message.error('请输入拒绝原因')
          return Promise.reject()
        }
        await auditShop(record.id, { action: 'reject', reject_reason: reason })
        message.success('已拒绝')
        load()
      },
    })
  }

  const onToggleStatus = (record: any) => {
    const action = record.status === 'approved' ? 'disable' : 'enable'
    modal.confirm({
      title: action === 'disable' ? '停用店铺' : '启用店铺',
      content: `确认${action === 'disable' ? '停用' : '启用'}店铺「${record.name}」？`,
      onOk: async () => {
        await updateShopStatus(record.id, action)
        message.success('操作成功')
        load()
      },
    })
  }

  return (
    <Card title="店铺管理">
      <Space style={{ marginBottom: 16 }}>
        <Select
          allowClear
          placeholder="状态"
          style={{ width: 140 }}
          value={status}
          onChange={(v) => {
            setPage(1)
            setStatus(v)
          }}
          options={Object.entries(statusMap).map(([value, v]) => ({ value, label: v.text }))}
        />
        <Input.Search
          allowClear
          placeholder="店铺名称"
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
          {
            title: 'Logo',
            dataIndex: 'logo',
            width: 70,
            render: (v: string) => <Avatar src={v} icon={<ShopOutlined />} />,
          },
          { title: '店铺名称', dataIndex: 'name' },
          {
            title: '商家账号',
            dataIndex: 'merchant_username',
            render: (v: string, r: any) => v || r.merchant?.username || '-',
          },
          { title: '商品数', dataIndex: 'product_count', width: 90 },
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
            title: '入驻时间',
            dataIndex: 'created_at',
            width: 160,
            render: (v: string) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-'),
          },
          {
            title: '操作',
            width: 200,
            render: (_: any, record: any) => (
              <Space>
                {record.status === 'pending' && (
                  <>
                    <Button size="small" type="primary" onClick={() => onApprove(record)}>
                      通过
                    </Button>
                    <Button size="small" danger onClick={() => onReject(record)}>
                      拒绝
                    </Button>
                  </>
                )}
                {record.status === 'approved' && (
                  <Button size="small" danger onClick={() => onToggleStatus(record)}>
                    停用
                  </Button>
                )}
                {record.status === 'disabled' && (
                  <Button size="small" type="primary" onClick={() => onToggleStatus(record)}>
                    启用
                  </Button>
                )}
              </Space>
            ),
          },
        ]}
      />
    </Card>
  )
}
