import { create } from 'zustand'
import type { VoiceSessionTurn } from '@/types'

export type { VoiceSessionTurn as VoiceTurn }

interface VoiceSessionStore {
  turn: VoiceSessionTurn
  isActive: boolean               // Natural flow aktif mi?
  isSupported: boolean
  hasMicPermission: boolean | null 
  currentTranscript: string        
  errorMessage: string | null
  isEnded: boolean

  setTurn: (turn: VoiceSessionTurn) => void
  setIsActive: (v: boolean) => void
  setSupported: (v: boolean) => void
  setMicPermission: (v: boolean) => void
  setCurrentTranscript: (text: string) => void
  setError: (msg: string | null) => void
  setEnded: (v: boolean) => void
  reset: () => void
}

export const useVoiceSessionStore = create<VoiceSessionStore>((set) => ({
  turn: 'idle',
  isActive: false,
  isSupported: true,
  hasMicPermission: null,
  currentTranscript: '',
  errorMessage: null,
  isEnded: false,

  setTurn: (turn) => set({ turn }),
  setIsActive: (v) => set({ isActive: v }),
  setSupported: (v) => set({ isSupported: v }),
  setMicPermission: (v) => set({ hasMicPermission: v }),
  setCurrentTranscript: (text) => set({ currentTranscript: text }),
  setError: (msg) => set({ errorMessage: msg }),
  setEnded: (v) => set({ isEnded: v }),
  reset: () =>
    set({
      turn: 'idle',
      isActive: false,
      hasMicPermission: null,
      currentTranscript: '',
      errorMessage: null,
      isEnded: false,
    }),
}))
