import { z } from 'zod'

const envSchema = z.object({
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // Encryption
  ENCRYPTION_KEY: z.string().length(64, 'ENCRYPTION_KEY must be 64 hex characters (32 bytes)'),

  // LLM
  LLM_PROVIDER: z.enum(['openai']).default('openai'),
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_LLM_MODEL: z.string().default('gpt-4o'),

  // STT
  STT_PROVIDER: z.enum(['openai']).default('openai'),

  // TTS
  TTS_PROVIDER: z.enum(['elevenlabs']).default('elevenlabs'),
  ELEVENLABS_API_KEY: z.string().min(1),
  ELEVENLABS_DEFAULT_VOICE_ID: z.string().min(1),

  // Queue (Upstash QStash)
  UPSTASH_QSTASH_TOKEN: z.string().optional(),
  UPSTASH_QSTASH_CURRENT_SIGNING_KEY: z.string().optional(),
  UPSTASH_QSTASH_NEXT_SIGNING_KEY: z.string().optional(),
  QSTASH_RECEIVER_URL: z.string().url().optional(),

  // Email
  RESEND_API_KEY: z.string().optional(),

  // App
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  APP_ENV: z.enum(['development', 'staging', 'production']).default('development'),

  // Feature flags
  FEATURE_VOICE_ENABLED: z.coerce.boolean().default(true),
  FEATURE_GAMIFICATION_ENABLED: z.coerce.boolean().default(true),
  FEATURE_ANALYTICS_ENABLED: z.coerce.boolean().default(true)
})

export type Env = z.infer<typeof envSchema>

function validateEnv(): Env {
  const result = envSchema.safeParse(process.env)
  if (!result.success) {
    console.error('❌ Invalid environment variables:')
    result.error.issues.forEach(issue => {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`)
    })
    throw new Error('Environment validation failed. Check your .env.local file.')
  }
  return result.data
}

// Sunucu tarafında bir kez çalışır
export const env = validateEnv()
