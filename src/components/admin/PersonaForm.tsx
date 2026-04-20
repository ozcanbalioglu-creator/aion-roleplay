'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { SubmitButton } from '@/components/ui/SubmitButton'
import { toast } from 'sonner'
import { Plus, Trash2, User, Brain, BarChart2, Lightbulb, Settings } from 'lucide-react'
import { createPersonaAction, updatePersonaAction } from '@/lib/actions/persona.actions'
import { cn } from '@/lib/utils'
import { PersonaImageUpload } from './PersonaImageUpload'

interface PersonaKPI {
  code: string
  name: string
  value: number
  is_custom: boolean
}

interface PersonaFormProps {
  initialData?: any
}

const PERSONA_TYPES = [
  { value: 'falling_performance', label: 'Düşen Performans' },
  { value: 'rising_performance', label: 'Yükselen Performans' },
  { value: 'resistant_experience', label: 'Dirençli Deneyim' },
  { value: 'new_to_role', label: 'Yeni Göreve Başlayan' },
  { value: 'motivation_crisis', label: 'Motivasyon Krizi' },
]

const KPI_TEMPLATES = [
  { code: 'genel_rea', name: 'Genel Gerçekleşme' },
  { code: 'ciro_rea', name: 'Ciro Gerçekleşme' },
  { code: 'musteri_ziyaret_rea', name: 'Müşteri Ziyaret Oranı' },
  { code: 'yeni_musteri_kazanimi_rea', name: 'Yeni Müşteri Kazanımı' },
  { code: 'pazar_payi', name: 'Pazar Payı' },
  { code: 'nps_musteri_memnuniyeti', name: 'NPS / Memnuniyet' },
]

