'use client'

import { useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { UserCircle, Camera, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { updateMyProfileAction, uploadAvatarAction } from '@/lib/actions/user.actions'
import type { AppUser } from '@/types'

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Süper Admin',
  tenant_admin: 'Kurum Admin',
  hr_admin: 'İK Admin',
  hr_viewer: 'İK Görüntüleyici',
  manager: 'Yönetici',
  user: 'Kullanıcı',
}

export function ProfileForm({ user }: { user: AppUser }) {
  const [isPending, setIsPending] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState(user.avatar_url ?? null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsPending(true)
    const fd = new FormData(e.currentTarget)
    const res = await updateMyProfileAction({
      full_name: fd.get('full_name') as string,
      title: fd.get('title') as string || undefined,
      position: fd.get('position') as string || undefined,
      department: fd.get('department') as string || undefined,
    })
    setIsPending(false)
    if (res.error) toast.error(res.error)
    else toast.success('Profil güncellendi.')
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    const fd = new FormData()
    fd.append('avatar', file)
    const res = await uploadAvatarAction(fd)
    setIsUploading(false)

    if (res.error) {
      toast.error(res.error)
    } else {
      toast.success(res.success ?? 'Fotoğraf güncellendi.')
      if (res.avatarUrl) setAvatarUrl(res.avatarUrl)
    }
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="space-y-6">
      {/* Kimlik kartı */}
      <Card className="border-border/40">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="relative group shrink-0">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt={user.full_name} className="h-full w-full rounded-full object-cover" />
                ) : (
                  <UserCircle className="h-8 w-8 text-primary" />
                )}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Fotoğraf değiştir"
              >
                {isUploading ? (
                  <Loader2 className="h-4 w-4 text-white animate-spin" />
                ) : (
                  <Camera className="h-4 w-4 text-white" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>
            <div>
              <p className="font-semibold text-lg">{user.full_name}</p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
              <Badge variant="secondary" className="mt-1 text-xs">
                {ROLE_LABELS[user.role] ?? user.role}
              </Badge>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Fotoğrafı değiştirmek için avatar üzerine gelin ve kamera simgesine tıklayın. (Maks. 5 MB)
          </p>
        </CardContent>
      </Card>

      {/* Düzenleme formu */}
      <Card className="border-border/40">
        <CardHeader>
          <CardTitle className="text-base">Bilgilerimi Güncelle</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="prof-name">Ad Soyad</Label>
                <Input id="prof-name" name="full_name" defaultValue={user.full_name} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="prof-title">Ünvan</Label>
                <Input id="prof-title" name="title" defaultValue={user.title ?? ''} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="prof-position">Pozisyon</Label>
                <Input id="prof-position" name="position" defaultValue={user.position ?? ''} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="prof-dept">Departman</Label>
                <Input id="prof-dept" name="department" defaultValue={user.department ?? ''} />
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Kaydediliyor...' : 'Güncelle'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
