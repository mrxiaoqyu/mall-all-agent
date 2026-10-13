import { useCallback, useEffect, useRef, useState } from 'react'
import { Avatar, Badge, Button, Card, Col, Empty, Input, List, Row, Tag, message } from 'antd'
import { RobotOutlined, SendOutlined } from '@ant-design/icons'
import { useNavigate, useSearchParams } from 'react-router-dom'
import dayjs from 'dayjs'
import {
  aiApi,
  csApi,
  type ConfirmPayload,
  type CsMessage,
  type CsSession,
  type ProductCardItem,
} from '../api'
import { csSend, registerCsHandler, registerHandlerChangedHandler } from '../ws/useCsSocket'
import { useAuthStore } from '../stores/authStore'
import { useCsStore } from '../stores/csStore'

// ── UI 消息模型 ──

type UiItem =
  | { key: string; kind: 'text'; mine: boolean; text: string; time?: string | null }
  | { key: string; kind: 'system'; text: string; time?: string | null }
  | { key: string; kind: 'products'; items: ProductCardItem[]; time?: string | null }
  | { key: string; kind: 'confirm'; payload: ConfirmPayload; decided: 'confirm' | 'cancel' | null; time?: string | null }
  | { key: string; kind: 'result'; ok: boolean; text: string; time?: string | null }

function msgToItem(m: CsMessage): UiItem | null {
  const time = m.created_at
  if (m.msg_type === 'system') return { key: `m${m.id}`, kind: 'system', text: m.content, time }
  if (m.msg_type === 'product_card' && m.extra?.items)
    return { key: `m${m.id}`, kind: 'products', items: m.extra.items as ProductCardItem[], time }
  if (m.msg_type === 'confirm_card' && m.extra)
    return { key: `m${m.id}`, kind: 'confirm', payload: m.extra as unknown as ConfirmPayload, decided: 'confirm', time }
  if (m.msg_type === 'result_card' && m.extra)
    return { key: `m${m.id}`, kind: 'result', ok: !!m.extra.ok, text: m.content, time }
  if (m.sender_role === 'agent')
    return { key: `m${m.id}`, kind: 'text', mine: false, text: m.content, time }
  if (m.msg_type !== 'text') return null
  return { key: `m${m.id}`, kind: 'text', mine: m.sender_role === 'user', text: m.content, time }
}

const productsSig = (items: ProductCardItem[]) => `p:${items.map((i) => i.product_id).join(',')}`
const confirmSig = (p: ConfirmPayload) => `c:${p.action}:${p.draft.total ?? p.draft.order_no ?? ''}`