export function PersonaForm({ initialData }: PersonaFormProps) {
  const router = useRouter()
  const [kpis, setKpis] = useState<PersonaKPI[]>(initialData?.kpis || [])
  const [personaType, setPersonaType] = useState(initialData?.personality_type || 'new_to_role')
  const [difficulty, setDifficulty] = useState(initialData?.difficulty?.toString() || '3')
  const [avatarUrl, setAvatarUrl] = useState(initialData?.avatar_image_url || '')

  const addKPI = () => {
    setKpis([...kpis, { code: 'ozel_kpi', name: '', value: 100, is_custom: true }])
  }

  const removeKPI = (index: number) => {
    setKpis(kpis.filter((_, i) => i !== index))
  }

  const updateKPI = (index: number, updates: Partial<PersonaKPI>) => {
    setKpis(prev => {
      const next = [...prev]
      next[index] = { ...next[index], ...updates }
      return next
    })
  }

  async function handleSubmit(formData: FormData) {
    formData.append('kpis', JSON.stringify(kpis))
    formData.append('personality_type', personaType)
    formData.append('difficulty', difficulty)
    formData.append('avatar_image_url', avatarUrl)

    const res = initialData 
      ? await updatePersonaAction(initialData.id, formData)
      : await createPersonaAction(formData)

    if (res.success) {
      toast.success(res.success)
      router.push('/tenant/personas')
      router.refresh()
    } else {
      toast.error(res.error || 'Bir hata oluştu')
    }
  }

  // Identity input stili (Özel Renkler - Enforced with !important because of base Input component)
  const identityInputClassName = "!bg-[#f5f2ff] !border-none !text-[#47464c] !placeholder-[#47464c] focus:!bg-[#f5f2ff] focus:ring-0 h-11 font-medium"
  
  // Diğer input/textarea stili
  const commonInputClassName = "bg-surface-container-low border-border/40 focus:bg-surface-container-highest transition-colors h-11"

  return (
    <form action={handleSubmit} className="space-y-8 pb-20">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* SOL KOLON: Temel Bilgiler */}
        <div className="lg:col-span-8 space-y-8">
          <Card className="bg-card/60 backdrop-blur-xl border-border/40 shadow-2xl">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-on-primary-container/10 rounded-lg">
                  <User className="h-5 w-5 text-on-primary-container" />
                </div>
                <div>
                  <CardTitle>Kimlik Bilgileri</CardTitle>
                  <CardDescription>Personanın temel profilini ve profesyonel geçmişini tanımlayın.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-8">
              {/* Fotoğraf Yükleme */}
              <div className="pb-4 border-b border-border/10">
                <Label className="mb-4 block">Persona Görseli</Label>
                <PersonaImageUpload 
                  initialImageUrl={avatarUrl} 
                  onUploadComplete={setAvatarUrl} 
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Persona Adı</Label>
                  <Input id="name" name="name" defaultValue={initialData?.name} className={identityInputClassName} placeholder="Örn: Anya" required style={{ backgroundColor: '#f5f2ff', color: '#47464c' }} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="surname">Persona Soyadı</Label>
                  <Input id="surname" name="surname" defaultValue={initialData?.surname} className={identityInputClassName} placeholder="Örn: Petrov" style={{ backgroundColor: '#f5f2ff', color: '#47464c' }} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="title">Ünvan / Pozisyon</Label>
                  <Input id="title" name="title" defaultValue={initialData?.title} className={identityInputClassName} placeholder="Örn: Lead Developer" required style={{ backgroundColor: '#f5f2ff', color: '#47464c' }} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="department">Departman / Alan</Label>
                  <Input id="department" name="department" defaultValue={initialData?.department} className={identityInputClassName} placeholder="Örn: Cybersecurity" style={{ backgroundColor: '#f5f2ff', color: '#47464c' }} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Görev Yeri</Label>
                  <Input id="location" name="location" defaultValue={initialData?.location} className={identityInputClassName} placeholder="Örn: İstanbul - Şişli" style={{ backgroundColor: '#f5f2ff', color: '#47464c' }} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="experience_years">Tecrübe Yılı</Label>
                  <Input id="experience_years" name="experience_years" type="number" defaultValue={initialData?.experience_years} className={identityInputClassName} placeholder="4" style={{ backgroundColor: '#f5f2ff', color: '#47464c' }} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/60 backdrop-blur-xl border-border/40 shadow-2xl">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/10 rounded-lg">
                  <Brain className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <CardTitle>Bağlam ve Hikaye</CardTitle>
                  <CardDescription>AI'nın rolünü oynaması için gereken senaryoyu ve koçluk hedeflerini belirtin.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="scenario_description">Senaryo Açıklaması</Label>
                <Textarea id="scenario_description" name="scenario_description" defaultValue={initialData?.scenario_description} placeholder="Bu persona hangi durumda? Hangi zorlukları yaşıyor?" className="min-h-[120px] bg-surface-container-low border-border/40" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="coaching_context">Koçluk Bağlamı</Label>
                <Input id="coaching_context" name="coaching_context" defaultValue={initialData?.coaching_context} className={identityInputClassName} placeholder="Örn: High-Potential Fast-Track" style={{ backgroundColor: '#f5f2ff', color: '#47464c' }} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="coaching_tips">Koçluk İpuçları</Label>
                <Textarea id="coaching_tips" name="coaching_tips" defaultValue={initialData?.coaching_tips?.[0] || ''} placeholder="Koç bu seansda nelere odaklanmalı?" className="min-h-[100px] bg-surface-container-low border-border/40" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/60 backdrop-blur-xl border-border/40 shadow-2xl">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Settings className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>Sistem Promptu</CardTitle>
                  <CardDescription>AI davranışını belirleyen teknik talimatlar (Plaintext).</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Textarea id="system_prompt" name="system_prompt" defaultValue={initialData?.system_prompt} placeholder="AI nasıl davranmalı? Hangi kurallara uymalı?" className="min-h-[300px] font-mono text-xs bg-surface-container-low border-border/40" required />
            </CardContent>
          </Card>
        </div>

        {/* SAĞ KOLON: Metrikler ve Ayarlar */}
        <div className="lg:col-span-4 space-y-8">
          <Card className="bg-card/60 backdrop-blur-xl border-border/40 shadow-2xl">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-on-primary-container/10 rounded-lg">
                  <BarChart2 className="h-5 w-5 text-on-primary-container" />
                </div>
                <div>
                  <CardTitle>Performans Tipi ve Zorluk</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Persona Tipi</Label>
                <Select onValueChange={setPersonaType} value={personaType}>
                  <SelectTrigger className="w-full bg-surface-container-low border-border/40 h-11">
                    <SelectValue placeholder="Seçiniz" />
                  </SelectTrigger>
                  <SelectContent>
                    {PERSONA_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Label>Zorluk Seviyesi</Label>
                  <span className="text-sm font-bold text-on-primary-container">{difficulty} / 5</span>
                </div>
                <div className="grid grid-cols-5 gap-2">
                    {[1, 2, 3, 4, 5].map(v => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setDifficulty(v.toString())}
                        className={cn(
                          "h-10 rounded-lg text-xs font-bold transition-all border border-border/10",
                          difficulty === v.toString() 
                            ? "bg-on-primary-container text-surface shadow-lg"
                            : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high"
                        )}
                      >
                        {v}
                      </button>
                    ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/60 backdrop-blur-xl border-border/40 shadow-2xl">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-500/10 rounded-lg">
                    <BarChart2 className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <CardTitle>Performans KPI'ları</CardTitle>
                  </div>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addKPI} className="rounded-full h-8">
                  <Plus className="h-4 w-4 mr-1" />
                  Ekle
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {kpis.map((kpi, idx) => (
                <div key={idx} className="p-4 rounded-xl bg-surface-container-low border border-border/40 space-y-3 relative group">
                  <button 
                    type="button" 
                    onClick={() => removeKPI(idx)}
                    className="absolute top-2 right-2 text-muted-foreground hover:text-error opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>

                  <div className="flex flex-col sm:flex-row gap-4 items-end">
                    <div className="flex-1 space-y-2 w-full">
                      <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">KPI Seçimi</Label>
                      <Select 
                        onValueChange={(val) => {
                          const template = KPI_TEMPLATES.find(t => t.code === val)
                          if (template) {
                            updateKPI(idx, {
                              code: template.code,
                              name: template.name,
                              is_custom: false
                            })
                          } else {
                            updateKPI(idx, {
                              code: 'ozel_kpi',
                              is_custom: true
                            })
                          }
                        }} 
                        value={kpi.is_custom ? 'ozel_kpi' : kpi.code}
                      >
                        <SelectTrigger className="h-9 text-xs bg-surface-container-highest/50 border-none">
                          <SelectValue placeholder="KPI Seç" />
                        </SelectTrigger>
                        <SelectContent>
                          {KPI_TEMPLATES.map(t => (
                            <SelectItem key={t.code} value={t.code}>{t.name}</SelectItem>
                          ))}
                          <SelectItem value="ozel_kpi">Özel KPI...</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="w-full sm:w-[130px] space-y-2">
                      <div className="flex justify-between items-center h-[15px]">
                        <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Gerçekleşme</Label>
                        <span className="text-[10px] font-bold text-on-primary-container">%{kpi.value}</span>
                      </div>
                      <Input 
                        type="number"
                        value={kpi.value}
                        onChange={(e) => updateKPI(idx, { value: Number(e.target.value) })}
                        className="h-9 text-xs bg-surface-container-highest/50 border-none"
                      />
                    </div>
                  </div>

                  {kpi.is_custom && (
                    <div className="space-y-2 mt-2">
                      <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold text-xs">Özel KPI Adı</Label>
                      <Input 
                        value={kpi.name}
                        onChange={(e) => updateKPI(idx, { name: e.target.value })}
                        className="h-9 text-xs bg-surface-container-highest/50 border-none"
                        placeholder="KPI Adı giriniz"
                      />
                    </div>
                  )}
                </div>
              ))}
              {kpis.length === 0 && (
                <div className="text-center py-6 border-2 border-dashed border-border/20 rounded-xl">
                  <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground/50">KPI Listesi Boş</p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex flex-col gap-3 pt-4">
             <SubmitButton className="w-full bg-on-primary-container text-surface hover:bg-on-primary-container/90 h-14 text-sm font-bold uppercase tracking-widest rounded-full shadow-lg shadow-on-primary-container/20">
               {initialData ? 'Personayı Güncelle' : 'Personayı Kaydet'}
             </SubmitButton>
          </div>
        </div>
      </div>
    </form>
  )
}
