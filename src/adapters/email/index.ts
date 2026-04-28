import type { IEmailAdapter } from './interface'
import { ResendEmailAdapter } from './resend.adapter'

let _adapter: IEmailAdapter | null = null

export function getEmailAdapter(): IEmailAdapter | null {
  if (!process.env.RESEND_API_KEY) return null
  if (!_adapter) _adapter = new ResendEmailAdapter(process.env.RESEND_API_KEY)
  return _adapter
}

export type { IEmailAdapter, SendEmailOptions, SendEmailResult } from './interface'