export default function CustomerService() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { token } = useAuthStore()
  const refreshUnread = useCsStore((s) => s.refresh)

  const [sessions, setSessions] = useState<CsSession[]>([])
  const [activeId, setActiveId] = useState<number | null>(null)
  const [items, setItems] = useState<UiItem[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [streamText, setStreamText] = useState('')

  const activeIdRef = useRef<number | null>(null)
  activeIdRef.current = activeId
  const streamingRef = useRef(false)
  streamingRef.current = streaming
  const bottomRef = useRef<HTMLDivElement>(null)

  const loadSessions = useCallback(async () => {
    const list = await csApi.sessions()
    const sorted = [...list].sort((a, b) => {
      if (a.target_type === 'platform' && b.target_type !== 'platform') return -1
      if (b.target_type === 'platform' && a.target_type !== 'platform') return 1
      return (b.last_message_at || '').localeCompare(a.last_message_at || '')
    })
    setSessions(sorted)
    return sorted
  }, [])

  const markRead = useCallback(
    async (sessionId: number) => {
      await csApi.read(sessionId).catch(() => {})
      refreshUnread()
      setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, unread_count: 0 } : s)))
    },
    [refreshUnread],
  )

  // ── AI 流式处理 ──

  /** 追加去重（卡片/结果在断线重放或历史命中时可能重复） */
  const appendUnique = useCallback((item: UiItem, sig: string) => {
    setItems((prev) => {
      const dup = prev.some((it) => {
        if (it.kind !== item.kind) return false
        if (it.kind === 'products' && item.kind === 'products') return productsSig(it.items) === sig
        if (it.kind === 'result' && item.kind === 'result') return it.ok === item.ok && it.text === item.text
        return false
      })
      return dup ? prev : [...prev, item]
    })
  }, [])

  const upsertConfirm = useCallback((payload: ConfirmPayload, seq?: number) => {
    const sig = confirmSig(payload)
    setItems((prev) => {
      const idx = prev.findIndex((it) => it.kind === 'confirm' && confirmSig(it.payload) === sig)
      if (idx >= 0) {
        // 已存在（历史/重放）→ 重新打开按钮
        return prev.map((it, i) => (i === idx && it.kind === 'confirm' ? { ...it, decided: null } : it))
      }
      return [...prev, { key: `live-c-${seq ?? Date.now()}`, kind: 'confirm', payload, decided: null }]
    })
  }, [])

  const finalizeStream = useCallback((finalText?: string | null) => {
    setStreamText((prev) => {
      const text = (finalText ?? prev).trim()
      if (text) {
        setItems((old) => [...old, { key: `live-t-${Date.now()}`, kind: 'text', mine: false, text }])
      }
      return ''
    })
  }, [])

  /** 发起/恢复一轮 AI 流（content 为空 + lastSeq 为断线重连；confirmDecision 为卡片决策） */
  const runStream = useCallback(
    async (sessionId: number, content: string, confirmDecision?: 'confirm' | 'cancel') => {
      if (streamingRef.current) return
      setStreaming(true)
      setStreamText('')
      let lastSeq = 0
      let finished = false

      const onEvent = (event: string, data: Record<string, any>) => {
        if (activeIdRef.current !== sessionId) return
        if (typeof data.seq === 'number') lastSeq = data.seq
        switch (event) {
          case 'chunk':
          case 'message':
            setStreamText((prev) => prev + (data.text || ''))
            break
          case 'card':
            if (Array.isArray(data.items)) {
              appendUnique(
                { key: `live-p-${data.seq}`, kind: 'products', items: data.items },
                productsSig(data.items),
              )
            }
            break
          case 'result':
            appendUnique(
              { key: `live-r-${data.seq}`, kind: 'result', ok: !!data.ok, text: data.message || '' },
              ''
            )
            break
          case 'confirm_card':
            upsertConfirm(data as unknown as ConfirmPayload, data.seq)
            break
          case 'transferred':
            setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, handler: 'human' } : s)))
            break
          case 'done':
            finished = true
            finalizeStream(data.final_text)
            break
          case 'error':
            message.error(data.message || '智能客服异常')
            finished = true
            break
        }
      }

      // SSE 断线重连：最多 3 次指数退避，按 last_seq 续传
      for (let attempt = 0; attempt <= 3 && !finished; attempt++) {
        if (attempt > 0) await new Promise((r) => setTimeout(r, 1000 * attempt))
        try {
          if (confirmDecision && attempt === 0) {
            await aiApi.confirmStream(sessionId, confirmDecision, onEvent)
          } else {
            await aiApi.chatStream(sessionId, attempt === 0 ? content : '', attempt === 0 ? 0 : lastSeq, onEvent)
          }
          break
        } catch (e) {
          if (attempt === 3) {
            message.error('连接中断，请刷新页面查看回复')
            finalizeStream()
          }
        }
      }
      setStreaming(false)
    },
    [appendUnique, finalizeStream, upsertConfirm],
  )

  // ── 会话打开 ──

  const openSession = useCallback(
    async (sessionId: number) => {
      setActiveId(sessionId)
      setStreamText('')
      const res = await csApi.messages(sessionId, { page: 1, page_size: 100 })
      const list = res.list.map(msgToItem).filter(Boolean) as UiItem[]
      setItems(list)
      await markRead(sessionId)
      const session = await csApi.sessions().then((ss) => ss.find((s) => s.id === sessionId))
      if (session?.handler !== 'agent') return
      // 断线上线后会话恢复：进行中的流继续渲染；待确认卡片恢复按钮
      try {
        const state = await aiApi.threadState(sessionId)
        if (state.running) {
          runStream(sessionId, '') // last_seq=0 全量重放（卡片按签名去重）
        } else if (state.interrupted && state.pending_confirm) {
          upsertConfirm(state.pending_confirm)
        }
      } catch {
        // 忽略状态查询失败
      }
    },
    [markRead, runStream, upsertConfirm],
  )

  // 初始化：加载会话列表并处理 ?session= 定位
  useEffect(() => {
    if (!token) return
    loadSessions()
      .then(async (sorted) => {
        const querySession = Number(searchParams.get('session'))
        if (querySession) {
          await openSession(querySession)
        } else if (sorted.length > 0) {
          await openSession(sorted[0].id)
        }
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  // WS 消息：人工消息与回显；agent 消息由 SSE 渲染（已落库，刷新可见），避免重复
  useEffect(() => {
    const unregister = registerCsHandler((msg) => {
      if (msg.session_id === activeIdRef.current) {
        if (msg.sender_role !== 'agent') {
          const item = msgToItem(msg)
          if (item) {
            setItems((prev) => (prev.some((m) => m.key === item.key) ? prev : [...prev, item]))
          }
        }
        if (msg.sender_role !== 'user') {
          markRead(msg.session_id)
        }
      }
      loadSessions().catch(() => {})
    })
    return unregister
  }, [loadSessions, markRead])

  // 会话模式变更（工作台接管/转回、兜底转人工）
  useEffect(() => {
    const unregister = registerHandlerChangedHandler(({ session_id, handler }) => {
      setSessions((prev) => prev.map((s) => (s.id === session_id ? { ...s, handler: handler as CsSession['handler'] } : s)))
    })
    return unregister
  }, [])

  // 新消息滚动到底部
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [items, streamText])

  // ── 发送 ──

  const activeSession = sessions.find((s) => s.id === activeId)
  const isAgent = activeSession?.handler === 'agent'

  const send = () => {
    const content = input.trim()
    if (!content) return
    if (!activeId) {
      message.warning('请先选择会话')
      return
    }
    if (isAgent) {
      setInput('')
      runStream(activeId, content)
      return
    }
    if (!csSend(activeId, content)) {
      message.warning('连接已断开，请稍后重试')
      return
    }
    setInput('')
  }

  const decide = (item: Extract<UiItem, { kind: 'confirm' }>, decision: 'confirm' | 'cancel') => {
    if (!activeId || streaming) return
    setItems((prev) => prev.map((it) => (it.key === item.key && it.kind === 'confirm' ? { ...it, decided: decision } : it)))
    runStream(activeId, '', decision)
  }

  const transfer = async () => {
    if (!activeId) return
    try {
      await aiApi.transfer(activeId)
      setSessions((prev) => prev.map((s) => (s.id === activeId ? { ...s, handler: 'human' } : s)))
    } catch {
      // 拦截器已提示
    }
  }

  // ── 渲染 ──

  const renderItem = (item: UiItem) => {
    if (item.kind === 'system') {
      return (
        <div key={item.key} style={{ textAlign: 'center', margin: '8px 0' }}>
          <span style={{ fontSize: 12, color: '#999', background: '#f0f0f0', borderRadius: 4, padding: '2px 10px' }}>
            {item.text}
          </span>
        </div>
      )
    }
    if (item.kind === 'products') {
      return (
        <div key={item.key} style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 12 }}>
          <div style={{ maxWidth: '85%' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {item.items.map((p) => (
                <Card
                  key={p.product_id}
                  size="small"
                  hoverable
                  style={{ width: 200 }}
                  onClick={() => navigate(`/product/${p.product_id}`)}
                >
                  {p.image && (
                    <img src={p.image} alt={p.title} style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 4 }} />
                  )}
                  <div style={{ marginTop: 6, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.title}>
                    {p.title}
                  </div>
                  <div style={{ color: '#ff6a00', fontWeight: 600 }}>¥{p.price.toFixed(2)}</div>
                  <div style={{ fontSize: 12, color: '#999' }}>
                    {p.shop_name} {typeof p.sales === 'number' ? `· 已售${p.sales}` : ''}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>
      )
    }
    if (item.kind === 'confirm') {
      const { action, draft } = item.payload
      return (
        <div key={item.key} style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 12 }}>
          <Card size="small" style={{ maxWidth: '85%', borderColor: '#ffd591' }} title={action === 'buy' ? '请确认购买信息' : '请确认售后申请'}>
            {action === 'buy' ? (
              <div style={{ fontSize: 13 }}>
                <div>{draft.title}（{draft.spec_name}）</div>
                <div style={{ margin: '4px 0' }}>
                  ¥{draft.price?.toFixed(2)} × {draft.quantity} = <b style={{ color: '#ff6a00' }}>¥{draft.total?.toFixed(2)}</b>
                </div>
                <div style={{ color: '#999', fontSize: 12 }}>收货地址：{draft.address_text}</div>
              </div>
            ) : (
              <div style={{ fontSize: 13 }}>
                <div>订单号：{draft.order_no}</div>
                <div style={{ margin: '4px 0' }}>
                  退款金额：<b style={{ color: '#ff6a00' }}>¥{draft.pay_amount?.toFixed(2)}</b>
                </div>
                {draft.items?.map((it, i) => (
                  <div key={i} style={{ color: '#666', fontSize: 12 }}>{it.title} ×{it.quantity}</div>
                ))}
                <div style={{ color: '#999', fontSize: 12 }}>原因：{draft.reason}</div>
              </div>
            )}
            <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
              {item.decided === null ? (
                <>
                  <Button type="primary" size="small" loading={streaming} onClick={() => decide(item, 'confirm')}>
                    {action === 'buy' ? '确认下单' : '确认申请'}
                  </Button>
                  <Button size="small" disabled={streaming} onClick={() => decide(item, 'cancel')}>取消</Button>
                </>
              ) : (
                <Tag color={item.decided === 'confirm' ? 'green' : 'default'}>
                  {item.decided === 'confirm' ? '已确认' : '已取消'}
                </Tag>
              )}
            </div>
          </Card>
        </div>
      )
    }
    if (item.kind === 'result') {
      return (
        <div key={item.key} style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 12 }}>
          <div
            style={{
              maxWidth: '85%', padding: '8px 12px', borderRadius: 8, fontSize: 13,
              background: item.ok ? '#f6ffed' : '#fff2f0',
              border: `1px solid ${item.ok ? '#b7eb8f' : '#ffccc7'}`,
            }}
          >
            {item.text}
          </div>
        </div>
      )
    }
    // text
    return (
      <div key={item.key} style={{ display: 'flex', justifyContent: item.mine ? 'flex-end' : 'flex-start', marginBottom: 12 }}>
        <div
          style={{
            maxWidth: '70%', padding: '8px 12px', borderRadius: 8,
            background: item.mine ? '#ff6a00' : '#fff', color: item.mine ? '#fff' : '#333',
            boxShadow: '0 1px 2px rgba(0,0,0,0.06)', wordBreak: 'break-word',
          }}
        >
          <div style={{ whiteSpace: 'pre-wrap' }}>{item.text}</div>
          {item.time && (
            <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4, textAlign: item.mine ? 'right' : 'left' }}>
              {dayjs(item.time).format('HH:mm')}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <Card style={{ height: 'calc(100vh - 180px)', minHeight: 480 }} styles={{ body: { height: '100%', padding: 0 } }}>
      <Row style={{ height: '100%' }}>
        <Col xs={8} md={7} style={{ borderRight: '1px solid #f0f0f0', height: '100%', overflowY: 'auto' }}>
          {sessions.length === 0 ? (
            <Empty description="暂无会话" style={{ marginTop: 48 }} />
          ) : (
            <List
              dataSource={sessions}
              renderItem={(s) => (
                <List.Item
                  style={{ cursor: 'pointer', padding: '12px 16px', background: s.id === activeId ? '#fff7f0' : undefined }}
                  onClick={() => openSession(s.id)}
                >
                  <List.Item.Meta
                    avatar={
                      <Badge count={s.unread_count} size="small">
                        <Avatar src={s.shop_logo}>{s.target_type === 'platform' ? '平' : s.title.slice(0, 1)}</Avatar>
                      </Badge>
                    }
                    title={
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {s.title}
                          {s.handler === 'agent' && (
                            <Tag color="gold" style={{ marginLeft: 6, fontSize: 11, lineHeight: '16px' }}>智能</Tag>
                          )}
                        </span>
                        {s.last_message_at && (
                          <span style={{ color: '#bbb', fontSize: 12, flexShrink: 0 }}>
                            {dayjs(s.last_message_at).format('MM-DD HH:mm')}
                          </span>
                        )}
                      </div>
                    }
                    description={
                      <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#999', fontSize: 12 }}>
                        {s.last_message || '暂无消息'}
                      </span>
                    }
                  />
                </List.Item>
              )}
            />
          )}
        </Col>
        <Col xs={16} md={17} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          {activeId ? (
            <>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0', fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>
                  {activeSession?.title || '客服会话'}
                  {isAgent ? (
                    <Tag color="gold" icon={<RobotOutlined />} style={{ marginLeft: 8 }}>智能客服</Tag>
                  ) : (
                    <Tag style={{ marginLeft: 8 }}>人工客服</Tag>
                  )}
                </span>
                {isAgent && (
                  <Button size="small" onClick={transfer}>转人工</Button>
                )}
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: 16, background: '#fafafa' }}>
                {items.length === 0 && !streamText && (
                  <Empty description={isAgent ? '智能客服为您服务，来说点什么吧' : '暂无消息，来说点什么吧'} style={{ marginTop: 48 }} />
                )}
                {items.map(renderItem)}
                {streamText && (
                  <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 12 }}>
                    <div style={{ maxWidth: '70%', padding: '8px 12px', borderRadius: 8, background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.06)', wordBreak: 'break-word' }}>
                      <div style={{ whiteSpace: 'pre-wrap' }}>{streamText}<span style={{ opacity: 0.4 }}>▌</span></div>
                    </div>
                  </div>
                )}
                {streaming && !streamText && (
                  <div style={{ color: '#999', fontSize: 12, marginBottom: 8 }}>智能客服正在输入…</div>
                )}
                <div ref={bottomRef} />
              </div>
              <div style={{ padding: 12, borderTop: '1px solid #f0f0f0', display: 'flex', gap: 8 }}>
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={streaming ? '智能客服回复中…' : isAgent ? '咨询商品/订单，或直接说想买什么' : '输入消息，回车发送'}
                  onPressEnter={send}
                  maxLength={500}
                  disabled={streaming}
                />
                <Button type="primary" icon={<SendOutlined />} onClick={send} disabled={streaming}>
                  发送
                </Button>
              </div>
            </>
          ) : (
            <Empty description="请选择左侧会话" style={{ margin: 'auto' }} />
          )}
        </Col>
      </Row>
    </Card>
  )
}
