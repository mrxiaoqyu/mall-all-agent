import { useEffect, useState } from 'react'
import { Avatar, Button, Card, Col, Empty, Row, Spin, Statistic, message } from 'antd'
import { CustomerServiceOutlined } from '@ant-design/icons'
import { useNavigate, useParams } from 'react-router-dom'
import { csApi, productApi, shopApi, type ProductItem, type ShopDetailData } from '../api'
import ProductCard from '../components/ProductCard'
import { useAuthStore } from '../stores/authStore'

export default function Shop() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const token = useAuthStore((s) => s.token)
  const [shop, setShop] = useState<ShopDetailData | null>(null)
  const [products, setProducts] = useState<ProductItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    Promise.all([
      shopApi.detail(id),
      productApi.list({ shop_id: Number(id), page: 1, page_size: 60 }),
    ])
      .then(([shopRes, prodRes]) => {
        setShop(shopRes)
        setProducts(prodRes.list)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  const contactCs = async () => {
    if (!token) {
      message.warning('请先登录')
      navigate('/login')
      return
    }
    if (!id) return
    const session = await csApi.createSession({ target_type: 'shop', shop_id: Number(id) })
    navigate(`/cs?session=${session.id}`)
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    )
  }
  if (!shop) {
    return <Empty description="店铺不存在" />
  }

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <Avatar src={shop.logo} size={72}>
            {shop.name.slice(0, 1)}
          </Avatar>
          <div style={{ flex: 1, minWidth: 200 }}>
            <h2 style={{ marginBottom: 4 }}>{shop.name}</h2>
            <div style={{ color: '#999' }}>{shop.description || '暂无简介'}</div>
          </div>
          <Statistic title="在售商品" value={shop.product_count} />
          <Button type="primary" icon={<CustomerServiceOutlined />} onClick={contactCs}>
            联系客服
          </Button>
        </div>
      </Card>
      <Card title="店内商品">
        {products.length === 0 ? (
          <Empty description="暂无商品" />
        ) : (
          <Row gutter={[16, 16]}>
            {products.map((p) => (
              <Col xs={12} sm={8} md={6} key={p.id}>
                <ProductCard product={p} />
              </Col>
            ))}
          </Row>
        )}
      </Card>
    </div>
  )
}
