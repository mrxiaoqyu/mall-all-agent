import { useEffect, useRef, useCallback } from 'react'

export interface CsWsMessage {
  type?: string
  session_id?: number
  sender_type?: string
  content?: string
  created_at?: string
  [key: string]: any
}

export function useCsSocket(onMessage: (msg: CsWsMessage) => void) {
  const wsRef = useRef<WebSocket | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onMessageRef = useRef(onMessage)
  onMessageRef.current = onMessage

  useEffect(() => {
    let closed = false

    const connect = () => {
      const token = localStorage.getItem('admin_token')
      if (!token) return
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws/cs?token=${token}`)
      wsRef.current = ws

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          onMessageRef.current(data)
        } catch {
          // 忽略非 JSON 消息
        }
      }

      ws.onclose = () => {
        if (!closed) {
          timerRef.current = setTimeout(connect, 3000)
        }
      }

      ws.onerror = () => {
        ws.close()
      }
    }

    connect()

    return () => {
      closed = true
      if (timerRef.current) clearTimeout(timerRef.current)
      wsRef.current?.close()
      wsRef.current = null
    }
  }, [])

  const send = useCallback((payload: any) => {
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(typeof payload === 'string' ? payload : JSON.stringify(payload))
    }
  }, [])

  return { send }
}
