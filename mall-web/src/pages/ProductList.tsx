import { useEffect, useMemo, useState } from 'react'
import { Card, Cascader, Col, Empty, Pagination, Row, Space, Input } from 'antd'
import { useSearchParams } from 'react-router-dom'
import { productApi, type Category, type ProductItem } from '../api'
import ProductCard from '../components/ProductCard'

interface CascaderOption {
  value: number
  label: string
  children?: CascaderOption[]
}

function toOptions(categories: Category[]): CascaderOption[] {
  return categories.map((c) => ({
    value: c.id,
    label: c.name,
    children: c.children.length > 0 ? toOptions(c.children) : undefined,
  }))
}

const SORTS = [
  { key: 'default', label: '综合' },
  { key: 'sales', label: '销量' },
  { key: 'price_asc', label: '价格升序' },
  { key: 'price_desc', label: '价格降序' },
]

export default function ProductList() {
  const [searchParams, setSearchParams] = useSearchParams()
  const keyword = searchParams.get('keyword') || ''
  const categoryId = searchParams.get('category_id')
    ? Number(searchParams.get('category_id'))
    : undefined
  const sort = searchParams.get('sort') || 'default'
  const page = searchParams.get('page') ? Number(searchParams.get('page')) : 1

  const [categories, setCategories] = useState<Category[]>([])
  const [data, setData] = useState<ProductItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  const options = useMemo(() => toOptions(categories), [categories])

  useEffect(() => {
    productApi.categories().then(setCategories).catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    productApi
      .list({ keyword: keyword || undefined, category_id: categoryId, sort, page, page_size: 12 })
      .then((res) => {
        setData(res.list)
        setTotal(res.total)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [keyword, categoryId, sort, page])

  const updateParams = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(searchParams)
    Object.entries(patch).forEach(([k, v]) => {
      if (v === undefined || v === '') {
        next.delete(k)
      } else {
        next.set(k, v)
      }
    })
    setSearchParams(next)
  }

  // 根据选中的分类 id 反推级联路径
  const cascaderValue = useMemo(() => {
    if (!categoryId) return undefined
    const find = (cats: Category[], id: number, path: number[]): number[] | null => {
      for (const c of cats) {
        const p = [...path, c.id]
        if (c.id === id) return p
        const r = find(c.children, id, p)
        if (r) return r
      }
      return null
    }
    return find(categories, categoryId, []) ?? undefined
  }, [categories, categoryId])

  return (
    <Card
      title="商品列表"
      extra={
        <Space wrap>
          <Cascader
            options={options}
            value={cascaderValue}
            placeholder="选择分类"
            allowClear
            changeOnSelect
            style={{ width: 220 }}
            onChange={(value) => {
              const id = value && value.length > 0 ? Number(value[value.length - 1]) : undefined
              updateParams({ category_id: id ? String(id) : undefined, page: undefined })
            }}
          />
          <Input.Search
            defaultValue={keyword}
            placeholder="搜索关键词"
            allowClear
            style={{ width: 220 }}
            onSearch={(v) => updateParams({ keyword: v || undefined, page: undefined })}
          />
        </Space>
      }
      loading={loading}
    >
      <Space style={{ marginBottom: 16 }} wrap>
        {SORTS.map((s) => (
          <a
            key={s.key}
            style={{ fontWeight: sort === s.key ? 600 : 400, color: sort === s.key ? '#ff6a00' : undefined }}
            onClick={() => updateParams({ sort: s.key === 'default' ? undefined : s.key, page: undefined })}
          >
            {s.label}
          </a>
        ))}
      </Space>
      {data.length === 0 ? (
        <Empty description="暂无商品" />
      ) : (
        <Row gutter={[16, 16]}>
          {data.map((p) => (
            <Col xs={12} sm={8} md={6} key={p.id}>
              <ProductCard product={p} />
            </Col>
          ))}
        </Row>
      )}
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24 }}>
        <Pagination
          current={page}
          total={total}
          pageSize={12}
          showSizeChanger={false}
          onChange={(p) => updateParams({ page: p > 1 ? String(p) : undefined })}
        />
      </div>
    </Card>
  )
}
