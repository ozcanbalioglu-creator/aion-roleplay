/**
 * SubHeaderShell — Seans akışındaki tüm sub-header'ların paylaştığı tek görsel kabuk.
 *
 * Kullanım:
 *   - /dashboard/sessions/new (stepper)
 *   - /dashboard/sessions/[id] (canlı seans top bar)
 *
 * Hem yükseklik, hem arkaplan, hem padding ve font seviyesi tek noktadan yönetilir →
 * üç ekran arasında görsel sürtünme yok, kullanıcı dikkati boşa harcanmaz.
 */

interface SubHeaderShellProps {
  children: React.ReactNode
}

export function SubHeaderShell({ children }: SubHeaderShellProps) {
  return (
    <div
      // Solid dark — translucent + blur arkadaki light bg'yi geçirip persona listesi sayfasında
      // gri/lavanta görünüyordu. #0f0e22 = gradient'in en koyu durağı, üç sayfada da aynı renk.
      className="flex items-center justify-between gap-3 px-6 h-14 flex-shrink-0 z-20"
      style={{
        background: '#0f0e22',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {children}
    </div>
  )
}
