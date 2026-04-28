'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useServerAction } from '@/hooks/useServerAction'
import { createScenarioAction, updateScenarioAction } from '@/lib/actions/scenario.actions'
import type { Scenario, Persona } from '@/types'

interface ScenarioFormProps {
  personas: Persona[]
  initialScenario?: Scenario
  isEdit?: boolean
}

const RUBRIC_SKILLS = [
  { code: 'active_listening', name: 'Aktif Dinleme' },
  { code: 'powerful_questions', name: 'Güçlü Soru Sorma' },
  { code: 'summarizing', name: 'Özetleme' },
  { code: 'empathy', name: 'Empati' },
  { code: 'action_clarity', name: 'Aksiyon Netleştirme' },
  { code: 'non_judgmental', name: 'Yargısız Dil' },
]

export function ScenarioForm({ personas, initialScenario, isEdit }: ScenarioFormProps) {
  const router = useRouter()
  const [selectedSkills, setSelectedSkills] = useState<string[]>(initialScenario?.target_skills ?? [])
  const [selectedPersona, setSelectedPersona] = useState(initialScenario?.persona_id ?? '')
  const [selectedDifficulty, setSelectedDifficulty] = useState(String(initialScenario?.difficulty_level ?? '3'))

  const { execute, isPending } = useServerAction(
    isEdit && initialScenario
      ? async (fd: FormData) => updateScenarioAction(initialScenario.id, fd)
      : createScenarioAction,
    {
      onSuccess: () => router.push('/tenant/scenarios'),
    }
  )

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    formData.set('target_skill_codes', JSON.stringify(selectedSkills))
    formData.set('persona_id', selectedPersona)
    formData.set('difficulty', selectedDifficulty)
    execute(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <div className="space-y-2">
        <Label htmlFor="title">Senaryo Başlığı *</Label>
        <Input
          id="title"
          name="title"
          placeholder="Senaryo başlığını girin"
          defaultValue={initialScenario?.title}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Açıklama *</Label>
        <Textarea
          id="description"
          name="description"
          placeholder="Senaryo açıklaması"
          rows={4}
          defaultValue={initialScenario?.description}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="persona">Persona *</Label>
          <Select value={selectedPersona} onValueChange={setSelectedPersona}>
            <SelectTrigger id="persona">
              <SelectValue placeholder="Persona seçin" />
            </SelectTrigger>
            <SelectContent>
              {personas.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="difficulty">Zorluk Seviyesi *</Label>
          <Select value={selectedDifficulty} onValueChange={setSelectedDifficulty}>
            <SelectTrigger id="difficulty">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4, 5].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n === 1 && 'Çok Kolay'}
                  {n === 2 && 'Kolay'}
                  {n === 3 && 'Orta'}
                  {n === 4 && 'Zor'}
                  {n === 5 && 'Çok Zor'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-3">
        <Label>Hedef Beceriler</Label>
        <div className="grid grid-cols-2 gap-3">
          {RUBRIC_SKILLS.map((skill) => (
            <label key={skill.code} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                value={skill.code}
                checked={selectedSkills.includes(skill.code)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedSkills([...selectedSkills, skill.code])
                  } else {
                    setSelectedSkills(selectedSkills.filter((s) => s !== skill.code))
                  }
                }}
                className="rounded"
              />
              <span className="text-sm">{skill.name}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="role_context">Persona Rol Bağlamı</Label>
        <Textarea
          id="role_context"
          name="role_context"
          placeholder="Bu personanın senaryodaki sorumluluklarını ve rolünü açıklayın. (ör: Satış ekibi lideri, Anadolu bölgesi sorumlusu, aylık kota 150 ünite...)"
          rows={4}
          defaultValue={initialScenario?.role_context ?? ''}
        />
        <p className="text-xs text-muted-foreground">
          Bu bilgi AI konuşmasına enjekte edilir — persona&apos;yı daha gerçekçi ve bağlamsal kılar. Şirket bilgisi buraya değil, Kurum Profili&apos;ne ekleyin.
        </p>
      </div>

      <input type="hidden" name="sector_tags" value={JSON.stringify([])} />

      <div className="flex gap-3 pt-6">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Kaydediliyor...' : isEdit ? 'Güncelle' : 'Oluştur'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/tenant/scenarios')}
        >
          İptal
        </Button>
      </div>
    </form>
  )
}
