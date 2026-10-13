import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Card, Checkbox, Empty, InputNumber, Popconfirm, Space, message } from 'antd'
import { DeleteOutlined, ShopOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { cartApi, type CartGroup, type CartLine } from '../api'
import { useCartStore } from '../stores/cartStore'

export default function Cart() {
  const navigate = useNavigate()
  const refreshBadge = useCartStore((s) => s.refresh)
  const [groups, setGroups] = useState<CartGroup[]>([])
  const [checked, setChecked] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await cartApi.list()
      setGroups(data)
      setChecked(new Set(data.flatMap((g) => g.items.map((i) => i.id))))
      refreshBadge()
    } catch {
      // 拦截器已提示
    } finally {
      setLoading(false)
    }
  }, [refreshBadge])

  useEffect(() => {
    load()
  }, [load])

  const allLines = useMemo(() => groups.flatMap((g) => g.items), [groups])
  const checkedLines = useMemo(
    () => allLines.filter((i) => checked.has(i.id)),
    [allLines, checked],
  )
  const totalAmount = checkedLines.reduce((sum, i) => sum + i.price * i.quantity, 0)

  const toggleItem = (id: number, value: boolean) => {
    setChecked((prev) => {
      const next = new Set(prev)
      if (value) {
        next.add(id)
      } else {
        next.delete(id)
      }
      return next
    })
  }

  const toggleGroup = (group: CartGroup, value: boolean) => {
    setChecked((prev) => {
      const next = new Set(prev)
      group.items.forEach((i) => {
        if (value) {
          next.add(i.id)
        } else {
          next.delete(i.id)
        }
      })
      return next
    })
  }

  const updateQuantity = async (item: CartLine, quantity: number) => {
    await cartApi.update(item.id, quantity)
    await load()
  }

  const removeItem = async (item: CartLine) => {
    await cartApi.remove(item.id)
    message.success('已删除')
    await load()
  }

  const goCheckout = () => {
    if (checkedLines.length === 0) {
      message.warning('请先勾选要结算的商品')
      return
    }
    navigate('/checkout', {
      state: {
        mode: 'cart',
        checkedIds: Array.from(checked),
        lines: checkedLines.map((i) => ({
          product_id: i.product_id,
          sku_id: i.sku_id,
          title: i.title,
          spec_name: i.spec_name,
          price: i.price,
          quantity: i.quantity,
          image: i.main_image,
          shop_name: i.shop_name,
        })),
      },
    })
  }

  if (!loading && allLines.length === 0) {
    return (
      <Card>
        <Empty description="购物车是空的">
          <Button type="primary" onClick={() => navigate('/products')}>
            去逛逛
          </Button>
        </Empty>
      </Card>
    )
  }

  return (
    <div>
      {groups.map((group) => {
        const groupChecked = group.items.every((i) => checked.has(i.id))
        return (
          <Card
            key={group.shop_id}
            loading={loading}
            title={
              <Space>
                <Checkbox
                  checked={groupChecked}
                  onChange={(e) => toggleGroup(group, e.target.checked)}
                />
                <ShopOutlined />
                <a onClick={() => navigate(`/shop/${group.shop_id}`)}>{group.shop_name}</a>
              </Space>
            }
            style={{ marginBottom: 16 }}
          >
            {group.items.map((item) => (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  padding: '12px 0',
                  borderBottom: '1px solid #f5f5f5',
                  flexWrap: 'wrap',
                }}
              >
                <Checkbox
                  checked={checked.has(item.id)}
                  onChange={(e) => toggleItem(item.id, e.target.checked)}
                />
                {item.main_image && (
                  <img
                    src={item.main_image}
                    alt={item.title}
                    style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 4, cursor: 'pointer' }}
                    onClick={() => navigate(`/product/${item.product_id}`)}
                  />
                )}
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontWeight: 500 }}>{item.title}</div>
                  <div style={{ color: '#999', fontSize: 12 }}>
                    规格：{item.spec_name}
                    {item.product_status !== 'on' && <span style={{ color: '#f5222d' }}>（已下架）</span>}
                  </div>
                </div>
                <div style={{ color: '#ff6a00', fontWeight: 600, width: 100 }}>
                  ¥{item.price.toFixed(2)}
                </div>
                <InputNumber
                  min={1}
                  max={Math.max(item.stock, 1)}
                  value={item.quantity}
                  onChange={(v) => {
                    if (v && v !== item.quantity) {
                      updateQuantity(item, v)
                    }
                  }}
                />
                <div style={{ width: 100, fontWeight: 600 }}>
                  ¥{(item.price * item.quantity).toFixed(2)}
                </div>
                <Popconfirm title="确定删除该商品？" onConfirm={() => removeItem(item)}>
                  <Button type="text" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </div>
            ))}
          </Card>
        )
      })}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 24 }}>
          <span>
            已选 <b>{checkedLines.length}</b> 件
          </span>
          <span>
            合计：
            <span style={{ color: '#ff6a00', fontSize: 22, fontWeight: 700 }}>
              ¥{totalAmount.toFixed(2)}
            </span>
          </span>
          <Button type="primary" size="large" onClick={goCheckout}>
            去结算
          </Button>
        </div>
      </Card>
    </div>
  )
}
