// ===========================
// Auth & User Types
// ===========================

export type UserRole = 'user' | 'manager' | 'hr_admin' | 'hr_viewer' | 'tenant_admin' | 'super_admin'

export interface AppUser {
  id: string
  tenant_id: string
  role: UserRole
  full_name: string
  email: string
  avatar_url?: string | null
  is_active: boolean
  title?: string | null
  position?: string | null
  department?: string | null
  username?: string | null
  manager_id?: string | null
  created_at: string
  updated_at?: string
}

export interface TenantContextProfile {
  company_description?: string
  industry?: string
  product_summary?: string
  company_size?: string
  culture_notes?: string
}

export interface Tenant {
  id: string
  name: string
  slug: string
  logo_url?: string | null
  website_url?: string | null
  brand_color?: string | null
  settings?: Record<string, unknown>
  context_profile?: TenantContextProfile | null
  is_active: boolean
  rubric_template_id?: string | null
  rubric_template_name?: string | null
  created_at: string
  updated_at?: string
  admin_user?: Pick<AppUser, 'id' | 'full_name' | 'email' | 'position'> | null
}

// ===========================
// LLM Types
// ===========================

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface LLMUsage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}

// ===========================
// Persona & Scenario Types
// ===========================

export interface Persona {
  id: string
  name: string
  title: string
  department: string | null
  location?: string | null
  experience_years?: number | null
  personality_type: string
  growth_type?: string | null
  emotional_baseline: string
  difficulty?: number | null
  resistance_level: number
  cooperativeness?: number | null
  trigger_behaviors?: string[]
  voice_id?: string | null
  is_active: boolean
  scenario_description?: string | null
  coaching_context?: string | null
  coaching_tips?: string[] | string | null
  avatar_image_url?: string | null
  tenant_id?: string | null
  created_at?: string
  kpis?: Array<{
    code: string
    name: string
    value: number
    is_custom: boolean
  }>
  persona_kpis?: Array<{
    kpi_code: string
    kpi_name: string
    value: number
    unit?: string | null
    is_custom?: boolean
  }>
  system_prompt?: string
}

export interface Scenario {
  id: string
  title: string
  description: string
  persona_id?: string
  difficulty_level: number // 1-5
  estimated_duration_min: number
  target_skills: string[]
  context_setup: string
  /** Kullanıcıya gösterilen, üçüncü şahıs ruh hali ipucu (AI talimatı değil) */
  mood_hint?: string | null
  /** Personanın bu senaryodaki rolü ve sorumlulukları (LLM context) */
  role_context?: string | null
  is_active: boolean
}

// ===========================
// Session Setup Types
// ===========================

/** Seans kurulum modu (adım akışı için) */
export type SessionApproach = 'scenario' | 'persona-driven' | 'free-form'

/** Seans sunum modu (metin/ses) */
export type SessionMode = 'text' | 'voice'

export type VoiceSessionTurn = 'idle' | 'listening' | 'recording' | 'processing' | 'speaking' | 'error'

export interface SessionOptions {
  mode: SessionApproach
  scenarioId?: string
  personaId?: string
}

export interface CreateSessionInput {
  personaId: string
  scenarioId: string
  sessionMode: SessionMode
}

export interface SessionData {
  id: string
  userId: string
  mode: SessionApproach
  session_mode: SessionMode
  status: string
  createdAt: string
  updatedAt: string
}

export interface Session {
  id: string
  user_id: string
  tenant_id: string
  persona_id: string
  scenario_id: string
  status: 'pending' | 'active' | 'completed' | 'cancelled' | 'dropped' | 'failed'
  session_mode: SessionMode
  started_at: string | null
  completed_at: string | null
  cancelled_at: string | null
  duration_seconds: number | null
  created_at: string
}

// ===========================
// Persona Recommendation Types
// ===========================

export type PersonaRecommendationTag = 'never_tried' | 'low_score' | 'stale' | 'other'

export interface PersonaWithRecommendation extends Persona {
  kpi_count: number
  completed_sessions: number
  avg_score: number | null
  last_completed_at: string | null
  recommendation_tag: PersonaRecommendationTag
  recommendation_priority: number // 1=en yüksek
}

// ===========================
// Dashboard / Weekly Status
// ===========================

export interface WeeklySessionStatus {
  completedThisWeek: number
  weekStart: Date
}

export interface ScenarioSummary {
  id: string
  title: string
  description: string
  difficulty_level: number
  estimated_duration_min: number
  target_skills: string[]
  context_setup: string
}

export interface UserWithManager extends AppUser {
  manager_name?: string | null
  manager_email?: string | null
}

export interface PersonaTenantMapping {
  id: string
  persona_id: string
  tenant_id: string
  assigned_at: string
  assigned_by: string
  is_active: boolean
  created_at: string
  updated_at: string
}
