// ─── USER & AUTH ────────────────────────────────────────────────────────────

export type UserRole =
  | 'super_admin'
  | 'tenant_admin'
  | 'hr_admin'
  | 'manager'
  | 'user'

export interface AppUser {
  id: string
  email: string
  full_name: string
  role: UserRole
  tenant_id: string
  avatar_url?: string
  is_active: boolean
  created_at: string
}

// ─── TENANT ─────────────────────────────────────────────────────────────────

export interface Tenant {
  id: string
  name: string
  slug: string
  logo_url?: string
  brand_color?: string   // hex, e.g. "#4F46E5"
  is_active: boolean
  created_at: string
}

// ─── PERSONA ────────────────────────────────────────────────────────────────

export type PersonalityType =
  | 'dominant'
  | 'compliant'
  | 'resistant'
  | 'analytical'
  | 'expressive'
  | 'withdrawn'

export type EmotionalState =
  | 'motivated'
  | 'demotivated'
  | 'frustrated'
  | 'neutral'
  | 'anxious'
  | 'confident'
  | 'burned_out'

export interface VoiceSettings {
  provider: 'elevenlabs' | 'openai' | 'azure'
  voice_id: string
  stability?: number
  similarity_boost?: number
  speed?: number
}

export interface Persona {
  id: string
  name: string
  title: string
  sector_tags: string[]
  difficulty: 1 | 2 | 3 | 4 | 5
  personality_type: PersonalityType
  emotional_baseline: EmotionalState
  resistance_level: 1 | 2 | 3 | 4 | 5
  cooperativeness: 1 | 2 | 3 | 4 | 5
  trigger_behaviors: string[]
  voice_settings: VoiceSettings
  avatar_image_url?: string
  is_active: boolean
  created_by: string
  created_at: string
}

// ─── SCENARIO ───────────────────────────────────────────────────────────────

export interface Scenario {
  id: string
  title: string
  description: string
  persona_id: string
  target_skill_codes: string[]
  difficulty: 1 | 2 | 3 | 4 | 5
  sector_tags: string[]
  is_active: boolean
  tenant_id: string | null   // null = global
  created_by: string
  created_at: string
}

// ─── SESSION ────────────────────────────────────────────────────────────────

export type SessionStatus =
  | 'pending'
  | 'active'
  | 'completed'
  | 'cancelled'
  | 'dropped'
  | 'failed'

export type SessionPhase =
  | 'opening'
  | 'exploration'
  | 'deepening'
  | 'action'
  | 'closing'

export type CancellationReason =
  | 'manual_cancel'    // kullanıcı "Bu seansı sayma" seçti
  | 'drop_off'         // timeout / tarayıcı kapandı
  | 'technical_failure' // sistem hatası

export interface Session {
  id: string
  user_id: string
  tenant_id: string
  persona_id: string
  scenario_id: string
  status: SessionStatus
  current_phase: SessionPhase
  cancellation_reason?: CancellationReason
  started_at: string
  completed_at?: string
  duration_seconds?: number
  message_count: number
  prompt_version_id: string
}

export interface SessionMessage {
  id: string
  session_id: string
  role: 'user' | 'assistant'
  content_encrypted: string   // AES-256-GCM şifreli
  created_at: string
  token_count?: number
}

// ─── EVALUATION ─────────────────────────────────────────────────────────────

export type RubricDimensionCode =
  | 'active_listening'
  | 'powerful_questions'
  | 'summarizing'
  | 'empathy'
  | 'action_clarity'
  | 'non_judgmental'
  | 'assumption_challenging'
  | 'responsibility_opening'
  | 'goal_alignment'
  | 'feedback_quality'
  | 'silence_management'
  | 'reframing'

export interface DimensionScore {
  dimension_code: RubricDimensionCode
  score: 1 | 2 | 3 | 4 | 5
  evidence_quotes: string[]
  rationale: string
  improvement_tip: string
}

export interface Evaluation {
  id: string
  session_id: string
  user_id: string
  tenant_id: string
  overall_score: number          // ortalama
  dimension_scores: DimensionScore[]
  strengths: string[]            // güçlü yönler
  development_areas: string[]    // gelişim alanları
  coaching_note: string          // kullanıcıya koçluk notu
  prompt_version_id: string
  created_at: string
}

// ─── GAMIFICATION ───────────────────────────────────────────────────────────

export interface GamificationProfile {
  user_id: string
  tenant_id: string
  total_points: number
  level: 1 | 2 | 3 | 4 | 5
  completed_sessions: number
  streak_days: number
  last_session_date?: string
}

export interface Badge {
  id: string
  code: string
  name: string
  description: string
  icon_url: string
  category: 'milestone' | 'skill' | 'difficulty' | 'streak'
  criteria: Record<string, unknown>
}

export interface UserBadge {
  id: string
  user_id: string
  badge_id: string
  earned_at: string
}

// ─── PROMPT ─────────────────────────────────────────────────────────────────

export type PromptType =
  | 'role_play_system'
  | 'session_summary'
  | 'evaluation_extraction'
  | 'evaluation_scoring'
  | 'feedback_coaching'
  | 'manager_insights'

export interface PromptVersion {
  id: string
  template_id: string
  version_number: number
  content: string
  variables: string[]       // inject edilecek değişken adları
  created_by: string
  created_at: string
  is_active: boolean
}

// ─── API ────────────────────────────────────────────────────────────────────

export interface ApiSuccess<T> {
  data: T
  meta?: {
    page?: number
    total?: number
    per_page?: number
  }
}

export interface ApiError {
  error: {
    code: string
    message: string
    details?: unknown
  }
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError

// ─── ADAPTER ────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LLMUsage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}
