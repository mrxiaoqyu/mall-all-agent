import { Button, Space, Tag } from 'antd'
import type { Sku } from '../api'

interface Props {
  skus: Sku[]
  value?: number
  onChange: (sku: Sku) => void
}

export default function SkuSelector({ skus, value, onChange }: Props) {
  return (
    <Space wrap>
      {skus.map((sku) => {
        const disabled = sku.stock <= 0
        return (
          <Button
            key={sku.id}
            type={value === sku.id ? 'primary' : 'default'}
            disabled={disabled}
            onClick={() => onChange(sku)}
          >
            {sku.spec_name}
            <span style={{ marginLeft: 6, fontSize: 12 }}>¥{sku.price.toFixed(2)}</span>
            {disabled ? (
              <Tag style={{ marginLeft: 6 }} color="default">
                无货
              </Tag>
            ) : (
              <span style={{ marginLeft: 6, fontSize: 12, opacity: 0.7 }}>
                库存{sku.stock}
              </span>
            )}
          </Button>
        )
      })}
    </Space>
  )
}
