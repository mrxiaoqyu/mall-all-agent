import { useEffect, useMemo, useState } from 'react'
import { Button, Card, Col, Divider, Empty, InputNumber, Row, Space, Spin, Statistic, message } from 'antd'
import { ShopOutlined, CustomerServiceOutlined } from '@ant-design/icons'
import { useNavigate, useParams } from 'react-router-dom'
import { cartApi, csApi, productApi, type ProductDetailData, type Sku } from '../api'
import SkuSelector from '../components/SkuSelector'
import { useAuthStore } from '../stores/authStore'
import { useCartStore } from '../stores/cartStore'

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const token = useAuthStore((s) => s.token)
  const refreshCart = useCartStore((s) => s.refresh)

  const [product, setProduct] = useState<ProductDetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [sku, setSku] = useState<Sku | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [activeImage, setActiveImage] = useState<string>('')

  useEffect(() => {
    if (!id) return
    setLoading(true)
    productApi
      .detail(id)
      .then((res) => {
        setProduct(res)
        const imgs = res.images && res.images.length > 0 ? res.images : [res.main_image || '']
        setActiveImage(imgs.filter(Boolean)[0] || '')
        const firstAvailable = res.skus.find((s) => s.stock > 0) || res.skus[0] || null
        setSku(firstAvailable)
        setQuantity(1)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  const images = useMemo(() => {
    if (!product) return []
    const imgs = product.images && product.images.length > 0 ? product.images : []
    const all = product.main_image ? [product.main_image, ...imgs] : imgs
    return Array.from(new Set(all.filter(Boolean)))
  }, [product])

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    )
  }
  if (!product) {
    return <Empty description="商品不存在或已下架" />
  }

  const requireLogin = () => {
    if (!token) {
      message.warning('请先登录')
      navigate('/login', { state: { from: `/product/${product.id}` } })
      return false
    }
    return true
  }

  const addToCart = async () => {
    if (!requireLogin() || !sku) return
    await cartApi.add({ sku_id: sku.id, quantity })
    message.success('已加入购物车')
    refreshCart()
  }

  const buyNow = () => {
    if (!requireLogin() || !sku) return
    navigate('/checkout', {
      state: {
        mode: 'buy_now',
        items: [{ sku_id: sku.id, quantity }],
        lines: [
          {
            product_id: product.id,
            sku_id: sku.id,
            title: product.title,
            spec_name: sku.spec_name,
            price: sku.price,
            quantity,
            image: product.main_image,
            shop_name: product.shop_name,
          },
        ],
      },
    })
  }

  const contactCs = async () => {
    if (!requireLogin()) return
    const session = await csApi.createSession({ target_type: 'shop', shop_id: product.shop_id })
    navigate(`/cs?session=${session.id}`)
  }

  return (
    <Card>
      <Row gutter={32}>
        <Col xs={24} md={10}>
          {activeImage ? (
            <img
              src={activeImage}
              alt={product.title}
              style={{ width: '100%', height: 400, objectFit: 'cover', borderRadius: 8 }}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: 400,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#fafafa',
                borderRadius: 8,
                color: '#bbb',
              }}
            >
              暂无图片
            </div>
          )}
          {images.length > 1 && (
            <Space style={{ marginTop: 12 }} wrap>
              {images.map((img) => (
                <img
                  key={img}
                  src={img}
                  alt=""
                  onClick={() => setActiveImage(img)}
                  style={{
                    width: 64,
                    height: 64,
                    objectFit: 'cover',
                    borderRadius: 4,
                    cursor: 'pointer',
                    border: img === activeImage ? '2px solid #ff6a00' : '1px solid #eee',
                  }}
                />
              ))}
            </Space>
          )}
        </Col>
        <Col xs={24} md={14}>
          <h2 style={{ marginBottom: 4 }}>{product.title}</h2>
          {product.sub_title && <div style={{ color: '#999', marginBottom: 12 }}>{product.sub_title}</div>}
          <div style={{ background: '#fff7f0', padding: 16, borderRadius: 8, marginBottom: 16 }}>
            <span style={{ color: '#ff6a00', fontSize: 28, fontWeight: 700 }}>
              ¥{(sku ? sku.price : product.price).toFixed(2)}
            </span>
          </div>
          <Space size="large" style={{ marginBottom: 16 }}>
            <Statistic title="销量" value={product.sales} valueStyle={{ fontSize: 16 }} />
            <Statistic title="库存" value={sku ? sku.stock : 0} valueStyle={{ fontSize: 16 }} />
          </Space>
          <Divider style={{ margin: '12px 0' }} />
          <div style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 8, color: '#666' }}>选择规格</div>
            <SkuSelector skus={product.skus} value={sku?.id} onChange={setSku} />
          </div>
          <div style={{ marginBottom: 24 }}>
            <span style={{ marginRight: 12, color: '#666' }}>数量</span>
            <InputNumber
              min={1}
              max={sku ? Math.max(sku.stock, 1) : 1}
              value={quantity}
              onChange={(v) => setQuantity(v || 1)}
            />
          </div>
          <Space wrap>
            <Button size="large" onClick={addToCart} disabled={!sku || sku.stock <= 0}>
              加入购物车
            </Button>
            <Button type="primary" size="large" onClick={buyNow} disabled={!sku || sku.stock <= 0}>
              立即购买
            </Button>
            <Button icon={<ShopOutlined />} size="large" onClick={() => navigate(`/shop/${product.shop_id}`)}>
              进店逛逛
            </Button>
            <Button icon={<CustomerServiceOutlined />} size="large" onClick={contactCs}>
              联系客服
            </Button>
          </Space>
        </Col>
      </Row>
      {product.detail && (
        <>
          <Divider>商品详情</Divider>
          <div style={{ whiteSpace: 'pre-wrap', color: '#333' }}>{product.detail}</div>
        </>
      )}
    </Card>
  )
}
