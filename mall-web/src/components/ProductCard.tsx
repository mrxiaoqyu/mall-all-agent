import { Card } from 'antd'
import { useNavigate } from 'react-router-dom'
import type { ProductItem } from '../api'

export default function ProductCard({ product }: { product: ProductItem }) {
  const navigate = useNavigate()
  return (
    <Card
      hoverable
      cover={
        product.main_image ? (
          <img
            src={product.main_image}
            alt={product.title}
            style={{ height: 200, objectFit: 'cover' }}
          />
        ) : (
          <div
            style={{
              height: 200,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#fafafa',
              color: '#bbb',
            }}
          >
            暂无图片
          </div>
        )
      }
      onClick={() => navigate(`/product/${product.id}`)}
    >
      <Card.Meta
        title={
          <div
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={product.title}
          >
            {product.title}
          </div>
        }
        description={
          <div>
            <div style={{ marginBottom: 4 }}>
              <span style={{ color: '#ff6a00', fontSize: 18, fontWeight: 600 }}>
                ¥{product.price.toFixed(2)}
              </span>
              <span style={{ color: '#999', fontSize: 12, marginLeft: 8 }}>
                已售 {product.sales}
              </span>
            </div>
            <div style={{ color: '#999', fontSize: 12 }}>{product.shop_name || ''}</div>
          </div>
        }
      />
    </Card>
  )
}
