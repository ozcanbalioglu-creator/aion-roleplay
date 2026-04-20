'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Upload, X, ImageIcon, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import Image from 'next/image'
import { uploadPersonaImageAction } from '@/lib/actions/storage.actions'

interface PersonaImageUploadProps {
  initialImageUrl?: string | null
  onUploadComplete: (url: string) => void
}

export function PersonaImageUpload({ initialImageUrl, onUploadComplete }: PersonaImageUploadProps) {
  const [preview, setPreview] = useState<string | null>(initialImageUrl || null)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    console.log('Client: File selected:', file.name, file.size, file.type)

    // Limitler
    if (file.size > 1 * 1024 * 1024) {
      toast.error('Dosya boyutu 1MB\'dan küçük olmalıdır.')
      return
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      toast.error('Sadece JPG, PNG ve WebP dosyaları kabul edilir.')
      return
    }

    try {
      setIsUploading(true)
      
      const formData = new FormData()
      formData.append('file', file)

      console.log('Client: Calling server action...')
      const result = await uploadPersonaImageAction(formData)
      console.log('Client: Server action result:', result)

      if (!result) {
        throw new Error('Sunucudan yanıt alınamadı.')
      }

      if (result.error) {
        throw new Error(result.error)
      }

      if (result.publicUrl) {
        setPreview(result.publicUrl)
        onUploadComplete(result.publicUrl)
        toast.success('Görsel başarıyla yüklendi.')
      }
    } catch (error: any) {
      console.error('Client Upload error:', error)
      toast.error('Yükleme sırasında hata oluştu: ' + error.message)
    } finally {
      setIsUploading(false)
    }
  }

  const handleRemove = () => {
    setPreview(null)
    onUploadComplete('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-6">
        <div className="relative w-24 h-24 rounded-full overflow-hidden bg-surface-container-highest border-2 border-border/20 flex items-center justify-center group">
          {preview ? (
            <>
              <Image src={preview} alt="Avatar" fill className="object-cover" />
              <button 
                type="button" 
                onClick={handleRemove}
                className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
              >
                <X className="h-6 w-6 text-white" />
              </button>
            </>
          ) : (
            <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
          )}
          {isUploading && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <Loader2 className="h-6 w-6 text-white animate-spin" />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Button 
            type="button" 
            variant="outline" 
            size="sm" 
            className="rounded-full h-9 px-4 border-border/40 hover:bg-surface-container-high"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            <Upload className="h-4 w-4 mr-2" />
            {preview ? 'Fotoğrafı Değiştir' : 'Fotoğraf Yükle'}
          </Button>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">
            JPG, PNG or WebP • Max 1MB
          </p>
        </div>
      </div>
      
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept="image/jpeg,image/png,image/webp" 
        onChange={handleFileChange} 
      />
    </div>
  )
}
