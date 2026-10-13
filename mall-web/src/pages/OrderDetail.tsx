import { useEffect, useState } from 'react'
import { Card, Descriptions, Divider, Empty, Space, Spin, Steps } from 'antd'
import { useParams } from 'react-router-dom'
import dayjs from 'dayjs'
import { orderApi, type Order } from '../api'
import { OrderStatusTag } from './Orders'

const FLOW = ['pending_pay', 'paid', 'shipped', 'completed']

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>()
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    orderApi
      .detail(id)
      .then(setOrder)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    )
  }
  if (!order) {
    return <Empty description="订单不存在" />
  }

  const currentStep = FLOW.indexOf(order.status)

  return (
    <Card
      title={
        <Space>
          订单详情
          <OrderStatusTag status={order.status} />
        </Space>
      }
    >
      {currentStep >= 0 ? (
        <Steps
          current={currentStep}
          style={{ marginBottom: 32 }}
          items={[
            { title: '待付款' },
            { title: '待发货' },
            { title: '待收货' },
            { title: '已完成' },
          ]}
        />
      ) : (
        <div style={{ marginBottom: 24 }}>
          <OrderStatusTag status={order.status} />
        </div>
      )}

      <Descriptions title="订单信息" bordered column={2} size="small">
        <Descriptions.Item label="订单号">{order.order_no}</Descriptions.Item>
        <Descriptions.Item label="批次号">{order.batch_no}</Descriptions.Item>
        <Descriptions.Item label="店铺">{order.shop_name}</Descriptions.Item>
        <Descriptions.Item label="下单时间">
          {order.created_at ? dayjs(order.created_at).format('YYYY-MM-DD HH:mm:ss') : '-'}
        </Descriptions.Item>
      </Descriptions>

      <Divider />

      <Descriptions title="收货信息" bordered column={1} size="small">
        <Descriptions.Item label="收货人">
          {order.address_snapshot.receiver}　{order.address_snapshot.phone}
        </Descriptions.Item>
        <Descriptions.Item label="收货地址">
          {order.address_snapshot.province} {order.address_snapshot.city}{' '}
          {order.address_snapshot.district} {order.address_snapshot.detail}
        </Descriptions.Item>
      </Descriptions>

      <Divider />

      <Card type="inner" title="商品清单">
        {order.items.map((item) => (
          <div
            key={item.id}
            style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '8px 0' }}
          >
            {item.image && (
              <img
                src={item.image}
                alt={item.title}
                style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 4 }}
              />
            )}
            <div style={{ flex: 1 }}>
              {item.title}
              <span style={{ color: '#999', fontSize: 12, marginLeft: 8 }}>{item.spec_name}</span>
            </div>
            <div>
              ¥{item.price.toFixed(2)} x{item.quantity}
            </div>
            <div style={{ fontWeight: 600 }}>¥{(item.price * item.quantity).toFixed(2)}</div>
          </div>
        ))}
        <Divider style={{ margin: '12px 0' }} />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <div>商品总额：¥{order.total_amount.toFixed(2)}</div>
          <div>优惠抵扣：-¥{order.discount_amount.toFixed(2)}</div>
          <div style={{ fontSize: 16 }}>
            实付：
            <b style={{ color: '#ff6a00', fontSize: 22 }}>¥{order.pay_amount.toFixed(2)}</b>
          </div>
        </div>
      </Card>
    </Card>
  )
}
