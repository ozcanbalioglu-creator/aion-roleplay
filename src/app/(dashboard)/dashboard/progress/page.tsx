import { redirect } from 'next/navigation'

/**
 * P1-UX-001 / F4 — Dashboard + Gelişimim Sayfa Birleştirme (2026-05-01).
 *
 * Eski "Gelişimim" sayfası kaldırıldı; Dashboard tek kaynak hâline geldi.
 * Mevcut bookmark'lar ve eski linkler kırılmasın diye bu route kalıcı olarak
 * /dashboard'a yönlendiriyor. Sidebar/MobileNav/AppHeader'dan "Gelişim/Gelişimim"
 * referansları temizlendi.
 *
 * NOT: Progress sayfasında Dashboard'da olmayan tek benzersiz öğe 20 satırlık
 * son seanslar tablosuydu — o veri zaten /dashboard/sessions sayfasında var
 * (tam tablo + filtreler). Çift tablo tutmaya gerek yok.
 */
export default function ProgressPage() {
  redirect('/dashboard')
}
