import { useCallback, useEffect, useState } from 'react'
import { Button, Card, Col, Empty, Row, Tag, message } from 'antd'
import dayjs from 'dayjs'
import { couponApi, type Coupon, type UserCoupon } from '../api'

const STATUS_TEXT: Record<string, { text: string; color: string }> = {
  unused: { text: '未使用', color: 'green' },
  used: { text: '已使用', color: 'default' },
  expired: { text: '已过期', color: 'default' },
}

export default function Coupons() {
  const [available, setAvailable] = useState<Coupon[]>([])
  const [mine, setMine] = useState<UserCoupon[]>([])

  const load = useCallback(async () => {
    const [a, m] = await Promise.all([couponApi.list(), couponApi.mine()])
    setAvailable(a)
    setMine(m)
  }, [])

  useEffect(() => {
    load().catch(() => {})
  }, [load])

  const receive = async (coupon: Coupon) => {
    await couponApi.receive(coupon.id)
    message.success('领取成功')
    await load()
  }

  const myCouponIds = new Set(mine.map((m) => m.coupon_id))

  return (
    <div>
      <Card title="领券中心" style={{ marginBottom: 16 }}>
        {available.length === 0 ? (
          <Empty description="暂无可领取的优惠券" />
        ) : (
          <Row gutter={[16, 16]}>
            {available.map((c) => (
              <Col xs={24} sm={12} md={8} key={c.id}>
                <Card
                  type="inner"
                  style={{ background: '#fff7f0', border: '1px solid #ffd8b8' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: '#ff6a00', fontSize: 22, fontWeight: 700 }}>
                        ¥{c.minus_amount.toFixed(2)}
                      </div>
                      <div>{c.title}</div>
                      <div style={{ color: '#999', fontSize: 12 }}>
                        满 ¥{c.threshold_amount.toFixed(2)} 可用
                      </div>
                      <div style={{ color: '#999', fontSize: 12 }}>
                        {dayjs(c.end_at).format('YYYY-MM-DD')} 到期
                      </div>
                    </div>
                    <Button
                      type="primary"
                      disabled={myCouponIds.has(c.id)}
                      onClick={() => receive(c)}
                    >
                      {myCouponIds.has(c.id) ? '已领取' : '立即领取'}
                    </Button>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </Card>

      <Card title="我的优惠券">
        {mine.length === 0 ? (
          <Empty description="暂无优惠券" />
        ) : (
          <Row gutter={[16, 16]}>
            {mine.map((c) => {
              const s = STATUS_TEXT[c.status] || { text: c.status, color: 'default' }
              return (
                <Col xs={24} sm={12} md={8} key={c.id}>
                  <Card type="inner">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ color: '#ff6a00', fontSize: 22, fontWeight: 700 }}>
                          ¥{c.minus_amount.toFixed(2)}
                        </div>
                        <div>{c.title}</div>
                        <div style={{ color: '#999', fontSize: 12 }}>
                          满 ¥{c.threshold_amount.toFixed(2)} 可用
                        </div>
                        <div style={{ color: '#999', fontSize: 12 }}>
                          {dayjs(c.end_at).format('YYYY-MM-DD')} 到期
                        </div>
                      </div>
                      <Tag color={s.color}>{s.text}</Tag>
                    </div>
                  </Card>
                </Col>
              )
            })}
          </Row>
        )}
      </Card>
    </div>
  )
}
