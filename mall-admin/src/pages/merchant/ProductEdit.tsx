import { useEffect, useState } from 'react'
import { App, Button, Card, Cascader, Form, Input, InputNumber, Space } from 'antd'
import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons'
import { useNavigate, useParams } from 'react-router-dom'
import { createProduct, getCategories, getProductDetail, updateProduct } from '../../api'

interface CategoryNode {
  id: number
  name: string
  children?: CategoryNode[]
}

function toCascaderOptions(nodes: CategoryNode[]): any[] {
  return (nodes || []).map((n) => ({
    value: n.id,
    label: n.name,
    children: n.children && n.children.length > 0 ? toCascaderOptions(n.children) : undefined,
  }))
}

export default function ProductEdit() {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = !!id
  const [form] = Form.useForm()
  const [options, setOptions] = useState<any[]>([])
  const [categoryPath, setCategoryPath] = useState<number[]>([])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    getCategories().then((res: any) => setOptions(toCascaderOptions(res.data || [])))
  }, [])

  useEffect(() => {
    if (!isEdit) return
    getProductDetail(Number(id)).then((res: any) => {
      const d = res.data || {}
      form.setFieldsValue({
        title: d.title,
        sub_title: d.sub_title,
        main_image: d.main_image,
        images: d.images || [],
        detail: d.detail,
        skus: (d.skus || []).map((s: any) => ({
          id: s.id,
          spec_name: s.spec_name,
          price: s.price,
          stock: s.stock,
          sku_code: s.sku_code,
        })),
      })
      if (d.category_path && d.category_path.length > 0) {
        setCategoryPath(d.category_path)
      } else if (d.category_id) {
        setCategoryPath([d.category_id])
      }
    })
  }, [id, isEdit, form])

  const onSubmit = async (values: any) => {
    if (!categoryPath.length) {
      message.error('请选择商品分类')
      return
    }
    const payload = {
      category_id: categoryPath[categoryPath.length - 1],
      title: values.title,
      sub_title: values.sub_title || '',
      main_image: values.main_image || '',
      images: values.images || [],
      detail: values.detail || '',
      skus: (values.skus || []).map((s: any) => ({
        ...(s.id ? { id: s.id } : {}),
        spec_name: s.spec_name,
        price: s.price,
        stock: s.stock,
        sku_code: s.sku_code || '',
      })),
    }
    setSubmitting(true)
    try {
      if (isEdit) {
        await updateProduct(Number(id), payload)
        message.success('保存成功')
      } else {
        await createProduct(payload)
        message.success('创建成功')
      }
      navigate('/product')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card title={isEdit ? '编辑商品' : '新增商品'}>
      <Form form={form} layout="vertical" onFinish={onSubmit} style={{ maxWidth: 760 }}>
        <Form.Item label="商品分类" required>
          <Cascader
            options={options}
            value={categoryPath}
            onChange={(v) => setCategoryPath((v as number[]) || [])}
            placeholder="请选择分类（到二级）"
            changeOnSelect={false}
          />
        </Form.Item>
        <Form.Item name="title" label="商品标题" rules={[{ required: true, message: '请输入商品标题' }]}>
          <Input maxLength={100} />
        </Form.Item>
        <Form.Item name="sub_title" label="副标题">
          <Input maxLength={200} />
        </Form.Item>
        <Form.Item name="main_image" label="主图 URL" rules={[{ required: true, message: '请输入主图 URL' }]}>
          <Input placeholder="https://..." />
        </Form.Item>
        <Form.Item label="图片列表">
          <Form.List name="images">
            {(fields, { add, remove }) => (
              <>
                {fields.map((field) => (
                  <Space key={field.key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                    <Form.Item name={field.name} noStyle>
                      <Input placeholder="图片 URL" style={{ width: 480 }} />
                    </Form.Item>
                    <MinusCircleOutlined onClick={() => remove(field.name)} />
                  </Space>
                ))}
                <Button type="dashed" onClick={() => add('')} icon={<PlusOutlined />}>
                  添加图片
                </Button>
              </>
            )}
          </Form.List>
        </Form.Item>
        <Form.Item name="detail" label="商品详情">
          <Input.TextArea rows={5} />
        </Form.Item>
        <Form.Item label="SKU 列表" required>
          <Form.List
            name="skus"
            rules={[
              {
                validator: (_, value) =>
                  value && value.length > 0 ? Promise.resolve() : Promise.reject(new Error('请至少添加一个 SKU')),
              },
            ]}
          >
            {(fields, { add, remove }, { errors }) => (
              <>
                {fields.map((field) => (
                  <Space key={field.key} style={{ display: 'flex', marginBottom: 8 }} align="baseline" wrap>
                    <Form.Item name={[field.name, 'id']} hidden>
                      <Input />
                    </Form.Item>
                    <Form.Item
                      name={[field.name, 'spec_name']}
                      rules={[{ required: true, message: '规格名称' }]}
                      noStyle
                    >
                      <Input placeholder="规格名称" style={{ width: 180 }} />
                    </Form.Item>
                    <Form.Item
                      name={[field.name, 'price']}
                      rules={[{ required: true, message: '价格' }]}
                      noStyle
                    >
                      <InputNumber min={0} precision={2} placeholder="价格" style={{ width: 120 }} />
                    </Form.Item>
                    <Form.Item
                      name={[field.name, 'stock']}
                      rules={[{ required: true, message: '库存' }]}
                      noStyle
                    >
                      <InputNumber min={0} precision={0} placeholder="库存" style={{ width: 120 }} />
                    </Form.Item>
                    <Form.Item name={[field.name, 'sku_code']} noStyle>
                      <Input placeholder="SKU 编码" style={{ width: 140 }} />
                    </Form.Item>
                    <MinusCircleOutlined onClick={() => remove(field.name)} />
                  </Space>
                ))}
                <Button type="dashed" onClick={() => add({})} icon={<PlusOutlined />}>
                  添加 SKU
                </Button>
                <Form.ErrorList errors={errors} />
              </>
            )}
          </Form.List>
        </Form.Item>
        <Space>
          <Button type="primary" htmlType="submit" loading={submitting}>
            提交
          </Button>
          <Button onClick={() => navigate('/product')}>取消</Button>
        </Space>
      </Form>
    </Card>
  )
}
