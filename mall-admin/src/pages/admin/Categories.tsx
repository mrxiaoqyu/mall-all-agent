import { useCallback, useEffect, useState } from 'react'
import { App, Button, Card, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Table } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { createCategory, deleteCategory, getAdminCategories, updateCategory } from '../../api'

export default function Categories() {
  const { message } = App.useApp()
  const [tree, setTree] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res: any = await getAdminCategories()
      setTree(res.data || [])
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
    setModalOpen(true)
  }

  const openEdit = (record: any) => {
    setEditing(record)
    form.setFieldsValue({ name: record.name, sort: record.sort })
    setModalOpen(true)
  }

  const onSubmit = async () => {
    const values = await form.validateFields()
    setSaving(true)
    try {
      if (editing) {
        await updateCategory(editing.id, { name: values.name, sort: values.sort })
        message.success('保存成功')
      } else {
        await createCategory({
          name: values.name,
          parent_id: values.parent_id,
          sort: values.sort,
        })
        message.success('创建成功')
      }
      setModalOpen(false)
      load()
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async (id: number) => {
    await deleteCategory(id)
    message.success('删除成功')
    load()
  }

  return (
    <Card
      title="分类管理"
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          新增分类
        </Button>
      }
    >
      <Table
        rowKey="id"
        loading={loading}
        dataSource={tree}
        pagination={false}
        expandable={{ childrenColumnName: 'children' }}
        columns={[
          { title: '分类名称', dataIndex: 'name' },
          { title: '排序', dataIndex: 'sort', width: 100 },
          {
            title: '操作',
            width: 180,
            render: (_: any, record: any) => (
              <Space>
                <Button size="small" onClick={() => openEdit(record)}>
                  编辑
                </Button>
                <Popconfirm title="确认删除该分类？" onConfirm={() => onDelete(record.id)}>
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
        title={editing ? '编辑分类' : '新增分类'}
        open={modalOpen}
        onOk={onSubmit}
        onCancel={() => setModalOpen(false)}
        confirmLoading={saving}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          {!editing && (
            <Form.Item name="parent_id" label="父分类（不选则为一级分类）">
              <Select
                allowClear
                placeholder="选择一级分类作为父分类"
                options={tree.map((c: any) => ({ value: c.id, label: c.name }))}
              />
            </Form.Item>
          )}
          <Form.Item name="name" label="分类名称" rules={[{ required: true, message: '请输入分类名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="sort" label="排序">
            <InputNumber min={0} precision={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}
