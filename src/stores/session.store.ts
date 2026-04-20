import { create } from 'zustand'

export type SessionPhase = 'opening' | 'exploration' | 'deepening' | 'action' | 'closing'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  phase: SessionPhase
  timestamp: Date
  isStreaming?: boolean
}

interface SessionStore {
  messages: ChatMessage[]
  currentPhase: SessionPhase
  isStreaming: boolean
  isEnded: boolean
  addMessage: (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => void
  updateLastMessage: (content: string) => void
  finalizeLastMessage: (phase: SessionPhase) => void
  setPhase: (phase: SessionPhase) => void
  setStreaming: (v: boolean) => void
  setEnded: (v: boolean) => void
  reset: () => void
}

export const useSessionStore = create<SessionStore>((set) => ({
  messages: [],
  currentPhase: 'opening',
  isStreaming: false,
  isEnded: false,

  addMessage: (msg) =>
    set((state) => ({
      messages: [
        ...state.messages,
        { ...msg, id: crypto.randomUUID(), timestamp: new Date() },
      ],
    })),

  updateLastMessage: (content) =>
    set((state) => {
      const msgs = [...state.messages]
      const last = msgs[msgs.length - 1]
      if (last?.isStreaming) msgs[msgs.length - 1] = { ...last, content }
      return { messages: msgs }
    }),

  finalizeLastMessage: (phase) =>
    set((state) => {
      const msgs = [...state.messages]
      const last = msgs[msgs.length - 1]
      if (last) msgs[msgs.length - 1] = { ...last, isStreaming: false, phase }
      return { messages: msgs, currentPhase: phase }
    }),

  setPhase: (phase) => set({ currentPhase: phase }),
  setStreaming: (v) => set({ isStreaming: v }),
  setEnded: (v) => set({ isEnded: v }),
  reset: () => set({ messages: [], currentPhase: 'opening', isStreaming: false, isEnded: false }),
}))
