'use server'

import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/auth'

export async function uploadPersonaImageAction(formData: FormData) {
  try {
    const user = await getCurrentUser()
    if (!user || !['super_admin', 'tenant_admin'].includes(user.role)) {
      return { error: 'Yetkiniz yok.' }
    }

    const file = formData.get('file') as File
    if (!file) return { error: 'Dosya bulunamadı.' }

    // DOĞRUDAN SUPABASE-JS KULLANIYORUZ (Sıkıntısız Service Role)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )
    
    // Bucket kontrolü
    const { data: buckets } = await supabase.storage.listBuckets()
    const personasBucket = buckets?.find(b => b.id === 'personas')
    
    if (!personasBucket) {
      await supabase.storage.createBucket('personas', { public: true })
    }

    const fileExt = file.name.split('.').pop()
    const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`
    const filePath = `avatars/${fileName}`

    // Blob tipine çevirerek yüklemeyi deneyelim (Bazen File objesi server action sınırlarında bozulabiliyor)
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { data, error } = await supabase.storage
      .from('personas')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true
      })

    if (error) {
      console.error('Core Storage Error:', error)
      return { error: 'Dosya yüklenemedi: ' + error.message }
    }

    const { data: { publicUrl } } = supabase.storage
      .from('personas')
      .getPublicUrl(filePath)

    return { publicUrl }

  } catch (err: any) {
    console.error('Final Catch Error:', err)
    return { error: 'Sistem hatası: ' + err.message }
  }
}
