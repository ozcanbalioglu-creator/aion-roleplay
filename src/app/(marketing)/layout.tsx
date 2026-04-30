import './landing.css'

export const metadata = {
  title: 'AION Mirror — AI Destekli Koçluk Pratiği Platformu | Yöneticiler İçin',
  description:
    "Yöneticilerinizin koçluk becerisini AI personalarıyla pratiğe dönüştürün. ICF rubric tabanlı detaylı raporlama. Demo için iletişime geçin.",
  robots: { index: true, follow: true },
}

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return <div className="landing-root">{children}</div>
}
