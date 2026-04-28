export default function AuthLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <main className="flex min-h-screen bg-background text-on-background overflow-hidden">
      {/* Left Side: Dark Narrative Section */}
      <section className="hidden lg:flex flex-col justify-between w-1/2 bg-on-background p-16 relative overflow-hidden">
        {/* Atmospheric Gradient Glow */}
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-primary-container opacity-30 blur-[100px]"></div>
        
        {/* Branding */}
        <div className="relative z-10">
          <img src="/aion_more_genis.png" alt="AION Mirror" className="h-20 w-auto" />
        </div>

        {/* Narrative Content */}
        <div className="relative z-10 max-w-lg mt-auto mb-16">
          <h1 className="text-5xl md:text-6xl font-headline text-surface leading-tight">
            Kendini <span className="italic text-on-primary-container">aynanda</span> gör.<br/>
            Daha iyi bir koç ol.
          </h1>
          <p className="mt-8 text-lg text-surface/60 font-body font-light leading-relaxed">
            Profesyonel gelişim yolculuğunda Coach gibi liderlik etmek üzere yetkinlikleri derinlemesine analiz eden ve yansıtan partneriniz.
          </p>
        </div>

        {/* Stats Module */}
        <div className="relative z-10 grid grid-cols-3 gap-8 pt-12 border-t border-surface/10">
          <div className="flex flex-col gap-2">
            <span className="text-surface font-headline italic text-2xl">14K+</span>
            <span className="font-label text-[10px] uppercase tracking-[0.2em] text-surface/40">Seans Analizi</span>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-surface font-headline italic text-2xl">92%</span>
            <span className="font-label text-[10px] uppercase tracking-[0.2em] text-surface/40">Memnuniyet</span>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[18px] text-on-primary-container">verified_user</span>
              <span className="text-surface font-headline italic text-2xl">ICF</span>
            </div>
            <span className="font-label text-[10px] uppercase tracking-[0.2em] text-surface/40">Yetkinlik Haritası</span>
          </div>
        </div>

        {/* Background Texture Image (Subtle) */}
        <div className="absolute inset-0 opacity-10 pointer-events-none mix-blend-overlay">
          <img 
            className="w-full h-full object-cover" 
            alt="Background Texture" 
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuCP-2ja4yMaARHFvWpXSFzVpjlSaMoPmA89oxRUVwNx7rXjW0EloUS-10E9bmQ_v_lt2HMxI3c1etVI9uX_URXWurO3WT1u8CLki3ZkQQIHuY0wGxoqBwdBiDVcWiSoOantB-sLSTBRrSC7PN52wONyffDo4KYZiA1FzE7zRM3lWZch4zor3APdTjjsX801mZygz7UqOOght9woFA-Hl2b09e-xY_pslKmh9B2LWfJg15psRdexnDzcwXRTwWWdVBM8s1PYD6L6Z8UN"
          />
        </div>
      </section>

      {/* Right Side: Action Canvas */}
      <section className="flex flex-col justify-center items-center w-full lg:w-1/2 p-8 md:p-24 bg-surface relative">
        {/* Mobile Logo */}
        <div className="lg:hidden absolute top-12 left-1/2 -translate-x-1/2">
          <img src="/aion_more_genis.png" alt="AION Mirror" className="h-16 w-auto" />
        </div>

        <div className="w-full max-w-sm space-y-10 z-10">
          {children}
        </div>

        {/* Footer Meta Links */}
        <footer className="absolute bottom-8 flex justify-center gap-6 w-full text-[10px] font-label uppercase tracking-widest text-outline">
          <a href="#" className="hover:text-on-primary-container transition-colors">Gizlilik</a>
          <a href="#" className="hover:text-on-primary-container transition-colors">Kullanım Şartları</a>
          <span className="opacity-30">|</span>
          <span>© 2024 AION MIRROR</span>
        </footer>
      </section>
    </main>
  )
}
