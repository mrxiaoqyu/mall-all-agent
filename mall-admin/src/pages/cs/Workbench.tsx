import { useCallback, useEffect, useRef, useState } from 'react'
import { App, Avatar, Badge, Button, Card, Empty, Input, List, Space, Tag } from 'antd'
import { RobotOutlined, SendOutlined, UserOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { getCsMessages, getCsSessions, readCsSession, updateSessionHandler } from '../../api'
import { useCsSocket } from '../../ws/useCsSocket'

export default function CsWorkbench() {
  const { message } = App.useApp()
  const [sessions, setSessions] = useState<any[]>([])
  const [activeId, setActiveId] = useState<number | null>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [input, setInput] = useState('')
  const [switching, setSwitching] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const activeIdRef = useRef<number | null>(null)
  activeIdRef.current = activeId

  const loadSessions = useCallback(() => {
    getCsSessions().then((res: any) => setSessions(res.data?.list || res.data || []))
  }, [])

  useEffect(() => {
    loadSessions()
  }, [loadSessions])

  const onWsMessage = useCallback(
    (payload: any) => {
      if (payload?.type === 'handler_changed' && payload.data) {
        const { session_id, handler } = payload.data
        setSessions((prev) => prev.map((s) => (s.id === session_id ? { ...s, handler } : s)))
        return
      }
      const msg = payload?.type === 'message' ? payload.data : payload
      if (!msg?.session_id) return
      if (msg.session_id === activeIdRef.current) {
        setMessages((prev) => {
          if (msg.id && prev.some((m) => m.id === msg.id)) return prev
          return [...prev, msg]
        })
        readCsSession(msg.session_id).then(loadSessions)
      } else {
        loadSessions()
      }
    },
    [loadSessions],
  )

  const { send } = useCsSocket(onWsMessage)

  const openSession = async (id: number) => {
    setActiveId(id)
    const res: any = await getCsMessages(id)
    setMessages(res.data?.list || res.data || [])
    await readCsSession(id)
    loadSessions()
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const onSend = () => {
    const content = input.trim()
    if (!content || !activeId) return
    send({ session_id: activeId, content })
    setInput('')
  }

  const activeSession = sessions.find((s) => s.id === activeId)
  const isAgent = activeSession?.handler === 'agent'

  const onSwitchHandler = async (handler: 'agent' | 'human') => {
    if (!activeId) return
    setSwitching(true)
    try {
      await updateSessionHandler(activeId, handler)
      setSessions((prev) => prev.map((s) => (s.id === activeId ? { ...s, handler } : s)))
      message.success(handler === 'human' ? '已接管该会话' : '已转回智能客服')
    } finally {
      setSwitching(false)
    }
  }

  return (
    <Card title="客服工作台" styles={{ body: { padding: 0 } }}>
      <div style={{ display: 'flex', height: 'calc(100vh - 200px)', minHeight: 480 }}>
        <div style={{ width: 280, borderRight: '1px solid #f0f0f0', overflowY: 'auto' }}>
          <List
            dataSource={sessions}
            locale={{ emptyText: <Empty description="暂无会话" /> }}
            renderItem={(s: any) => (
              <List.Item
                onClick={() => openSession(s.id)}
                style={{
                  cursor: 'pointer',
                  padding: '12px 16px',
                  background: s.id === activeId ? '#e6f4ff' : undefined,
                }}
              >
                <List.Item.Meta
                  avatar={
                    <Badge count={s.unread_count || 0} size="small">
                      <Avatar icon={<UserOutlined />} />
                    </Badge>
                  }
                  title={
                    <Space size={6}>
                      <span>{s.user_nickname || s.nickname || `用户 ${s.user_id}`}</span>
                      {s.handler === 'agent' ? (
                        <Tag icon={<RobotOutlined />} color="blue" style={{ marginRight: 0 }}>
                          智能
                        </Tag>
                      ) : (
                        <Tag color="green" style={{ marginRight: 0 }}>
                          人工
                        </Tag>
                      )}
                    </Space>
                  }
                  description={
                    <span style={{ fontSize: 12, color: '#999' }}>
                      {s.last_message || s.last_message_content || '暂无消息'}
                    </span>
                  }
                />
              </List.Item>
            )}
          />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {!activeId ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Empty description="请选择左侧会话开始接待" />
            </div>
          ) : (
            <>
              <div
                style={{
                  padding: '10px 16px',
                  borderBottom: '1px solid #f0f0f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Space size={8}>
                  <span style={{ fontWeight: 600 }}>
                    {activeSession?.user_nickname || activeSession?.nickname || `会话 ${activeId}`}
                  </span>
                  {isAgent ? (
                    <Tag icon={<RobotOutlined />} color="blue">
                      智能客服接待中
                    </Tag>
                  ) : (
                    <Tag color="green">人工接待中</Tag>
                  )}
                </Space>
                {isAgent ? (
                  <Button size="small" type="primary" loading={switching} onClick={() => onSwitchHandler('human')}>
                    接管会话
                  </Button>
                ) : (
                  <Button size="small" loading={switching} onClick={() => onSwitchHandler('agent')}>
                    转回智能客服
                  </Button>
                )}
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: 16, background: '#fafafa' }}>
                {messages.map((m, idx) => {
                  if (m.msg_type === 'system') {
                    return (
                      <div key={m.id ?? idx} style={{ textAlign: 'center', marginBottom: 12 }}>
                        <span style={{ fontSize: 12, color: '#999' }}>{m.content}</span>
                      </div>
                    )
                  }
                  const isSelf = m.sender_role !== 'user'
                  return (
                    <div
                      key={m.id ?? idx}
                      style={{
                        display: 'flex',
                        justifyContent: isSelf ? 'flex-end' : 'flex-start',
                        marginBottom: 12,
                      }}
                    >
                      <div
                        style={{
                          maxWidth: '70%',
                          background: isSelf ? '#1677ff' : '#fff',
                          color: isSelf ? '#fff' : '#333',
                          padding: '8px 12px',
                          borderRadius: 8,
                          boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                        }}
                      >
                        {m.sender_role === 'agent' && (
                          <div style={{ fontSize: 11, opacity: 0.8, marginBottom: 2 }}>
                            <RobotOutlined /> 智能客服
                          </div>
                        )}
                        <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.content}</div>
                        {m.created_at && (
                          <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4, textAlign: 'right' }}>
                            {dayjs(m.created_at).format('YYYY-MM-DD HH:mm')}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
                <div ref={bottomRef} />
              </div>
              <div style={{ padding: 12, borderTop: '1px solid #f0f0f0' }}>
                {isAgent ? (
                  <div style={{ color: '#999', fontSize: 13, textAlign: 'center', padding: '8px 0' }}>
                    当前由智能客服接待，点击右上角「接管会话」后可人工回复
                  </div>
                ) : (
                  <Space.Compact style={{ width: '100%' }}>
                    <Input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onPressEnter={onSend}
                      placeholder="输入消息，回车发送"
                    />
                    <Button type="primary" icon={<SendOutlined />} onClick={onSend}>
                      发送
                    </Button>
                  </Space.Compact>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </Card>
  )
}
