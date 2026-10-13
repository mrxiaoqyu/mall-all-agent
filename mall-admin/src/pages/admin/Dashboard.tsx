import { useEffect, useState } from 'react'
import { Card, Col, Row, Statistic } from 'antd'
import { getAdminDashboard } from '../../api'
import { TrendChart } from '../merchant/Dashboard'

export default function AdminDashboard() {
  const [data, setData] = useState<any>({})

  useEffect(() => {
    getAdminDashboard().then((res: any) => setData(res.data || {}))
  }, [])

  const cards = [
    { title: '销售额', value: data.total_sales ?? 0, prefix: '¥', precision: 2 },
    { title: '订单量', value: data.total_orders ?? 0 },
    { title: '用户数', value: data.total_users ?? 0 },
    { title: '店铺数', value: data.total_shops ?? 0 },
    { title: '商品数', value: data.total_products ?? 0 },
    { title: '待审核店铺', value: data.pending_shops ?? 0 },
    { title: '待退款订单', value: data.pending_refund_orders ?? 0 },
  ]

  return (
    <div>
      <Row gutter={16}>
        {cards.map((c) => (
          <Col span={8} key={c.title} style={{ marginBottom: 16 }}>
            <Card>
              <Statistic title={c.title} value={c.value} prefix={c.prefix} precision={c.precision} />
            </Card>
          </Col>
        ))}
      </Row>
      <Card title="近 7 日趋势">
        <TrendChart trend={data.trend || []} />
      </Card>
    </div>
  )
}
