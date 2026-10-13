import { useEffect, useState } from 'react'
import { Avatar, Card, Carousel, Col, Row, Tag, Typography } from 'antd'
import { useNavigate } from 'react-router-dom'
import { bannerApi, productApi, shopApi, type Banner, type Category, type ProductItem, type ShopBrief } from '../api'
import ProductCard from '../components/ProductCard'

export default function Home() {
  const navigate = useNavigate()
  const [banners, setBanners] = useState<Banner[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [shops, setShops] = useState<ShopBrief[]>([])
  const [hotProducts, setHotProducts] = useState<ProductItem[]>([])

  useEffect(() => {
    bannerApi.list().then(setBanners).catch(() => {})
    productApi.categories().then(setCategories).catch(() => {})
    shopApi.recommend().then(setShops).catch(() => {})
    productApi.list({ sort: 'sales', page: 1, page_size: 8 }).then((res) => setHotProducts(res.list)).catch(() => {})
  }, [])

  return (
    <div>
      {banners.length > 0 && (
        <Carousel autoplay style={{ borderRadius: 8, overflow: 'hidden', marginBottom: 24 }}>
          {banners.map((b) => (
            <div key={b.id}>
              <div
                style={{ cursor: b.link_url ? 'pointer' : 'default' }}
                onClick={() => {
                  if (b.link_url) {
                    if (/^https?:\/\//.test(b.link_url)) {
                      window.open(b.link_url, '_blank')
                    } else {
                      navigate(b.link_url)
                    }
                  }
                }}
              >
                <img
                  src={b.image}
                  alt={b.title}
                  style={{ width: '100%', height: 320, objectFit: 'cover', display: 'block' }}
                />
              </div>
            </div>
          ))}
        </Carousel>
      )}

      <Card title="商品分类" style={{ marginBottom: 24 }}>
        <Row gutter={[12, 12]}>
          {categories.map((c) => (
            <Col key={c.id}>
              <Tag
                color="orange"
                style={{ cursor: 'pointer', padding: '6px 16px', fontSize: 14 }}
                onClick={() => navigate(`/products?category_id=${c.id}`)}
              >
                {c.name}
              </Tag>
            </Col>
          ))}
        </Row>
      </Card>

      {shops.length > 0 && (
        <Card title="推荐店铺" style={{ marginBottom: 24 }}>
          <Row gutter={[16, 16]}>
            {shops.map((s) => (
              <Col xs={12} sm={8} md={6} key={s.id}>
                <Card hoverable onClick={() => navigate(`/shop/${s.id}`)}>
                  <Card.Meta
                    avatar={<Avatar src={s.logo} size={48}>{s.name.slice(0, 1)}</Avatar>}
                    title={s.name}
                    description={
                      <Typography.Text
                        type="secondary"
                        style={{ fontSize: 12 }}
                        ellipsis={{ tooltip: s.description }}
                      >
                        {s.description || '暂无简介'}
                      </Typography.Text>
                    }
                  />
                </Card>
              </Col>
            ))}
          </Row>
        </Card>
      )}

      <Card title="热销商品">
        <Row gutter={[16, 16]}>
          {hotProducts.map((p) => (
            <Col xs={12} sm={8} md={6} key={p.id}>
              <ProductCard product={p} />
            </Col>
          ))}
        </Row>
      </Card>
    </div>
  )
}
