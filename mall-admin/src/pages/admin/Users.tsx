import { useCallback, useEffect, useState } from 'react'
import { App, Button, Card, Input, Space, Table, Tag } from 'antd'
import dayjs from 'dayjs'
import { getAdminUsers, updateUserStatus } from '../../api'

export default function Users() {
  const { message, modal } = App.useApp()
  const [list, setList] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res: any = await getAdminUsers({ keyword, page, page_size: pageSize })
      setList(res.data?.list || [])
      setTotal(res.data?.total || 0)
    } finally {
      setLoading(false)
    }
  }, [keyword, page, pageSize])

  useEffect(() => {
    load()
  }, [load])

  const toggle = (record: any) => {
    const next = !record.is_active
    modal.confirm({
      title: next ? '启用用户' : '禁用用户',
      content: `确认${next ? '启用' : '禁用'}用户「${record.nickname || record.username}」？`,
      onOk: async () => {
        await updateUserStatus(record.id, next)
        message.success('操作成功')
        load()
      },
    })
  }

  return (
    <Card title="用户管理">
      <Space style={{ marginBottom: 16 }}>
        <Input.Search
          allowClear
          placeholder="用户名 / 昵称 / 手机号"
          style={{ width: 260 }}
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
          { title: 'ID', dataIndex: 'id', width: 70 },
          { title: '用户名', dataIndex: 'username', width: 140 },
          { title: '昵称', dataIndex: 'nickname', width: 140 },
          { title: '手机号', dataIndex: 'phone', width: 140, render: (v: string) => v || '-' },
          {
            title: '状态',
            dataIndex: 'is_active',
            width: 100,
            render: (v: boolean) =>
              v ? <Tag color="green">正常</Tag> : <Tag color="red">已禁用</Tag>,
          },
          {
            title: '注册时间',
            dataIndex: 'created_at',
            width: 160,
            render: (v: string) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-'),
          },
          {
            title: '操作',
            width: 100,
            render: (_: any, record: any) =>
              record.is_active ? (
                <Button size="small" danger onClick={() => toggle(record)}>
                  禁用
                </Button>
              ) : (
                <Button size="small" type="primary" onClick={() => toggle(record)}>
                  启用
                </Button>
              ),
          },
        ]}
      />
    </Card>
  )
}
