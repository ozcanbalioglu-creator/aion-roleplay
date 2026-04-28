import { Resend } from 'resend'
import type { IEmailAdapter, SendEmailOptions, SendEmailResult } from './interface'

const FROM_ADDRESS = 'noreply@mirror.aionmore.com'

export class ResendEmailAdapter implements IEmailAdapter {
  private client: Resend

  constructor(apiKey: string) {
    this.client = new Resend(apiKey)
  }

  async send(options: SendEmailOptions): Promise<SendEmailResult> {
    try {
      await this.client.emails.send({
        from: FROM_ADDRESS,
        to: [options.to],
        subject: options.subject,
        html: options.html,
        text: options.text,
      })
      return { delivered: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[email] Resend send error:', message)
      return { delivered: false, error: message }
    }
  }
}
