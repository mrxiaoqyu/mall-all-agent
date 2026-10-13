import { useEffect, useMemo, useState } from 'react'
import { Button, Card, Divider, Empty, List, Modal, Radio, Space, Tag, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  addressApi,
  cartApi,
  couponApi,
  orderApi,
  type Address,
  type AddressPayload,
  type CreateOrderResult,
  type UserCoupon,
} from '../api'
import AddressForm from '../components/AddressForm'
import { useCartStore } from '../stores/cartStore'

interface CheckoutLine {
  product_id: number
  sku_id: number
  title: string
  spec_name: string
  price: number
  quantity: number
  image?: string | null
  shop_name?: string
}

interface CheckoutState {
  mode: 'cart' | 'buy_now'
  checkedIds?: number[]
  items?: { sku_id: number; quantity: number }[]
  lines: CheckoutLine[]
}

export default function Checkout() {
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as CheckoutState | null
  const refreshCartBadge = useCartStore((s) => s.refresh)

  const [addresses, setAddresses] = useState<Address[]>([])
  const [addressId, setAddressId] = useState<number | undefined>()
  const [coupons, setCoupons] = useState<UserCoupon[]>([])
  const [userCouponId, setUserCouponId] = useState<number | null>(null)
  const [addressModalOpen, setAddressModalOpen] = useState(false)
  const [editingAddress, setEditingAddress] = useState<Address | null>(null)
  const [payResult, setPayResult] = useState<CreateOrderResult | null>(null)
  const [paying, setPaying] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const lines = useMemo(() => state?.lines ?? [], [state])
  const goodsTotal = lines.reduce((sum, l) => sum + l.price * l.quantity, 0)

  const selectedCoupon = coupons.find((c) => c.id === userCouponId) || null
  const discount =
    selectedCoupon && goodsTotal >= selectedCoupon.threshold_amount
      ? selectedCoupon.minus_amount
      : 0
  const payAmount = Math.max(goodsTotal - discount, 0)

  const loadAddresses = async () => {
    const list = await addressApi.list()
    setAddresses(list)
    setAddressId((prev) => {
      if (prev && list.some((a) => a.id === prev)) return prev
      return list.find((a) => a.is_default)?.id ?? list[0]?.id
    })
  }

  useEffect(() => {
    if (!state || lines.length === 0) {
      navigate('/cart', { replace: true })
      return
    }
    loadAddresses().catch(() => {})
    couponApi
      .mine()
      .then((list) => setCoupons(list.filter((c) => c.status === 'unused')))
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submitAddress = async (values: AddressPayload) => {
    if (editingAddress) {
      await addressApi.update(editingAddress.id, values)
      message.success('地址已更新')
    } else {
      await addressApi.create(values)
      message.success('地址已添加')
    }
    setAddressModalOpen(false)
    setEditingAddress(null)
    await loadAddresses()
  }

  const submitOrder = async () => {
    if (!addressId) {
      message.warning('请选择收货地址')
      return
    }
    if (!state) return
    setSubmitting(true)
    try {
      let payload: { address_id: number; items: { sku_id: number; quantity: number }[]; use_cart: boolean; user_coupon_id: number | null }
      let partialCartIds: number[] = []
      if (state.mode === 'cart') {
        const groups = await cartApi.list()
        const allIds = groups.flatMap((g) => g.items.map((i) => i.id))
        const checkedIds = state.checkedIds ?? allIds
        const isAll = allIds.length > 0 && allIds.every((id) => checkedIds.includes(id))
        if (isAll) {
          payload = { address_id: addressId, items: [], use_cart: true, user_coupon_id: userCouponId }
        } else {
          payload = {
            address_id: addressId,
            items: lines.map((l) => ({ sku_id: l.sku_id, quantity: l.quantity })),
            use_cart: false,
            user_coupon_id: userCouponId,
          }
          partialCartIds = checkedIds
        }
      } else {
        payload = {
          address_id: addressId,
          items: state.items ?? lines.map((l) => ({ sku_id: l.sku_id, quantity: l.quantity })),
          use_cart: false,
          user_coupon_id: userCouponId,
        }
      }
      const result = await orderApi.create(payload)
      // 部分勾选结算时，下单成功后删除对应购物车条目
      for (const id of partialCartIds) {
        await cartApi.remove(id).catch(() => {})
      }
      refreshCartBadge()
      setPayResult(result)
    } finally {
      setSubmitting(false)
    }
  }

  const payNow = async () => {
    if (!payResult) return
    setPaying(true)
    try {
      await orderApi.payBatch(payResult.batch_no)
      message.success('支付成功')
      navigate('/orders')
    } finally {
      setPaying(false)
    }
  }

  if (!state || lines.length === 0) {
    return <Empty description="暂无待结算商品" />
  }

  return (
    <div>
      <Card
        title="收货地址"
        style={{ marginBottom: 16 }}
        extra={
          <Button
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingAddress(null)
              setAddressModalOpen(true)
            }}
          >
            新建地址
          </Button>
        }
      >
        {addresses.length === 0 ? (
          <Empty description="暂无收货地址，请先新建" />
        ) : (
          <Radio.Group
            value={addressId}
            onChange={(e) => setAddressId(e.target.value)}
            style={{ width: '100%' }}
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              {addresses.map((a) => (
                <div
                  key={a.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '8px 12px',
                    border: '1px solid #f0f0f0',
                    borderRadius: 8,
                  }}
                >
                  <Radio value={a.id}>
                    <b>{a.receiver}</b> {a.phone}　{a.province} {a.city} {a.district} {a.detail}
                    {a.is_default && <Tag color="orange" style={{ marginLeft: 8 }}>默认</Tag>}
                  </Radio>
                  <Button
                    type="link"
                    size="small"
                    style={{ marginLeft: 'auto' }}
                    onClick={() => {
                      setEditingAddress(a)
                      setAddressModalOpen(true)
                    }}
                  >
                    编辑
                  </Button>
                </div>
              ))}
            </Space>
          </Radio.Group>
        )}
      </Card>

      <Card title="商品清单" style={{ marginBottom: 16 }}>
        <List
          dataSource={lines}
          renderItem={(line) => (
            <List.Item>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, width: '100%' }}>
                {line.image && (
                  <img
                    src={line.image}
                    alt={line.title}
                    style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 4 }}
                  />
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500 }}>{line.title}</div>
                  <div style={{ color: '#999', fontSize: 12 }}>
                    {line.shop_name ? `${line.shop_name} · ` : ''}规格：{line.spec_name}
                  </div>
                </div>
                <div style={{ width: 100 }}>¥{line.price.toFixed(2)}</div>
                <div style={{ width: 60 }}>x{line.quantity}</div>
                <div style={{ width: 100, fontWeight: 600 }}>
                  ¥{(line.price * line.quantity).toFixed(2)}
                </div>
              </div>
            </List.Item>
          )}
        />
      </Card>

      <Card title="优惠券" style={{ marginBottom: 16 }}>
        {coupons.length === 0 ? (
          <span style={{ color: '#999' }}>暂无可用优惠券</span>
        ) : (
          <Radio.Group
            value={userCouponId ?? 0}
            onChange={(e) => setUserCouponId(e.target.value === 0 ? null : e.target.value)}
          >
            <Space direction="vertical">
              <Radio value={0}>不使用优惠券</Radio>
              {coupons.map((c) => {
                const usable = goodsTotal >= c.threshold_amount
                return (
                  <Radio key={c.id} value={c.id} disabled={!usable}>
                    {c.title}（满{c.threshold_amount.toFixed(2)}减{c.minus_amount.toFixed(2)}）
                    {!usable && <span style={{ color: '#f5222d' }}>（未达使用门槛）</span>}
                  </Radio>
                )
              })}
            </Space>
          </Radio.Group>
        )}
      </Card>

      <Card>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
          <div>商品总额：¥{goodsTotal.toFixed(2)}</div>
          <div>优惠抵扣：-¥{discount.toFixed(2)}</div>
          <Divider style={{ margin: '8px 0' }} />
          <div style={{ fontSize: 18 }}>
            应付：
            <span style={{ color: '#ff6a00', fontSize: 26, fontWeight: 700 }}>
              ¥{payAmount.toFixed(2)}
            </span>
          </div>
          <Button type="primary" size="large" loading={submitting} onClick={submitOrder}>
            提交订单
          </Button>
        </div>
      </Card>

      <AddressForm
        open={addressModalOpen}
        initial={editingAddress}
        onCancel={() => {
          setAddressModalOpen(false)
          setEditingAddress(null)
        }}
        onSubmit={submitAddress}
      />

      <Modal
        title="模拟支付"
        open={!!payResult}
        closable={false}
        maskClosable={false}
        footer={[
          <Button
            key="later"
            onClick={() => {
              setPayResult(null)
              navigate('/orders')
            }}
          >
            稍后支付
          </Button>,
          <Button key="pay" type="primary" loading={paying} onClick={payNow}>
            立即支付
          </Button>,
        ]}
      >
        {payResult && (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <p>下单成功，共 {payResult.order_ids.length} 笔订单</p>
            <p style={{ fontSize: 18 }}>
              应付金额：
              <span style={{ color: '#ff6a00', fontSize: 28, fontWeight: 700 }}>
                ¥{payResult.pay_amount.toFixed(2)}
              </span>
            </p>
          </div>
        )}
      </Modal>
    </div>
  )
}
