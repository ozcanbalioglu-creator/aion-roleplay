# Pre-Launch Phase 1 — Persona Roleplay Sözleşmesi (Parametrikleşme)

**Hazırlık tarihi:** 2026-04-26
**Hedef tamamlanma:** 1 Mayıs 2026 öncesi (3-4 gün pencere)
**Durum:** Plan onayda, implementasyon beklemede
**Risk seviyesi:** Düşük — backward-compatible, mevcut davranış korunur

---

## Bağlam

Mevcut implementasyon **doğru** ürün davranışını sergiliyor: kullanıcı koç rolünde, AI persona çalışan rolünde, rubric kullanıcının koçluk becerilerini değerlendirir. Ancak bu kontratlar `system-prompt.builder.ts` ve `VoiceSessionClient.tsx` içinde hard-coded. Future pivot ya da yeni roleplay türleri eklemek için engineering işi gerekir.

Phase 1'in amacı: **mevcut davranışı bozmadan**, roleplay sözleşmesini persona kaydının parçası haline getirmek. Hard-code'u kaldırmak ama davranışı aynen korumak. Backward-compatible fallback'lerle launch riski sıfır.

Phase 2 (kapsamı `Post_Launch_Phase_2.md`'de) bu temel üzerine evaluation target, phase taxonomy, mode preset sistemi ekler.

## Hedefler

1. `personas` tablosuna 2 yeni opsiyonel kolon: `roleplay_contract`, `opening_directive`.
2. PersonaForm'a "Roleplay Sözleşmesi" kartı; süper admin metni düzenleyebilir.
3. `system-prompt.builder.ts`'in hard-coded `roleReminder` bölümü, persona kaydından okunan değere döner. Boşsa current default text fallback olarak kalır (zero-regression garantisi).
4. Greeting trigger metni client'tan generic hale gelir; spesifik açılış davranışı persona kaydından gelir.
5. Mevcut 5 persona için seed migration: current `roleReminder` metni `roleplay_contract` kolonuna yazılır.

## Hedeflenmeyen (Phase 2'ye bırakılan)

- `roleplay_mode` kolonu ve mode preset sistemi
- `phase_taxonomy` JSONB kolonu (faz isimleri ve min turlar)
- `evaluation_target` kolonu (kim değerlendirilir)
- Mode-aware rubric seçimi
- Form'da mode dropdown ve preset prefill

## Detaylı İş Paketleri

### P1A — Migration

**Dosya:** `supabase/migrations/20260427_047_persona_roleplay_contract.sql` (yeni)

```sql
-- 047_persona_roleplay_contract.sql
-- Roleplay sözleşmesi kolonlarını personas tablosuna ekler.
-- Hard-coded roleReminder ve greeting trigger içeriklerini DB'ye taşır.

ALTER TABLE personas
  ADD COLUMN IF NOT EXISTS roleplay_contract TEXT,
  ADD COLUMN IF NOT EXISTS opening_directive TEXT;

COMMENT ON COLUMN personas.roleplay_contract IS
  'Roleplay rol sözleşmesi: kim hangi rolde, kim soru sorar, kim cevap verir. system-prompt.builder.ts persona prompt''undan sonra ekler.';
COMMENT ON COLUMN personas.opening_directive IS
  'Persona''nın seans başında nasıl davranacağını belirten direktif. Greeting trigger bu metni LLM''e iletir.';

-- Mevcut personalar için default seed (current behavior'ı koruyor)
UPDATE personas
SET roleplay_contract = $$Bu rol-play'de SEN çalışan/personel rolündesin. Konuştuğun kişi (kullanıcı) senin yöneticindir/koçundur.

DAVRANIŞ KURALLARI (kesin):
- Kullanıcı seninle koçluk pratiği yapıyor — SENİ koçluyor.
- SEN soru SORMAZSIN — sen sorulara cevap verirsin, durumunu paylaşırsın.
- SEN tavsiye VERMEZSİN — sen tavsiye alırsın.
- SEN konuyu yönetmezsin — kullanıcı yönetir, sen takip edersin.
- "Sana nasıl yardımcı olabilirim?", "Ne hissediyorsun?" gibi koç sorularını SEN sorma.
- Kullanıcı kötü/yetersiz koçluk yapsa bile onu kurtarmaya çalışma — kendi karakterinde kal. Sıkılırsan sıkıl, kafan karışırsa karışsın, savunmaya geç.
- Kendini tanıtma cümleleri ("Ben buradayım seni dinlemek için...") koç cümlesidir, KULLANMA.

Sen sahnedeki KARAKTERSİN, seyirci değil. Kullanıcının çıkacağı yolu sen göstermezsin; sen sadece kendi rolünü oynarsın.$$
WHERE roleplay_contract IS NULL;

UPDATE personas
SET opening_directive = $$Kullanıcı yöneticin/koçun olarak seni odasına çağırdı. Karakterine uygun, kısa bir selam ver (örn. "Merhaba {USER_NAME} Bey, çağırdığınızı duydum, geldim."). Hiçbir koç sorusu sorma, hiçbir bağlam kurma, hiçbir özet yapma — sadece selamla ve sus. Konuşmayı yönetici/koç başlatacak.$$
WHERE opening_directive IS NULL;

NOTIFY pgrst, 'reload schema';
```

**Acceptance:**
- Migration idempotent (re-run güvenli)
- Mevcut personaların `roleplay_contract` ve `opening_directive` kolonları dolu
- Yeni persona oluşturulurken kolonlar NULL olabilir

### P1B — Persona Form'u

**Dosya:** `src/components/admin/PersonaForm.tsx`

Sağ kolona `Ses Ayarı` kartından sonra **`Roleplay Sözleşmesi`** kartı eklenir. İki textarea + helpful placeholder.

```tsx
<Card>
  <CardHeader>
    <CardTitle>Roleplay Sözleşmesi</CardTitle>
    <CardDescription>
      Persona'nın rol-play içindeki sözleşmesi: kim hangi rolde, ne yapar, ne yapmaz.
      Boş bırakılırsa platform default sözleşmesi (kullanıcı koç, AI çalışan) kullanılır.
    </CardDescription>
  </CardHeader>
  <CardContent className="space-y-6">
    <div className="space-y-2">
      <Label htmlFor="roleplay_contract">Rol Sözleşmesi</Label>
      <Textarea
        id="roleplay_contract"
        name="roleplay_contract"
        defaultValue={initialData?.roleplay_contract ?? ''}
        placeholder="Bu rol-play'de SEN çalışan/personelsin. Konuştuğun kişi senin yöneticindir/koçundur. Sen sorulara cevap verirsin, soru sormazsın..."
        className="min-h-[200px] font-mono text-xs"
      />
      <p className="text-[11px] text-muted-foreground">
        AI'ın hangi rolde olduğunu, ne yaptığını/yapmadığını açıkça belirtin.
        Hard-coded direktiflere değil, bu metne göre davranır.
      </p>
    </div>

    <div className="space-y-2">
      <Label htmlFor="opening_directive">Seans Açılış Direktifi</Label>
      <Textarea
        id="opening_directive"
        name="opening_directive"
        defaultValue={initialData?.opening_directive ?? ''}
        placeholder="Kullanıcı yöneticin olarak seni çağırdı. Sadece kısa bir selam ver, sus. Konuşmayı kullanıcı başlatacak."
        className="min-h-[120px] font-mono text-xs"
      />
      <p className="text-[11px] text-muted-foreground">
        Seans başında persona'nın ilk hareketi. <code>{`{USER_NAME}`}</code> placeholder'ı runtime'da kullanıcı adıyla değiştirilir.
      </p>
    </div>
  </CardContent>
</Card>
```

**Acceptance:**
- Süper admin form'da iki yeni alanı görür
- Mevcut persona düzenlenirken alanlar dolu gelir (seed migration sayesinde)
- Yeni persona oluştururken boş bırakılabilir (placeholder yol gösterir)

### P1C — Server Actions

**Dosya:** `src/lib/actions/persona.actions.ts`

Zod schema, parse, insert, update'e iki alan eklenir.

```ts
const PersonaSchema = z.object({
  // ... mevcut alanlar
  roleplay_contract: z.string().trim().max(5000).optional().or(z.literal('')),
  opening_directive: z.string().trim().max(2000).optional().or(z.literal('')),
})

function parseRaw(formData: FormData) {
  return {
    // ... mevcut alanlar
    roleplay_contract: (formData.get('roleplay_contract') as string) || '',
    opening_directive: (formData.get('opening_directive') as string) || '',
  }
}

// createPersonaAction insert objesi:
{
  // ... mevcut alanlar
  roleplay_contract: parsed.data.roleplay_contract?.trim() || null,
  opening_directive: parsed.data.opening_directive?.trim() || null,
}

// updatePersonaAction update objesi: aynı şekilde
```

**Acceptance:**
- Form submit ile alanlar DB'ye yazılır
- Boş submit → DB'de NULL (NOT empty string)
- Max length validasyonu çalışır

### P1D — System Prompt Builder

**Dosya:** `src/lib/session/system-prompt.builder.ts`

Şu an hard-coded olan `roleReminder` bölümü persona kaydından okunur. Boşsa **current default text fallback** olarak kalır (regression garantisi).

```ts
// Persona SELECT'ine roleplay_contract ekle
.from('personas')
.select(`
  id, name, title, personality_type, emotional_baseline,
  resistance_level, cooperativeness, trigger_behaviors,
  coaching_tips, coaching_context,
  roleplay_contract,        // <-- yeni
  opening_directive,        // <-- yeni (P1E için lazım, ileride zaten gerekecek)
  persona_kpis(...),
  persona_prompt_versions(content_encrypted)
`)

// Builder içinde:
const DEFAULT_ROLE_CONTRACT = `Bu rol-play'de SEN çalışan/personel rolündesin... [current roleReminder body]`

const personaContract = (persona.roleplay_contract as string | null)?.trim() || DEFAULT_ROLE_CONTRACT
const roleReminder = `\n\n## Roleplay Sözleşmesi\n${personaContract}`
```

`DEFAULT_ROLE_CONTRACT` constant'ı seed migration ile birebir aynı içeriğe sahip — fallback path == DB path == zero regression.

**Acceptance:**
- DB'de `roleplay_contract` dolu olan persona için: o metin kullanılır
- DB'de NULL olan persona için: default text kullanılır
- Mevcut 5 persona için davranış aynı kalır
- Builder hard-coded `roleReminder` literal'ini içermez (sadece `DEFAULT_ROLE_CONTRACT` fallback için)

### P1E — Greeting Trigger Generic'leşir

**Dosya:** `src/components/sessions/VoiceSessionClient.tsx`

Şu an client'taki `greetBody` "yöneticin/koçun olarak seni çağırdı" gibi spesifik metin içeriyor. Bunu generic yapıp persona'nın `opening_directive` kolonu içeriği bunun yerine geçer.

**Yaklaşım A (basit):** Client `[GREETING_TRIGGER]` sinyali gönderir; chat route persona'nın `opening_directive` kolonunu okur ve LLM'e bu direktifi sistem prompt'a ek olarak iletir.

**Yaklaşım B (basit ama farklı):** Client persona'nın `opening_directive`'ini props olarak alır ({USER_NAME} interpolate eder), bunu `greetBody` olarak gönderir.

**Önerilen:** Yaklaşım B (server roundtripsiz, persona zaten page-level prop chain'de mevcut).

```ts
// session/[id]/page.tsx — VoiceSessionClient'a yeni prop:
const commonProps = {
  // ... mevcut props
  openingDirective: (session.personas as any)?.opening_directive ?? null,
}

// VoiceSessionClient'ta:
const DEFAULT_OPENING = `Kullanıcı yöneticin/koçun olarak seni odasına çağırdı. Karakterine uygun, kısa bir selam ver. Hiçbir koç sorusu sorma, hiçbir bağlam kurma — sadece selamla ve sus.`

const directive = openingDirective?.trim() || DEFAULT_OPENING
const interpolated = userName ? directive.replace(/\{USER_NAME\}/g, userName) : directive
const greetBody = `[SEANS_BAŞLAT] ${interpolated}`
const text = await sendTextToChat(`${GREETING_TRIGGER_PREFIX}${greetBody}`)
```

**Acceptance:**
- DB'de `opening_directive` dolu persona → o direktif kullanılır
- NULL → current default text kullanılır
- `{USER_NAME}` placeholder runtime'da değiştirilir
- Mevcut 5 persona için behavior aynı

### P1F — Test Senaryoları

**Manuel test (~30 dk):**

1. **Mevcut persona ile yeni seans aç (Ahmet Yılmaz):**
   - AI sadece kısa selam verir (current davranış)
   - SEN konuşmaya başlatırsın
   - AI cevap verir, sorular sormaz
   - ✓ behavior == pre-Phase-1

2. **Persona düzenle, `roleplay_contract` boşalt, kaydet, yeni seans aç:**
   - Builder default fallback'i kullanır
   - Davranış aynı kalır
   - ✓ NULL handling çalışıyor

3. **Persona düzenle, `roleplay_contract`'a custom metin yaz ("Sen koç ol, kullanıcı çalışan, sen sorular sor"), kaydet, yeni seans aç:**
   - AI bu sefer KOÇ gibi davranır
   - ✓ Parametrik akış çalışıyor

4. **Persona oluştur (yeni), iki alanı boş bırak, kaydet, seans aç:**
   - DEFAULT fallback kullanılır
   - ✓ Yeni persona da çalışır

5. **`opening_directive`'a `{USER_NAME}` içeren custom metin yaz:**
   - Runtime'da kullanıcı adı yerleşir
   - ✓ Interpolation çalışıyor

**Otomatik test (Vitest):** `system-prompt.builder.test.ts`'e:
- DB persona dolu → contract == DB value
- DB persona NULL → contract == DEFAULT_ROLE_CONTRACT
- 1 unit test her durum için yeterli

## Risk Yönetimi

| Risk | Olasılık | Etki | Mitigation |
|---|---|---|---|
| Migration `personas`'da kolon ekleme sırasında lock | Düşük | Düşük | Staging'de test, küçük tablo |
| Seed UPDATE binlerce satır → yavaş | Düşük | Düşük | 5 satır var; sub-second |
| Builder fallback çalışmazsa AI rolünü kaybeder | Çok düşük | Yüksek | DEFAULT_ROLE_CONTRACT == seed metni; ikisinin de unit test'i var |
| Form save fail → super admin paniklerse | Düşük | Düşük | Toast hata mesajı (zaten mevcut) |
| Hot-reload sırasında dev server cache | Orta | Düşük | `npm run dev` restart |

## Rollback Planı

Phase 1 fully reversible:
- Migration revert: `ALTER TABLE personas DROP COLUMN IF EXISTS roleplay_contract; DROP COLUMN IF EXISTS opening_directive`
- Code revert: previous git commit'e dön; hard-coded path zaten `DEFAULT_ROLE_CONTRACT` constant'ında saklı
- Migration uygulanmamışsa: kod path'i `roleplay_contract` SELECT eder ama Supabase NULL döner; DEFAULT kullanılır → regression yok

## Tahmini Süre

| Görev | Süre |
|---|---|
| P1A — Migration yazımı + staging test | 30 dk |
| P1B — PersonaForm UI | 45 dk |
| P1C — Action schema + parse | 30 dk |
| P1D — Builder fallback path | 45 dk |
| P1E — Greeting trigger refactor | 45 dk |
| P1F — Manuel test + 1-2 unit test | 60 dk |
| **Toplam** | **~4.5 saat** |

Tek oturum implementasyonla rahatça yetişir. 1 Mayıs riski yok.

## Definition of Done

- [ ] Migration 047 staging DB'de çalıştırıldı, seed UPDATE'ler verified
- [ ] PersonaForm'da iki textarea görünür, save çalışıyor
- [ ] Mevcut 5 persona için behavior pre-Phase-1 ile aynı (manuel test #1 yeşil)
- [ ] `roleplay_contract` boşaltılınca DEFAULT fallback çalışır (test #2 yeşil)
- [ ] Custom contract yazılınca AI yeni role uyar (test #3 yeşil)
- [ ] `npm run lint` + `npx tsc --noEmit` temiz
- [ ] CLAUDE.md, AGENTS.md, README.md güncellendi
- [ ] Kullanıcı (Özcan) onayı alındı

## Implementasyon Sonrası Açılan Yollar

Phase 1 tamamlandıktan sonra Phase 2'nin yapı taşları kurulmuş olur:
- Phase 2'de `roleplay_mode`, `phase_taxonomy`, `evaluation_target` kolonları eklendiğinde sadece persona kaydı genişler — schema breaking change yok
- Mode preset sistemi, mevcut `roleplay_contract` field'ını pre-fill amacıyla kullanır
- Pivot scenario testi (kullanıcı = koçluk gören) Phase 1 sonrası tek persona kaydı düzenlemesiyle deneyebilir hale gelir
