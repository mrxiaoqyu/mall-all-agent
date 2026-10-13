import { useEffect, useState } from 'react'
import { Card, Col, Row, Statistic } from 'antd'
import { getMerchantDashboard } from '../../api'

interface TrendItem {
  date: string
  sales: number
  orders: number
}

export function TrendChart({ trend }: { trend: TrendItem[] }) {
  const maxSales = Math.max(...trend.map((t) => Number(t.sales) || 0), 1)
  const maxOrders = Math.max(...trend.map((t) => Number(t.orders) || 0), 1)
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 24, height: 200, padding: '0 8px' }}>
        {trend.map((t) => (
          <div key={t.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 160 }}>
              <div
                title={`销售额 ¥${t.sales}`}
                style={{
                  width: 18,
                  height: `${Math.max(((Number(t.sales) || 0) / maxSales) * 100, 2)}%`,
                  background: '#1677ff',
                  borderRadius: '4px 4px 0 0',
                }}
              />
              <div
                title={`订单 ${t.orders}`}
                style={{
                  width: 18,
                  height: `${Math.max(((Number(t.orders) || 0) / maxOrders) * 100, 2)}%`,
                  background: '#69b1ff',
                  borderRadius: '4px 4px 0 0',
                }}
              />
            </div>
            <span style={{ fontSize: 12, color: '#888' }}>{String(t.date).slice(5)}</span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 24, justifyContent: 'center', marginTop: 12, fontSize: 13 }}>
        <span>
          <span style={{ display: 'inline-block', width: 10, height: 10, background: '#1677ff', borderRadius: 2, marginRight: 6 }} />
          销售额
        </span>
        <span>
          <span style={{ display: 'inline-block', width: 10, height: 10, background: '#69b1ff', borderRadius: 2, marginRight: 6 }} />
          订单量
        </span>
      </div>
    </div>
  )
}

export default function MerchantDashboard() {
  const [data, setData] = useState<any>({})

  useEffect(() => {
    getMerchantDashboard().then((res: any) => setData(res.data || {}))
  }, [])

  return (
    <div>
      <Row gutter={16}>
        <Col span={8} style={{ marginBottom: 16 }}>
          <Card><Statistic title="销售额" value={data.total_sales ?? 0} prefix="¥" precision={2} /></Card>
        </Col>
        <Col span={8} style={{ marginBottom: 16 }}>
          <Card><Statistic title="订单量" value={data.total_orders ?? 0} /></Card>
        </Col>
        <Col span={8} style={{ marginBottom: 16 }}>
          <Card><Statistic title="商品数" value={data.total_products ?? 0} /></Card>
        </Col>
        <Col span={8} style={{ marginBottom: 16 }}>
          <Card><Statistic title="待发货" value={data.pending_ship_orders ?? 0} /></Card>
        </Col>
        <Col span={8} style={{ marginBottom: 16 }}>
          <Card><Statistic title="待退款" value={data.pending_refund_orders ?? 0} /></Card>
        </Col>
      </Row>
      <Card title="近 7 日趋势">
        <TrendChart trend={data.trend || []} />
      </Card>
    </div>
  )
}
