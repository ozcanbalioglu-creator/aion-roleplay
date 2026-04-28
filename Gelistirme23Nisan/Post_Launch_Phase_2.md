# Post-Launch Phase 2 — Tam Parametrik Roleplay Mimarisi

**Hazırlık tarihi:** 2026-04-26
**Önkoşul:** `Pre_Launch_Phase_1.md` tamamlanmış olmalı
**Hedef başlangıç:** 1 Mayıs launch sonrası, ilk kullanım sinyalleri alındıktan sonra
**Risk seviyesi:** Orta — mimari değişiklik; kapsamlı test gerekir
**Önerilen pencere:** 2-3 hafta

---

## Bağlam

Phase 1, persona'nın **rol sözleşmesini** ve **açılış direktifini** parametrik yaptı. Davranış aynı kaldı, sadece içerik DB'ye taşındı. Phase 2 bunun üzerine **mode preset sistemi**, **dinamik faz taksonomisi**, **evaluation hedefi**, ve **mode-aware rubric** ekler.

Sonuç: yeni roleplay türleri (mentee koçluk alıyor, mülakatçı pratiği, satış pitch) **kod değişikliği olmadan** süper admin tarafından eklenebilir hale gelir.

## Hedefler

1. Persona'ya 3 yeni kolon: `roleplay_mode`, `phase_taxonomy` (JSONB), `evaluation_target`
2. Mode preset sistemi (kod constant'ı): 4 starter mode
3. PersonaForm'da mode dropdown → 4 alanı pre-fill ederek yön gösterir
4. `system-prompt.builder.ts` faz direktiflerini `phase_taxonomy`'den dinamik üretir
5. `evaluation.engine.ts` `evaluation_target` kolonunu okur; user'ı veya persona'yı değerlendirir
6. Yeni rubric template'leri (mentee growth, sales objection handling) için seed migration
7. Mode-spesifik rubric eşleşmesi (her mode kendi rubric template'ini önerir)

## Hedeflenmeyen (Phase 3'e bırakılan)

- Tenant'a özel mode preset'leri (super admin yerine tenant admin'in mode oluşturması)
- Custom rubric editor UI içinden mode-bind mekanizması
- Çok-kullanıcılı (multi-party) roleplay (örn 3-4 kişilik panel)
- Realtime WebRTC tabanlı eş-zamanlı sesli persona

## Önerilen Mode Preset'leri

Kod konum: `src/lib/session/roleplay-modes.ts` (yeni dosya, constant export).

```ts
export interface RoleplayModePreset {
  code: string                                       // 'coaching_user_as_coach'
  label: string                                      // 'Koçluk — Kullanıcı Koç Rolünde'
  description: string
  persona_role_label: string                         // 'çalışan/personel'
  user_role_label: string                            // 'yönetici/koç'
  initiator: 'user' | 'persona'
  evaluation_target: 'user' | 'persona'
  default_roleplay_contract: string                  // textarea pre-fill için
  default_opening_directive: string
  default_phase_taxonomy: PhaseTaxonomy
  recommended_rubric_template: string                // rubric_templates.code referansı
  is_locked: boolean                                 // platform default'ları kilitli (rename ok, content ok)
}

export interface PhaseTaxonomy {
  phases: Array<{
    code: string
    label: string
    min_turns: number
    description: string
  }>
  session_end_min_turns: number                      // toplam alt sınır (örn 13)
}

export const ROLEPLAY_MODES: RoleplayModePreset[] = [
  {
    code: 'coaching_user_as_coach',
    label: 'Koçluk — Kullanıcı Koç Rolünde',
    description: 'Yöneticiler kendi koçluk becerilerini pratik eder. AI personel rolünde, ICF rubric kullanıcıyı değerlendirir.',
    persona_role_label: 'çalışan/personel',
    user_role_label: 'yönetici/koç',
    initiator: 'user',
    evaluation_target: 'user',
    default_roleplay_contract: `Bu rol-play'de SEN çalışan/personel rolündesin. Kullanıcı yöneticindir/koçundur.
- SEN soru sormazsın, sen cevap verirsin.
- SEN tavsiye vermezsin, sen tavsiye alırsın.
- Konuşmayı kullanıcı yönetir, sen takip edersin.
- Kullanıcı kötü koçluk yapsa bile rolünden çıkma.`,
    default_opening_directive: `Kullanıcı yöneticin/koçun olarak seni odasına çağırdı. Karakterine uygun, kısa bir selam ver. Hiçbir koç sorusu sorma — sadece selamla ve sus. Konuşmayı kullanıcı başlatacak.`,
    default_phase_taxonomy: {
      phases: [
        { code: 'opening', label: 'Açılış', min_turns: 3, description: 'Kullanıcı tanışıyor, bağlamı açıyor.' },
        { code: 'exploration', label: 'Keşif', min_turns: 4, description: 'Kullanıcı durumu keşfediyor, açık uçlu sorular soruyor.' },
        { code: 'deepening', label: 'Derinleşme', min_turns: 3, description: 'Kullanıcı duygu/varsayım/derin neden sorguluyor.' },
        { code: 'action', label: 'Aksiyon', min_turns: 2, description: 'Kullanıcı seninle aksiyon planı kuruyor.' },
        { code: 'closing', label: 'Kapanış', min_turns: 1, description: 'Kullanıcı seansı kapatma sinyali veriyor.' },
      ],
      session_end_min_turns: 13,
    },
    recommended_rubric_template: 'icf_coaching_8d',
    is_locked: true,
  },
  {
    code: 'coaching_user_as_coachee',
    label: 'Koçluk — Kullanıcı Koçluk Alan',
    description: 'Kullanıcı koçluk pratiği görür. AI koç rolünde, kullanıcının "koçlanan" olarak gelişimi rubric ile değerlendirilir.',
    persona_role_label: 'koç/mentor',
    user_role_label: 'mentee/koçluk alan',
    initiator: 'persona',
    evaluation_target: 'persona',
    default_roleplay_contract: `Bu rol-play'de SEN deneyimli bir koç/mentor rolündesin. Kullanıcı sana koçluk görüşmesi için geldi.
- SEN açık uçlu sorular sorarsın, derinleşme sağlarsın.
- Tavsiye vermek yerine kullanıcının kendi içgörüsünü zorlarsın.
- Empati gösterir, yansıtma yaparsın, varsayımları sorgularsın.
- Aksiyona doğru ilerlersin, taahhüt alırsın.`,
    default_opening_directive: `Kullanıcı sana koçluk seansı için geldi. Sıcak ama profesyonel bir karşılama yap, ne hakkında konuşmak istediğini sor.`,
    default_phase_taxonomy: {
      phases: [
        { code: 'opening', label: 'Açılış', min_turns: 2, description: 'Karşılama, gündem belirleme.' },
        { code: 'exploration', label: 'Keşif', min_turns: 4, description: 'Kullanıcının durumunu keşfetme.' },
        { code: 'deepening', label: 'Derinleşme', min_turns: 3, description: 'Duygu ve varsayımları sorgulama.' },
        { code: 'action', label: 'Aksiyon', min_turns: 2, description: 'Aksiyon planı kurma.' },
        { code: 'closing', label: 'Kapanış', min_turns: 1, description: 'Özet ve takip planı.' },
      ],
      session_end_min_turns: 12,
    },
    recommended_rubric_template: 'coachee_growth_5d',                  // YENİ rubric (mentee gelişimi)
    is_locked: true,
  },
  {
    code: 'sales_user_as_seller',
    label: 'Satış — Kullanıcı Satıcı Rolünde',
    description: 'Saha temsilcileri/satış ekibi pitch ve itiraz yönetimi pratik eder. AI müşteri rolünde, kullanıcının satış becerileri değerlendirilir.',
    persona_role_label: 'müşteri/karar verici',
    user_role_label: 'satıcı/temsilci',
    initiator: 'user',
    evaluation_target: 'user',
    default_roleplay_contract: `Bu rol-play'de SEN bir potansiyel müşteri/karar vericisin. Kullanıcı sana ürün/hizmet sunmaya çalışıyor.
- Karakter özelliklerine ve direnç seviyene uygun şekilde itirazlar et.
- Kullanıcı iyi pitch yaparsa açıl, kötü yaparsa kapan.
- Persona'na göre soğuk, kararsız ya da kıyaslayıcı ol.
- Kendin satıcılık yapma, sadece müşteri olarak tepki ver.`,
    default_opening_directive: `Kullanıcı senden zamanını rica ederek geldi. Kısa, biraz mesafeli bir karşılama yap; "Buyurun, vakti boşa harcamayalım" tarzı.`,
    default_phase_taxonomy: {
      phases: [
        { code: 'rapport', label: 'Yakınlık Kurma', min_turns: 2, description: 'Kullanıcı ilişki kuruyor.' },
        { code: 'discovery', label: 'İhtiyaç Keşfi', min_turns: 3, description: 'Kullanıcı senin ihtiyaçlarını anlıyor.' },
        { code: 'pitch', label: 'Sunum', min_turns: 3, description: 'Kullanıcı çözümü sunuyor.' },
        { code: 'objection', label: 'İtiraz', min_turns: 3, description: 'Sen itiraz ediyorsun, kullanıcı yanıt veriyor.' },
        { code: 'close', label: 'Kapanış', min_turns: 2, description: 'Kullanıcı taahhüt almaya çalışıyor.' },
      ],
      session_end_min_turns: 13,
    },
    recommended_rubric_template: 'sales_skills_6d',                    // YENİ rubric
    is_locked: true,
  },
  {
    code: 'interview_user_as_interviewer',
    label: 'Mülakat — Kullanıcı Mülakatçı Rolünde',
    description: 'İK ve yöneticiler mülakat yapma pratiği eder. AI aday rolünde, kullanıcının mülakat becerileri değerlendirilir.',
    persona_role_label: 'aday',
    user_role_label: 'mülakatçı',
    initiator: 'user',
    evaluation_target: 'user',
    default_roleplay_contract: `Bu rol-play'de SEN bir iş başvurusunda bulunan adaysın. Kullanıcı seni mülakata aldı.
- Sorulara cevap verirsin, kendi sorularını da sorabilirsin (aday sorusu).
- Karakterine uygun şekilde gerginlik, özgüven ya da deneyim sergile.
- Kullanıcının soru kalitesine göre açıklığını ayarla.`,
    default_opening_directive: `Kullanıcı seni mülakat odasına aldı. Profesyonel bir selam ver, otur, hazır olduğunu söyle. İlk soruyu kullanıcı soracak.`,
    default_phase_taxonomy: {
      phases: [
        { code: 'opening', label: 'Açılış', min_turns: 2, description: 'Karşılama, kendini tanıtma.' },
        { code: 'experience', label: 'Deneyim', min_turns: 3, description: 'Geçmiş deneyimler değerlendirilir.' },
        { code: 'behavioral', label: 'Davranışsal', min_turns: 3, description: 'STAR formatı sorular.' },
        { code: 'aday_questions', label: 'Aday Soruları', min_turns: 2, description: 'Aday sorular soruyor.' },
        { code: 'closing', label: 'Kapanış', min_turns: 1, description: 'Veda, sonraki adımlar.' },
      ],
      session_end_min_turns: 11,
    },
    recommended_rubric_template: 'interview_skills_6d',                // YENİ rubric
    is_locked: true,
  },
]

export function getModeByCode(code: string | null | undefined): RoleplayModePreset | undefined {
  return ROLEPLAY_MODES.find((m) => m.code === code)
}
```

## Detaylı İş Paketleri

### P2A — Migration (Persona Schema Genişletme)

**Dosya:** `supabase/migrations/20260510_048_persona_roleplay_full.sql`

```sql
-- 048_persona_roleplay_full.sql
-- Phase 2: Mode preset sistemi, faz taksonomisi, evaluation target.

ALTER TABLE personas
  ADD COLUMN IF NOT EXISTS roleplay_mode TEXT,
  ADD COLUMN IF NOT EXISTS phase_taxonomy JSONB,
  ADD COLUMN IF NOT EXISTS evaluation_target TEXT
    CHECK (evaluation_target IS NULL OR evaluation_target IN ('user', 'persona'));

COMMENT ON COLUMN personas.roleplay_mode IS
  'Mode preset kodu (örn: coaching_user_as_coach). roleplay-modes.ts içindeki ROLEPLAY_MODES referansı. Audit için saklanır; içerik override edilmiş olabilir.';
COMMENT ON COLUMN personas.phase_taxonomy IS
  'Faz taksonomisi: phases dizisi (code, label, min_turns) + session_end_min_turns. Boşsa platform default coaching fazları kullanılır.';
COMMENT ON COLUMN personas.evaluation_target IS
  '''user'' = kullanıcının skoru hesaplanır; ''persona'' = AI persona perspektifinden değerlendirme yapılır. Default ''user''.';

-- Mevcut personalar için: hepsi current behavior'da kullanıcıyı koç olarak değerlendiriyordu
UPDATE personas
SET roleplay_mode = 'coaching_user_as_coach',
    evaluation_target = 'user'
WHERE roleplay_mode IS NULL;

NOTIFY pgrst, 'reload schema';
```

**Acceptance:**
- 3 yeni kolon eklendi
- Mevcut personaların `roleplay_mode = 'coaching_user_as_coach'` ve `evaluation_target = 'user'`
- `phase_taxonomy` NULL bırakılır (default phase logic'i fallback olarak çalışır)

### P2B — Mode Preset Constants

**Dosya:** `src/lib/session/roleplay-modes.ts` (yeni)

Yukarıdaki `ROLEPLAY_MODES` constant'ı + `getModeByCode()`, `interpolateOpeningDirective()` helper'ları.

### P2C — Yeni Rubric Templates

**Dosya:** `supabase/migrations/20260511_049_roleplay_rubric_templates.sql`

3 yeni rubric template seed edilir:
- `coachee_growth_5d` — Mentee Gelişim Rubric'i (5 boyut: öz-farkındalık, açıklık, içgörü, taahhüt, takip)
- `sales_skills_6d` — Satış Becerileri (6 boyut: rapport, ihtiyaç keşfi, sunum, itiraz yönetimi, kapanış, post-sales)
- `interview_skills_6d` — Mülakat Becerileri (6 boyut: yapı, açık uçlu sorular, dinleme, takip soruları, value-fit değerlendirme, kapanış)

Her biri `is_locked = true` (platform default) olarak seed edilir; tenant admin pasifleştirebilir ama silemez.

### P2D — PersonaForm Mode Dropdown + Pre-fill

**Dosya:** `src/components/admin/PersonaForm.tsx`

Üst kısma "Roleplay Modu" dropdown'ı eklenir. Seçim yapılınca form'daki 4 alan (`roleplay_contract`, `opening_directive`, `phase_taxonomy`, `evaluation_target`) preset default değerleriyle pre-fill edilir. Kullanıcı isterse her birini override edebilir.

```tsx
<Card>
  <CardHeader>
    <CardTitle>Roleplay Modu</CardTitle>
    <CardDescription>
      Hazır preset seçerek hızlı başlayın. Tüm alanları manuel düzenleyebilirsiniz.
    </CardDescription>
  </CardHeader>
  <CardContent>
    <Select
      value={selectedMode}
      onValueChange={(code) => {
        setSelectedMode(code)
        const mode = getModeByCode(code)
        if (mode) {
          setRoleplayContract(mode.default_roleplay_contract)
          setOpeningDirective(mode.default_opening_directive)
          setPhaseTaxonomy(mode.default_phase_taxonomy)
          setEvaluationTarget(mode.evaluation_target)
        }
      }}
    >
      <SelectContent>
        {ROLEPLAY_MODES.map((m) => (
          <SelectItem key={m.code} value={m.code}>
            {m.label}
            <span className="text-xs text-muted-foreground ml-2">{m.description}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </CardContent>
</Card>
```

`phase_taxonomy` için ayrı bir editör component'i (PhaseTaxonomyEditor) — faz ekleme/silme/sıralama, JSON-friendly UI.

### P2E — System Prompt Builder Dinamik Faz

**Dosya:** `src/lib/session/system-prompt.builder.ts`

`phaseDirectives`'i hard-coded faz listesinden dinamik hale getir.

```ts
const taxonomy: PhaseTaxonomy = (persona.phase_taxonomy as PhaseTaxonomy | null)
  ?? DEFAULT_PHASE_TAXONOMY                                          // mevcut coaching fazları

const phaseLines = taxonomy.phases
  .map(p => `- **${p.code}** (en az ${p.min_turns} tur): ${p.description}`)
  .join('\n')

const phaseDirectives = `\n\n## Faz Takibi
Her yanıtının sonuna [PHASE:${taxonomy.phases.map(p => p.code).join('|')}] etiketi ekle...

${phaseLines}

[SESSION_END] marker'ı için en az ${taxonomy.session_end_min_turns} tur tamamlanmalı...`
```

### P2F — Evaluation Engine Mode-Aware

**Dosya:** `src/lib/evaluation/evaluation.engine.ts`

`persona.evaluation_target` okunur; `user` ise mevcut akış (kullanıcının koçluk skorları), `persona` ise farklı prompt template + rubric ile AI persona perspektifinden değerlendirme yapılır.

Yeni evaluation prompt template (`evaluation-prompt.builder.ts`):
- `evaluation_target = 'user'` → "Kullanıcı şu boyutlarda nasıl yaptı?" sorusu
- `evaluation_target = 'persona'` → "Kullanıcı bu seansta gelişim açısından şu boyutlarda neredeydi?" sorusu (mentee perspektifi)

`scenarios.rubric_template_id` veya `personas.recommended_rubric_template` üzerinden ilgili rubric çekilir; mode'a uygun rubric kullanılır.

### P2G — Greeting Trigger ve Phase Marker Doğrulayıcı

`VoiceSessionClient.tsx` greeting trigger zaten Phase 1'de generic. Phase 2'de marker stripping için `taxonomy.phases.map(p => p.code)` regex'i dinamik hale getirilir (yeni faz kodları kabul edilir).

### P2H — Test Senaryoları

**Mode başına manuel test (~3-4 saat):**

1. **`coaching_user_as_coach`** — Existing behavior, regression test
2. **`coaching_user_as_coachee`** — User asks for coaching, AI plays coach, evaluates user's "coachability"
3. **`sales_user_as_seller`** — User pitches, AI is customer, evaluates user's sales skills
4. **`interview_user_as_interviewer`** — User interviews, AI is candidate, evaluates user's interview skills

Her mode için: greeting davranışı, phase progression, rubric output kontrolü.

**E2E test:** Playwright ile her mode için 1 happy-path scenario.

## Risk Yönetimi

| Risk | Olasılık | Etki | Mitigation |
|---|---|---|---|
| Mevcut personaların `roleplay_mode` migration'da yanlış set edilirse | Düşük | Yüksek | Staging'de SELECT ile doğrulama, atomic UPDATE |
| Yeni rubric template'leri evaluation engine'le uyuşmazsa | Orta | Yüksek | Phase 2A öncesi 1 saatlik schema/contract review |
| `evaluation_target = 'persona'` akışı hiç test edilmediği için bozuk olabilir | Yüksek | Orta | İlk PR'da behind feature flag, kademeli rollout |
| Phase taxonomy değişimi mevcut session phase'lerini orphan bırakabilir | Düşük | Düşük | `session_messages.phase` zaten TEXT; legacy değerler korunur |
| PersonaForm UX karmaşıklaşır | Orta | Orta | Mode dropdown'ı en üste koy, gelişmiş alanlar collapse |

## Rollback Planı

Phase 2 reversible ama Phase 1'e göre daha karmaşık:
- Migration revert: `ALTER TABLE personas DROP COLUMN ...` (3 kolon)
- Yeni rubric'ler: `DELETE FROM rubric_templates WHERE code IN (...)`
- Code revert: feature flag ile new mode'lar disable edilebilir
- Production verisi: yeni mode'larda yapılmış seans'lar kaybolmaz (session_messages legacy)

## Tahmini Süre

| Görev | Süre |
|---|---|
| P2A — Schema migration + seed | 1 gün |
| P2B — Mode preset constants | 0.5 gün |
| P2C — 3 yeni rubric template seed migration | 1 gün |
| P2D — PersonaForm mode dropdown + phase taxonomy editor | 2 gün |
| P2E — Builder dinamik faz | 1 gün |
| P2F — Evaluation engine mode-aware | 2 gün |
| P2G — Greeting + phase marker dinamik | 0.5 gün |
| P2H — Manuel + E2E test | 2 gün |
| **Toplam** | **~10 iş günü (~2 hafta)** |

## Definition of Done

- [ ] Migration 048 + 049 production'da çalıştırıldı
- [ ] 4 mode preset çalışıyor; her biri için manuel test yeşil
- [ ] PersonaForm mode dropdown ile 4 alanı doğru pre-fill ediyor
- [ ] PhaseTaxonomyEditor faz ekleme/silme yapıyor, JSON valid
- [ ] Builder dinamik phase directives üretiyor
- [ ] Evaluation `evaluation_target` ile doğru tarafı değerlendiriyor
- [ ] Yeni rubric'lerle evaluation çalışıyor (3 mode için spot-check)
- [ ] E2E Playwright test'leri yeşil
- [ ] CLAUDE.md, AGENTS.md, README.md, yol_haritasi_20260424.md güncellendi
- [ ] ADR-016 (mode preset mimarisi) `mimari_kararlar_20260423.md`'ye eklendi

## Phase 3 Yolu (Bilgi Amaçlı)

Phase 2 tamamlandıktan sonra olası ileri adımlar:
- **Tenant-spesifik mode preset'leri:** ROLEPLAY_MODES'u DB'ye taşımak (yeni `roleplay_modes` tablosu); tenant admin custom mode oluşturabilir
- **Multi-party roleplay:** 1 kullanıcı + 2-3 AI persona aynı seansta (panel mülakatı, ekip toplantısı)
- **Realtime WebRTC ses:** OpenAI Realtime API entegrasyonu (latency 500ms → 100ms)
- **Mode galerisi:** Marketplace tarzı şablon paylaşımı (tenants arası)
