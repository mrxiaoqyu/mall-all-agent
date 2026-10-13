export const orderStatusMap: Record<string, { color: string; text: string }> = {
  pending: { color: 'orange', text: '待付款' },
  paid: { color: 'blue', text: '待发货' },
  shipped: { color: 'geekblue', text: '已发货' },
  completed: { color: 'green', text: '已完成' },
  cancelled: { color: 'default', text: '已取消' },
  refunding: { color: 'red', text: '退款中' },
  refunded: { color: 'purple', text: '已退款' },
}

export const orderStatusOptions = Object.entries(orderStatusMap).map(([value, v]) => ({
  value,
  label: v.text,
}))
