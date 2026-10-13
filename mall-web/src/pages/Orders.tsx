import { useCallback, useEffect, useState } from 'react'
import { Button, Card, Empty, Modal, Pagination, Space, Tabs, Tag, message } from 'antd'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { orderApi, type Order } from '../api'

const STATUS_TEXT: Record<string, { text: string; color: string }> = {
  pending_pay: { text: '待付款', color: 'orange' },
  paid: { text: '待发货', color: 'blue' },
  shipped: { text: '待收货', color: 'geekblue' },
  completed: { text: '已完成', color: 'green' },
  refunding: { text: '退款中', color: 'red' },
  refunded: { text: '已退款', color: 'red' },
  cancelled: { text: '已取消', color: 'default' },
}

export function OrderStatusTag({ status }: { status: string }) {
  const s = STATUS_TEXT[status] || { text: status, color: 'default' }
  return <Tag color={s.color}>{s.text}</Tag>
}

export default function Orders() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('all')
  const [orders, setOrders] = useState<Order[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [payOrder, setPayOrder] = useState<Order | null>(null)
  const [paying, setPaying] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      if (tab === 'refund') {
        // 退款售后包含 refunding + refunded 两种状态
        const [a, b] = await Promise.all([
          orderApi.list({ status: 'refunding', page: 1, page_size: 50 }),
          orderApi.list({ status: 'refunded', page: 1, page_size: 50 }),
        ])
        const merged = [...a.list, ...b.list].sort((x, y) => y.id - x.id)
        setOrders(merged)
        setTotal(merged.length)
      } else {
        const res = await orderApi.list({
          status: tab === 'all' ? undefined : tab,
          page,
          page_size: 10,
        })
        setOrders(res.list)
        setTotal(res.total)
      }
    } catch {
      // 拦截器已提示
    } finally {
      setLoading(false)
    }
  }, [tab, page])

  useEffect(() => {
    load()
  }, [load])

  const doAction = async (action: () => Promise<unknown>, successMsg: string) => {
    await action()
    message.success(successMsg)
    await load()
  }

  const payNow = async () => {
    if (!payOrder) return
    setPaying(true)
    try {
      await orderApi.payBatch(payOrder.batch_no)
      message.success('支付成功')
      setPayOrder(null)
      await load()
    } finally {
      setPaying(false)
    }
  }

  return (
    <Card>
      <Tabs
        activeKey={tab}
        onChange={(key) => {
          setTab(key)
          setPage(1)
        }}
        items={[
          { key: 'all', label: '全部' },
          { key: 'pending_pay', label: '待付款' },
          { key: 'paid', label: '待发货' },
          { key: 'shipped', label: '待收货' },
          { key: 'completed', label: '已完成' },
          { key: 'refund', label: '退款售后' },
          { key: 'cancelled', label: '已取消' },
        ]}
      />
      {orders.length === 0 && !loading ? (
        <Empty description="暂无订单" />
      ) : (
        orders.map((order) => (
          <Card
            key={order.id}
            type="inner"
            loading={loading}
            style={{ marginBottom: 16, cursor: 'pointer' }}
            onClick={() => navigate(`/order/${order.id}`)}
            title={
              <Space>
                <b>{order.shop_name}</b>
                <span style={{ color: '#999', fontSize: 12 }}>订单号：{order.order_no}</span>
                <span style={{ color: '#999', fontSize: 12 }}>
                  {order.created_at ? dayjs(order.created_at).format('YYYY-MM-DD HH:mm') : ''}
                </span>
              </Space>
            }
            extra={<OrderStatusTag status={order.status} />}
          >
            {order.items.map((item) => (
              <div
                key={item.id}
                style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '6px 0' }}
              >
                {item.image && (
                  <img
                    src={item.image}
                    alt={item.title}
                    style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 4 }}
                  />
                )}
                <div style={{ flex: 1 }}>
                  {item.title}
                  <span style={{ color: '#999', fontSize: 12, marginLeft: 8 }}>{item.spec_name}</span>
                </div>
                <div>
                  ¥{item.price.toFixed(2)} x{item.quantity}
                </div>
              </div>
            ))}
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                gap: 16,
                marginTop: 8,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <span>
                实付：
                <b style={{ color: '#ff6a00' }}>¥{order.pay_amount.toFixed(2)}</b>
                {order.discount_amount > 0 && (
                  <span style={{ color: '#999', fontSize: 12, marginLeft: 8 }}>
                    （已优惠 ¥{order.discount_amount.toFixed(2)}）
                  </span>
                )}
              </span>
              <Space>
                {order.status === 'pending_pay' && (
                  <>
                    <Button type="primary" size="small" onClick={() => setPayOrder(order)}>
                      去支付
                    </Button>
                    <Button
                      size="small"
                      onClick={() => doAction(() => orderApi.cancel(order.id), '订单已取消')}
                    >
                      取消订单
                    </Button>
                  </>
                )}
                {order.status === 'paid' && (
                  <Button
                    size="small"
                    onClick={() => doAction(() => orderApi.refund(order.id), '退款申请已提交')}
                  >
                    申请退款
                  </Button>
                )}
                {order.status === 'shipped' && (
                  <Button
                    type="primary"
                    size="small"
                    onClick={() => doAction(() => orderApi.confirm(order.id), '已确认收货')}
                  >
                    确认收货
                  </Button>
                )}
              </Space>
            </div>
          </Card>
        ))
      )}
      {tab !== 'refund' && total > 10 && (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Pagination current={page} total={total} pageSize={10} onChange={setPage} showSizeChanger={false} />
        </div>
      )}

      <Modal
        title="模拟支付"
        open={!!payOrder}
        onCancel={() => setPayOrder(null)}
        footer={[
          <Button key="cancel" onClick={() => setPayOrder(null)}>
            取消
          </Button>,
          <Button key="pay" type="primary" loading={paying} onClick={payNow}>
            立即支付
          </Button>,
        ]}
      >
        {payOrder && (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <p>订单号：{payOrder.order_no}</p>
            <p style={{ fontSize: 18 }}>
              应付金额：
              <span style={{ color: '#ff6a00', fontSize: 28, fontWeight: 700 }}>
                ¥{payOrder.pay_amount.toFixed(2)}
              </span>
            </p>
          </div>
        )}
      </Modal>
    </Card>
  )
}
