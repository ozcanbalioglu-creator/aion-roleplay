export interface SendEmailOptions {
  to: string
  subject: string
  html: string
  text: string
}

export interface SendEmailResult {
  delivered: boolean
  error?: string
}

export interface IEmailAdapter {
  send(options: SendEmailOptions): Promise<SendEmailResult>
}
