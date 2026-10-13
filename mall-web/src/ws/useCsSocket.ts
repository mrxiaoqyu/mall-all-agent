import { useEffect, useRef } from 'react'
import type { CsMessage } from '../api'
import { useAuthStore } from '../stores/authStore'
import { useCsStore } from '../stores/csStore'

export type CsMessageHandler = (msg: CsMessage) => void
export type HandlerChangedHandler = (data: { session_id: number; handler: string }) => void

const handlers = new Set<CsMessageHandler>()
const handlerChangedHandlers = new Set<HandlerChangedHandler>()
let socket: WebSocket | null = null
let socketToken: string | null = null
let refCount = 0
let reconnectTimer: ReturnType<typeof setTimeout> | null = null

/** 注册客服消息回调，返回注销函数 */
export function registerCsHandler(handler: CsMessageHandler) {
  handlers.add(handler)
  return () => {
    handlers.delete(handler)
  }
}

/** 注册会话模式变更回调（AI/人工切换），返回注销函数 */
export function registerHandlerChangedHandler(handler: HandlerChangedHandler) {
  handlerChangedHandlers.add(handler)
  return () => {
    handlerChangedHandlers.delete(handler)
  }
}

/** 通过 WebSocket 发送客服消息（服务端回显，无需本地追加） */
export function csSend(sessionId: number, content: string) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ session_id: sessionId, content }))
    return true
  }
  return false
}

function connect() {
  const token = useAuthStore.getState().token
  if (!token) return
  const url = `ws://${window.location.host}/ws/cs?token=${encodeURIComponent(token)}`
  socket = new WebSocket(url)
  socketToken = token

  socket.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data)
      if (payload?.type === 'message' && payload.data) {
        const msg = payload.data as CsMessage
        handlers.forEach((h) => h(msg))
        // 收到客服消息时刷新未读数
        if (msg.sender_role !== 'user') {
          useCsStore.getState().refresh()
        }
      } else if (payload?.type === 'handler_changed' && payload.data) {
        handlerChangedHandlers.forEach((h) => h(payload.data))
      }
    } catch {
      // 忽略无法解析的消息
    }
  }

  socket.onclose = () => {
    socket = null
    if (refCount > 0) {
      reconnectTimer = setTimeout(connect, 3000)
    }
  }

  socket.onerror = () => {
    socket?.close()
  }
}

function disconnect() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  if (socket) {
    socket.onclose = null
    socket.close()
    socket = null
  }
  socketToken = null
}

/**
 * 客服 WebSocket Hook：登录后自动连接，断线 3 秒重连。
 * 收到 {type:'message',data} 时分发给注册的回调并刷新未读数。
 */
export function useCsSocket() {
  const token = useAuthStore((s) => s.token)
  const tokenRef = useRef(token)
  tokenRef.current = token

  useEffect(() => {
    refCount += 1
    if (!socket) {
      connect()
    }
    return () => {
      refCount -= 1
      if (refCount <= 0) {
        refCount = 0
        disconnect()
      }
    }
  }, [])

  // 登录态变化时重连（含换账号：socket 绑定的 token 与当前不一致时强制重连）
  useEffect(() => {
    if (!token) {
      disconnect()
      return
    }
    if (!socket) {
      connect()
    } else if (socketToken !== token) {
      disconnect()
      connect()
    }
  }, [token])
}
