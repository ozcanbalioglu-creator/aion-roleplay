export const features = {
  voice: process.env.FEATURE_VOICE_ENABLED === 'true',
  gamification: process.env.FEATURE_GAMIFICATION_ENABLED === 'true',
  analytics: process.env.FEATURE_ANALYTICS_ENABLED === 'true',
  bulkUpload: process.env.FEATURE_BULK_UPLOAD_ENABLED === 'true',
  progressPage: process.env.FEATURE_PROGRESS_PAGE_ENABLED === 'true',
  notificationsPage: process.env.FEATURE_NOTIFICATIONS_PAGE_ENABLED === 'true',
  managerPages: process.env.FEATURE_MANAGER_PAGES_ENABLED === 'true',
} as const

export type FeatureKey = keyof typeof features
