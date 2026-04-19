export default function AuthLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Sol panel: Marka alanı */}
      <div className="hidden lg:flex flex-col bg-sidebar p-8 text-sidebar-foreground">
        <div className="flex items-center gap-3 mb-auto">
          <div className="h-10 w-10 rounded-xl bg-sidebar-primary flex items-center justify-center">
            <span className="text-sidebar-primary-foreground font-bold text-lg">R</span>
          </div>
          <div>
            <p className="font-bold text-lg leading-tight">Roleplay Platform</p>
            <p className="text-sidebar-foreground/60 text-xs">Koçluk Becerisi Geliştirme</p>
          </div>
        </div>

        <blockquote className="mt-auto">
          <p className="text-lg font-medium leading-relaxed text-sidebar-foreground/90">
            "Gerçek koçluk, öğretmek değil — keşfettirmektir."
          </p>
          <footer className="mt-3 text-sm text-sidebar-foreground/60">
            — ICF Koçluk İlkeleri
          </footer>
        </blockquote>
      </div>

      {/* Sağ panel: Form alanı */}
      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          {children}
        </div>
      </div>
    </div>
  )
}
