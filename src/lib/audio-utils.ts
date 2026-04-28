/**
 * VAD'dan gelen Float32Array verisini 16kHz Mono WAV (Blob) formatına dönüştürür.
 * Whisper 16kHz mono tercih eder.
 */
export function float32ArrayToWav(audioData: Float32Array, sampleRate: number = 16000): Blob {
  const buffer = new ArrayBuffer(44 + audioData.length * 2)
  const view = new DataView(buffer)

  /* RIFF identifier */
  writeString(view, 0, 'RIFF')
  /* file length */
  view.setUint32(4, 32 + audioData.length * 2, true)
  /* RIFF type */
  writeString(view, 8, 'WAVE')
  /* format chunk identifier */
  writeString(view, 12, 'fmt ')
  /* format chunk length */
  view.setUint32(16, 16, true)
  /* sample format (raw) */
  view.setUint16(20, 1, true)
  /* channel count */
  view.setUint16(22, 1, true)
  /* sample rate */
  view.setUint32(24, sampleRate, true)
  /* byte rate (sample rate * block align) */
  view.setUint32(28, sampleRate * 2, true)
  /* block align (channel count * bytes per sample) */
  view.setUint16(32, 2, true)
  /* bits per sample */
  view.setUint16(34, 16, true)
  /* data chunk identifier */
  writeString(view, 36, 'data')
  /* data chunk length */
  view.setUint32(40, audioData.length * 2, true)

  // Write PCM samples
  let offset = 44
  for (let i = 0; i < audioData.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, audioData[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }

  return new Blob([view], { type: 'audio/wav' })
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i))
  }
}

// Server tarafında strip yapsak da chunk boundary'lerinde marker bölünebiliyor.
// Client tarafında speak/display öncesi defansif son temizlik.
const PHASE_BRACKET = /\[\s*PHASE\s*:?\s*[a-zA-Z_]+\s*\]/gi
const PHASE_NAKED = /\b(?:phase|faz)\s*[:\-]?\s*(?:opening|exploration|deepening|action|closing|a[çc][ıi]l[ıi][şs]|ke[şs]if|derinle[şs]me|aksiyon|kapan[ıi][şs])\b\.?/gi
const SESSION_END_BRACKET = /\[\s*SESSION[\s_-]?END\s*\]/gi
const SESSION_END_NAKED = /\bSESSION[\s_-]?END\b/gi

export function sanitizeForTTS(text: string): string {
  return text
    .replace(PHASE_BRACKET, '')
    .replace(PHASE_NAKED, '')
    .replace(SESSION_END_BRACKET, '')
    .replace(SESSION_END_NAKED, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Blob MIME type'ından Whisper-uyumlu dosya adı türetir.
 * Whisper, formatı dosya adı uzantısından çıkarır.
 */
export function blobToWhisperFilename(blob: Blob): string {
  const mime = blob.type.toLowerCase()
  if (mime.includes('webm')) return 'recording.webm'
  if (mime.includes('mp4') || mime.includes('m4a') || mime.includes('aac')) return 'recording.mp4'
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'recording.mp3'
  if (mime.includes('ogg')) return 'recording.ogg'
  if (mime.includes('wav')) return 'recording.wav'
  return 'recording.webm'  // sensible default
}
