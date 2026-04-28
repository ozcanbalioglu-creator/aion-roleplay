import { Persona } from '../../types/index';
import { Badge } from '@/components/ui/badge';

const PERSONALITY_LABELS: Record<string, string> = {
  analytical: 'Analitik', driver: 'Sonuç Odaklı', expressive: 'Duygusal',
  amiable: 'Uyumlu', resistant: 'Dirençli', indifferent: 'İlgisiz',
};

const EMOTIONAL_LABELS: Record<string, string> = {
  positive: 'Pozitif', neutral: 'Nötr', negative: 'Negatif', volatile: 'Değişken',
};

export function PersonaMiniCard({ persona }: { persona: Persona }) {
  return (
    <div className="rounded-xl border bg-muted/30 p-4 space-y-4">
      <div>
        <p className="font-semibold">{persona.name}</p>
        <p className="text-sm text-muted-foreground">{persona.title}</p>
        {persona.department && (
          <p className="text-xs text-muted-foreground">{persona.department}</p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className="text-xs">
          {PERSONALITY_LABELS[persona.personality_type] ?? persona.personality_type}
        </Badge>
        <Badge variant="outline" className="text-xs">
          {EMOTIONAL_LABELS[persona.emotional_baseline] ?? persona.emotional_baseline}
        </Badge>
      </div>

      {/* KPI listesi (maksimum 5 göster) */}
      {(persona.persona_kpis?.length ?? 0) > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            KPI Profili
          </p>
          <div className="space-y-1">
            {(persona.persona_kpis ?? []).slice(0, 5).map((kpi: any) => (
              <div key={kpi.kpi_code} className="flex justify-between text-xs">
                <span className="text-muted-foreground">{kpi.kpi_name}</span>
                <span className="font-medium">
                  {kpi.value}{kpi.unit ? ` ${kpi.unit}` : ''}
                </span>
              </div>
            ))}
            {(persona.persona_kpis?.length ?? 0) > 5 && (
              <p className="text-xs text-muted-foreground">
                +{(persona.persona_kpis?.length ?? 0) - 5} daha...
              </p>
            )}
          </div>
        </div>
      )}

      {/* Tetikleyiciler */}
      {(persona.trigger_behaviors?.length ?? 0) > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Dikkat: Tetikleyiciler
          </p>
          <ul className="space-y-0.5">
            {(persona.trigger_behaviors as string[]).slice(0, 3).map((t, i) => (
              <li key={i} className="text-xs text-muted-foreground">• {t}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
