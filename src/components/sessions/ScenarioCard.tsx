'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ClockIcon, TargetIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Scenario } from '../../types/index'

const DIFFICULTY_LABELS = ['', 'Başlangıç', 'Temel', 'Orta', 'İleri', 'Uzman']
const DIFFICULTY_COLORS = [
  '', 'text-green-600', 'text-teal-600', 'text-blue-600', 'text-orange-600', 'text-red-600'
]

interface ScenarioCardProps {
  scenario: Scenario
  onSelect: (id: string) => void
}

export function ScenarioCard({ scenario, onSelect }: ScenarioCardProps) {
  return (
    <Card
      className="cursor-pointer border transition-all hover:border-primary/50 hover:shadow-sm"
      onClick={() => onSelect(scenario.id)}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">{scenario.title}</CardTitle>
          <Badge
            variant="outline"
            className={cn('shrink-0 text-xs', DIFFICULTY_COLORS[scenario.difficulty_level])}
          >
            {DIFFICULTY_LABELS[scenario.difficulty_level]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground line-clamp-2">{scenario.description}</p>

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <ClockIcon className="h-3.5 w-3.5" />
            ~{scenario.estimated_duration_min} dk
          </span>
          {scenario.target_skills?.length > 0 && (
            <span className="flex items-center gap-1">
              <TargetIcon className="h-3.5 w-3.5" />
              {scenario.target_skills.length} hedef beceri
            </span>
          )}
        </div>

        {scenario.target_skills?.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {(scenario.target_skills as string[]).map((skill, i) => (
              <span
                key={i}
                className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
              >
                {skill}
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}