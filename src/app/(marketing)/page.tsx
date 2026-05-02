'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'

/* ── DATA ── */

const personas = [
  { photo: '/assets/personas/SelinCelik.webp', name: 'Selin Çelik', role: 'Satış Mümessili · İlaç', desc: 'Sahaya yeni atanmış, kendine güvensiz; A sınıfı doktorlara ulaşmakta zorlanıyor.', zorluk: 3, direnc: 2 },
  { photo: '/assets/personas/AhmetYilmaz.webp', name: 'Ahmet Yılmaz', role: 'Bölge Müdürü Adayı', desc: 'Yüksek performanslı ama agresif; ekibin moralini düşürüyor.', zorluk: 4, direnc: 4 },
  { photo: '/assets/personas/MuratKaya.webp', name: 'Murat Kaya', role: 'Operasyon Sorumlusu', desc: 'Süreçleri eleştiriyor, sürekli onay arıyor, karar vermekte zorlanıyor.', zorluk: 3, direnc: 3 },
  { photo: '/assets/personas/NeslihanBozkurt.webp', name: 'Neslihan Bozkurt', role: 'Proje Yöneticisi', desc: 'Düşen motivasyon; özel hayatla iş arasında denge sorunu.', zorluk: 2, direnc: 2 },
  { photo: '/assets/personas/EmreDemir.webp', name: 'Emre Demir', role: 'Yazılım Mühendisi', desc: 'Yetenekli ama izolasyonu seven; ekiple iletişim yok.', zorluk: 4, direnc: 3 },
]

const rubrics = [
  { code: 'A1', pillar: 'A', title: 'Etik Uygulamaları Sergiler', desc: 'Koçluk etiğini ve mesleki standartları anlayıp uygular; gizlilik, sınırlar ve koçluk-diğer disiplin farkını net tutar.' },
  { code: 'A2', pillar: 'A', title: 'Anlaşmaları Kurar ve Sürdürür', desc: 'Her seansta odak ve beklentileri danışanla birlikte netleştirir; sürecin ne hakkında olduğunu ortak belirler.' },
  { code: 'B1', pillar: 'B', title: 'Koçluk Zihniyetini Somutlaştırır', desc: 'Açık, meraklı, esnek, danışan odaklı tutum sergiler. Direktif yerine keşfettirme; koçun kendi gelişimine bağlılığı.' },
  { code: 'B2', pillar: 'B', title: 'Güven ve Güvenlik Geliştirir', desc: 'Danışanın kendini güvende, yargılanmadan paylaşabildiği ilişki ortamı. Koçun özgünlüğü ve şeffaflığı temel gösterge.' },
  { code: 'B3', pillar: 'B', title: 'Varlığını Sürdürür', desc: 'Tam burada ve şimdi; dikkat dağınıklığı yok, danışanın söylediğine ve söylemediğine — beden diline — açık.' },
  { code: 'C1', pillar: 'C', title: 'Aktif Olarak Dinler', desc: 'Söyleneni ve söylenmeyeni bütünüyle kavrar; duygulara, niyete ve alt metne dikkat eder, danışanın kendi diliyle yansıtır.' },
  { code: 'C2', pillar: 'C', title: 'Farkındalık Yaratır', desc: 'Güçlü sorular, sessizlik, metafor ve yeniden çerçevelemeyle danışanda yeni bakış açısı ve öz farkındalık açar.' },
  { code: 'D1', pillar: 'D', title: 'Danışanın Gelişimini Kolaylaştırır', desc: 'Anlayışı eyleme dönüştürür; taahhüt ve hesap sorabilirlik ile kalıcı büyüme desteklenir.' },
] as const

// pillar renk haritası (sadece ICF section için)
const pillarMeta: Record<string, { label: string; color: string }> = {
  A: { label: 'Çerçeve & Etik', color: '#7B4FCE' },
  B: { label: 'Varlık & Güven', color: '#5B8FDE' },
  C: { label: 'Sorgulama', color: '#4CAFA0' },
  D: { label: 'Büyüme', color: '#E07A5F' },
}

// Rubric için kare abstract görseller. Path verilmeyenlerde mevcut renk-bandı görünümü kalır.
const rubricImages: Partial<Record<'A1' | 'A2' | 'B1' | 'B2' | 'B3' | 'C1' | 'C2' | 'D1', string>> = {
  A1: '/assets/rubrics/A1.webp',
  A2: '/assets/rubrics/A2.webp',
  B1: '/assets/rubrics/B1.webp',
  B2: '/assets/rubrics/B2.webp',
  B3: '/assets/rubrics/B3.webp',
  C1: '/assets/rubrics/C1.webp',
  C2: '/assets/rubrics/C2.webp',
  D1: '/assets/rubrics/D1.webp',
}

type PillarKey = 'A' | 'B' | 'C' | 'D'

const pillarDetails: Record<PillarKey, { dim: string; score: number; evidence: string; good: string; warn: string; focus: string }> = {
  A: {
    dim: 'A1 · Etik Uygulamaları Sergiler',
    score: 3,
    evidence: 'Bu konuyu çevrendekilerle paylaşmak isteyip istemediğine sen karar veriyorsun...',
    good: 'Danışanın özerkliğine saygıyı net cümleyle ortaya koydun.',
    warn: 'Sınır cümlesini sadece bir kez kurdun; konu zorlaştığında tavsiye moduna geçtin.',
    focus: 'Bir sonraki seansa açık uçlu sorularla başla.',
  },
  B: {
    dim: 'B2 · Güven ve Güvenlik Duygusunu Geliştirir',
    score: 4,
    evidence: 'Sana bunu anlattığın için teşekkür ederim; bu kolay bir şey değil...',
    good: 'Dinlediğini hissettirdin. Yargılamadan alan açtın.',
    warn: 'İlk 3 dakikada çok hızlı ilerledi; daha fazla oturma zamanı tanıyabilirdin.',
    focus: 'Sessizliği konuşmak kadar araç olarak kullan.',
  },
  C: {
    dim: 'C1 · Aktif Olarak Dinler',
    score: 4,
    evidence: 'Anlıyorum, dediğine göre asıl zorluk motivasyon değil, netlik...',
    good: 'Yansıtma teknikleri güçlüydü. Danışanın kendi cümlesini kullandın.',
    warn: 'İki yerde çözüme atladın; merak sorusunu bırakıp tavsiye verdin.',
    focus: "Her 'anlıyorum'dan sonra bir soru sor.",
  },
  D: {
    dim: 'D1 · Danışanın Gelişimini Kolaylaştırır',
    score: 4,
    evidence: 'Bir sonraki adım olarak ne yapmayı düşünüyorsunuz?',
    good: 'Seans sonunda danışan net bir eylem adımı belirledi.',
    warn: 'Hedef küçük kalabilir; büyütme fırsatını kaçırdın.',
    focus: "Sonraki seansta 'neden önemli?' sorusuyla bağlantıyı derinleştir.",
  },
}

const miniPillars: Array<{ key: PillarKey; name: string; score: string }> = [
  { key: 'A', name: 'Çerçeve', score: '7/10' },
  { key: 'B', name: 'Varlık', score: '9/15' },
  { key: 'C', name: 'Sorgulama', score: '8/10' },
  { key: 'D', name: 'Büyüme', score: '4/5' },
]

const corporateBenefits = [
  { icon: '🏢', title: 'Ölçeklenebilir Geliştirme', body: '50 yöneticiyi haftada bir kez koçla buluşturmak imkansız. AION Mirror her yönetici için sınırsız tekrarlanabilir, anında erişilebilir bir prova alanı sağlar.' },
  { icon: '📊', title: 'Kohort Heatmap', body: "Hangi pillar'da ekibinizin zayıf olduğunu, hangisinde güçlü olduğunu kohort bazında görün. Eğitim yatırımlarınızı veriyle yönlendirin." },
  { icon: '🎯', title: 'Kurum Senaryoları', body: 'Genel senaryolar yetmez. Kendi sektörünüze, müşteri profilinize, çalışan dinamiklerinize özel personalar ve senaryolar oluşturun.' },
  { icon: '🏆', title: 'Yetenek Sinyali', body: 'Hangi yöneticiniz koçluk-merkezli, hangisi direktif eğilimli? Promosyon ve görev rotasyonu kararları için davranışsal veri.' },
]

const managerBenefits = [
  { icon: '🎙', title: 'Sınırsız Pratik', body: 'Düşen performansla konuşmak korkutucu olabilir. Önce burada beş kez deneyin, gerçek konuşmaya hazır gelin.' },
  { icon: '🪞', title: 'Gerçek Yansıma', body: 'Konuştuktan sonra debrief koçumuz sizinle bir geri bildirim sohbeti yapar. "Nasıl hissettin? Ne öğrendin?" — sıcak ve içten.' },
  { icon: '📈', title: 'Kişisel Gelişim Haritası', body: "5 seans sonra hangi pillar'da ilerlediğinizi, hangisinde tıkandığınızı görürsünüz. 4 pillar grafiği gibi okunabilir." },
  { icon: '🏅', title: 'Oyunlaştırma', body: 'DP, seviye atlama, rozet koleksiyonu, haftalık görevler. Gelişim yolculuğunu bir oyun gibi takip edin.' },
]

const levels = [
  { icon: '🌱', name: 'Koçluk Yolcusu', badge: 'L1' },
  { icon: '⭐', name: 'Gelişen Koç', badge: 'L2', active: true },
  { icon: '🏅', name: 'Yetkin Koç', badge: 'L3' },
  { icon: '🏆', name: 'Uzman Koç', badge: 'L4' },
  { icon: '👑', name: 'Usta Koç', badge: 'L5' },
]

const badgeList = [
  '✦ İlk Seans',
  '🔥 Üç Gün Üst Üste',
  '🏅 Pillar B Ustası',
  '🤫 Sessizlik Sanatçısı',
  '🎯 Odak Çözücü',
  '💡 İçgörü Tetikleyici',
  '🌱 İlk 5 Seans',
  '📊 Veri Ustası',
]

const weeklyTasks = [
  { done: true, text: 'Bir persona ile seans tamamla', xp: '+50 DP' },
  { done: true, text: "Pillar B'de 4'ün üstünde puan al", xp: '+80 DP' },
  { done: false, text: '3 farklı persona ile konuş', xp: '+120 DP' },
  { done: false, text: "Pillar C'yi geç haftadan artır", xp: '+100 DP' },
]

const securityItems = [
  { icon: '🔒', title: 'KVKK ve GDPR Uyumlu', body: "Tüm transcript'ler AES-256-GCM ile şifrelenmiş olarak saklanır. Kurum talep ederse veriler kalıcı silinir." },
  { icon: '🇹🇷', title: 'Veri Yerelliği', body: 'Türkiye merkezli barındırma seçeneği mevcuttur. Veri sınır ötesine geçmez.' },
  { icon: '🛡', title: 'Multi-Tenant İzolasyon', body: 'Kurum verileri Postgres Row-Level Security ile birbirinden izole edilir. Başka bir kurum sizin verinizi göremez.' },
  { icon: '📋', title: 'Erişim Kontrolü', body: '6 farklı rol (Kullanıcı, Yönetici, HR Görüntüleyici, HR Admin, Kurum Admin, Süper Admin) ile granüler yetkilendirme.' },
]

const faqData: Array<{ q: string; a: React.ReactNode }> = [
  {
    q: 'AION Mirror kimler için uygundur?',
    a: (
      <>
        <p>Yönetici geliştirme programları yürüten, koçluk merkezli liderlik kültürü kurmak isteyen kurumlar için. Özellikle:</p>
        <ul>
          <li>Sahada yönetici tutan, hızlı geliştirilmesi gereken pozisyonlar (satış, operasyon, üretim)</li>
          <li>Promosyon öncesi yönetici adayı havuzu</li>
          <li>Mevcut yöneticilerin koçluk becerisini ölçmek/geliştirmek isteyen HR fonksiyonları</li>
        </ul>
      </>
    ),
  },
  {
    q: 'Hangi senaryolar mevcut?',
    a: <p>Kullanıma hazır 12+ persona ve 20+ senaryo bulunmaktadır. Düşen performans, ekip içi çatışma, kariyer planlama, motivasyon kaybı, performans değerlendirme görüşmesi gibi yaygın yönetici durumları. Ek olarak kurumunuza özel senaryolar oluşturulabilir.</p>,
  },
  {
    q: 'Yapay zeka ne kadar gerçekçi?',
    a: <p>Sistem en son çıkan GPT modeli tabanlı LLM ile çalışır; sesli iletişim için ElevenLabs Türkçe doğal sesler kullanılır. Personalar gerçek davranışsal patternlere göre tasarlanmıştır (yüksek/düşük direnç, işbirliği seviyesi, duygusal dengenin değişkenliği). Konuşma akıcı, kesintisiz ve doğaldır.</p>,
  },
  {
    q: 'Değerlendirme nasıl yapılıyor?',
    a: <p>ICF Core Competencies 2019 çerçevesinin 8 boyutu üzerinden, transcript&apos;in tamamı analiz edilerek puanlama yapılır. Her boyut için 1-5 arası puan + transcript&apos;ten kanıt cümle + &quot;doğru yaptığın / bundan kaçın&quot; şeklinde gelişim önerisi verilir.</p>,
  },
  {
    q: 'Kurumsal entegrasyon gerekiyor mu?',
    a: <p>Hayır. Tarayıcı üzerinden çalışır, ek kurulum gerekmez. SSO entegrasyonu (Azure AD, Google Workspace) opsiyonel olarak yapılabilir. Toplu kullanıcı eklemek için CSV/Excel yükleme arayüzü mevcuttur.</p>,
  },
  {
    q: 'Veri güvenliği nasıl sağlanıyor?',
    a: (
      <ul>
        <li>Tüm seans transcript&apos;leri AES-256-GCM ile şifreli saklanır</li>
        <li>Multi-tenant Postgres Row-Level Security: kurumlar arası veri izolasyonu</li>
        <li>Ses kayıtları kalıcı saklanmaz; yalnızca metne dönüştürülür</li>
        <li>KVKK ve GDPR uyumlu işleme; talep üzerine kalıcı silme</li>
        <li>Türkiye merkezli barındırma seçeneği</li>
      </ul>
    ),
  },
  {
    q: 'Mobil cihazda çalışıyor mu?',
    a: <p>Web tarayıcı üzerinden tüm cihazlarda çalışır (Chrome, Safari, Edge, Firefox). Native mobil uygulama yol haritasında, 2026 üçüncü çeyrekte planlanmıştır.</p>,
  },
  {
    q: 'Fiyatlandırma nasıl?',
    a: <p>Kullanıcı sayısına ve seans hacmine göre özelleştirilmiş paketler sunarız. Demo görüşmesinde ihtiyacınızı dinler ve uygun lisans modelini birlikte belirleriz. Pilot dönem (15 gün) seçeneği mevcuttur.</p>,
  },
]

/* ── HELPERS ── */

function Dots({ filled, total = 5 }: { filled: number; total?: number }) {
  return (
    <div className="persona-dots">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={`dot ${i < filled ? 'dot-filled' : 'dot-empty'}`} />
      ))}
    </div>
  )
}

function ScorePips({ score, total = 5 }: { score: number; total?: number }) {
  return (
    <div className="detail-dim-score">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={`score-pip ${i < score ? 'score-pip-filled' : 'score-pip-empty'}`} />
      ))}
    </div>
  )
}

const PersonaSilhouette = () => (
  <svg viewBox="0 0 24 24" className="atom-persona-silhouette" aria-hidden xmlns="http://www.w3.org/2000/svg">
    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
  </svg>
)

const BrandLogo = ({ height = 36 }: { height?: number }) => (
  <Image
    src="/aion_more_genis.png"
    alt="AION More"
    width={height * 3}
    height={height}
    priority
    style={{ height: `${height}px`, width: 'auto', display: 'block' }}
  />
)

/* ── STEP ILLUSTRATIONS ── (SVG, 96x96, brand renkleriyle) */

const StepIllu1Persona = () => (
  <svg viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    <defs>
      <linearGradient id="stepGrad1" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#9D6BDF" stopOpacity="0.95" />
        <stop offset="100%" stopColor="#5B2D9E" stopOpacity="0.85" />
      </linearGradient>
      <linearGradient id="stepGrad1Soft" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#9D6BDF" stopOpacity="0.25" />
        <stop offset="100%" stopColor="#9D6BDF" stopOpacity="0.05" />
      </linearGradient>
    </defs>
    {/* Üç persona kartı */}
    <rect x="8" y="22" width="22" height="52" rx="6" fill="url(#stepGrad1Soft)" stroke="#9D6BDF" strokeOpacity="0.35" />
    <rect x="66" y="22" width="22" height="52" rx="6" fill="url(#stepGrad1Soft)" stroke="#9D6BDF" strokeOpacity="0.35" />
    {/* Seçili olan ortadaki kart, vurgulu */}
    <rect x="36" y="14" width="24" height="64" rx="7" fill="url(#stepGrad1)" stroke="#B990F0" strokeWidth="1.2" />
    {/* Avatarlar */}
    <circle cx="19" cy="34" r="6" fill="#9D6BDF" fillOpacity="0.6" />
    <circle cx="48" cy="30" r="8" fill="#fff" />
    <circle cx="77" cy="34" r="6" fill="#9D6BDF" fillOpacity="0.6" />
    {/* Body lines */}
    <rect x="13" y="46" width="14" height="2.5" rx="1" fill="#9D6BDF" fillOpacity="0.4" />
    <rect x="13" y="52" width="10" height="2.5" rx="1" fill="#9D6BDF" fillOpacity="0.25" />
    <rect x="40" y="46" width="16" height="2.5" rx="1" fill="#fff" fillOpacity="0.85" />
    <rect x="40" y="52" width="12" height="2.5" rx="1" fill="#fff" fillOpacity="0.55" />
    <rect x="69" y="46" width="14" height="2.5" rx="1" fill="#9D6BDF" fillOpacity="0.4" />
    <rect x="69" y="52" width="10" height="2.5" rx="1" fill="#9D6BDF" fillOpacity="0.25" />
    {/* Seçim onayı */}
    <circle cx="62" cy="20" r="7" fill="#6BD7A5" />
    <path d="M58.5 20 L61 22.5 L65.5 18" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
)

const StepIllu2Voice = () => (
  <svg viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    <defs>
      <linearGradient id="micGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#B990F0" />
        <stop offset="100%" stopColor="#5B2D9E" />
      </linearGradient>
    </defs>
    {/* Ses dalgaları (sol) */}
    <path d="M14 38 Q10 48 14 58" stroke="#9D6BDF" strokeOpacity="0.55" strokeWidth="2" fill="none" strokeLinecap="round" />
    <path d="M22 32 Q16 48 22 64" stroke="#9D6BDF" strokeOpacity="0.4" strokeWidth="2" fill="none" strokeLinecap="round" />
    {/* Ses dalgaları (sağ) */}
    <path d="M82 38 Q86 48 82 58" stroke="#9D6BDF" strokeOpacity="0.55" strokeWidth="2" fill="none" strokeLinecap="round" />
    <path d="M74 32 Q80 48 74 64" stroke="#9D6BDF" strokeOpacity="0.4" strokeWidth="2" fill="none" strokeLinecap="round" />
    {/* Mikrofon gövdesi */}
    <rect x="38" y="20" width="20" height="36" rx="10" fill="url(#micGrad)" />
    <rect x="42" y="24" width="12" height="28" rx="6" fill="#fff" fillOpacity="0.18" />
    {/* Mikrofon standı (kavis) */}
    <path d="M30 50 Q30 66 48 66 Q66 66 66 50" stroke="#9D6BDF" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    <line x1="48" y1="66" x2="48" y2="78" stroke="#9D6BDF" strokeWidth="2.5" strokeLinecap="round" />
    <line x1="38" y1="78" x2="58" y2="78" stroke="#9D6BDF" strokeWidth="2.5" strokeLinecap="round" />
    {/* Aktif gösterge */}
    <circle cx="48" cy="14" r="3" fill="#6BD7A5" />
  </svg>
)

const StepIllu3Report = () => (
  <svg viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    <defs>
      <linearGradient id="reportGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="rgba(157,107,223,0.18)" />
        <stop offset="100%" stopColor="rgba(157,107,223,0.04)" />
      </linearGradient>
    </defs>
    {/* Belge çerçevesi */}
    <rect x="14" y="12" width="68" height="72" rx="7" fill="url(#reportGrad)" stroke="#9D6BDF" strokeOpacity="0.55" strokeWidth="1.2" />
    {/* Üst başlık */}
    <rect x="22" y="20" width="34" height="3.5" rx="1.5" fill="#9D6BDF" fillOpacity="0.7" />
    <rect x="22" y="27" width="22" height="2.5" rx="1.2" fill="#9D6BDF" fillOpacity="0.35" />
    {/* Skor dairesi */}
    <circle cx="68" cy="26" r="9" fill="#9D6BDF" />
    <text x="68" y="29" textAnchor="middle" fontSize="9" fontWeight="700" fill="#fff" fontFamily="Manrope, sans-serif">28</text>
    {/* Pillar barları */}
    <rect x="22" y="42" width="9" height="22" rx="2" fill="#9D6BDF" fillOpacity="0.25" />
    <rect x="22" y="50" width="9" height="14" rx="2" fill="#9D6BDF" />
    <rect x="34" y="42" width="9" height="22" rx="2" fill="#9D6BDF" fillOpacity="0.25" />
    <rect x="34" y="46" width="9" height="18" rx="2" fill="#9D6BDF" />
    <rect x="46" y="42" width="9" height="22" rx="2" fill="#9D6BDF" fillOpacity="0.25" />
    <rect x="46" y="48" width="9" height="16" rx="2" fill="#9D6BDF" />
    <rect x="58" y="42" width="9" height="22" rx="2" fill="#9D6BDF" fillOpacity="0.25" />
    <rect x="58" y="44" width="9" height="20" rx="2" fill="#B990F0" />
    {/* Vurgulu odak satırı */}
    <rect x="22" y="72" width="48" height="6" rx="3" fill="#6BD7A5" fillOpacity="0.18" stroke="#6BD7A5" strokeOpacity="0.55" strokeDasharray="2 2" />
    <circle cx="76" cy="75" r="2.5" fill="#6BD7A5" />
  </svg>
)

/* ── PAGE ── */

export default function LandingPage() {
  const [activePillar, setActivePillar] = useState<PillarKey>('A')
  const [openFaq, setOpenFaq] = useState<number | null>(0)
  const [demoSubmitted, setDemoSubmitted] = useState(false)
  const [navScrolled, setNavScrolled] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', company: '', size: '' })

  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 60)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.email.trim() || !form.company.trim()) {
      alert('Lütfen zorunlu alanları doldurun.')
      return
    }
    // TODO: backend endpoint hazırlanınca POST
    setDemoSubmitted(true)
  }

  const detail = pillarDetails[activePillar]

  return (
    <>
      {/* ──────────────── NAV ──────────────── */}
      <nav id="main-nav" style={{ background: navScrolled ? 'rgba(15,14,34,0.92)' : 'rgba(15,14,34,0.72)' }}>
        <div className="nav-inner">
          <Link href="/" className="nav-logo" aria-label="AION More — Anasayfa">
            <BrandLogo height={34} />
          </Link>

          <ul className="nav-links">
            <li><a href="#how">Nasıl Çalışır</a></li>
            <li><a href="#personas">Personalar</a></li>
            <li><a href="#icf">ICF Çerçevesi</a></li>
            <li><a href="#report">Raporlama</a></li>
            <li><a href="#faq">SSS</a></li>
          </ul>

          <div className="nav-cta">
            <Link href="/login" className="btn btn-ghost">Giriş Yap</Link>
            <a href="#demo" className="btn btn-primary">Demo Talep Et</a>
          </div>

          <button className="nav-toggle" aria-label="Menü">
            <span /><span /><span />
          </button>
        </div>
      </nav>

      {/* ──────────────── HERO ──────────────── */}
      <section id="hero">
        <div className="hero-glow hero-glow-1" />
        <div className="hero-glow hero-glow-2" />

        <div className="container">
          <div className="hero-inner">
            <div className="hero-left">
              <div className="hero-eyebrow">
                <div className="hero-eyebrow-dot" />
                <span>ICF Tabanlı Koçluk Simülasyonu</span>
              </div>

              <h1 className="hero-headline">
                Yöneticileriniz <em>zor konuşmaları</em><br />
                önce burada prova etsin.<br />
                Sahaya hazır çıksın.
              </h1>

              <p className="hero-sub">
                AION Mirror, yöneticilerin gerçek koçluk konuşmalarını yapay zeka
                personalarıyla pratik etmesini sağlar. ICF koçluk değerlendirme
                kriterlerine göre puanlanmış raporlarla yöneticilerin gelişimlerini
                takip edebilirsiniz.
              </p>

              <div className="hero-cta">
                <a href="#demo" className="btn btn-primary btn-lg">Demo Talep Et</a>
                <a href="#report" className="btn btn-ghost btn-lg">Örnek Raporu Gör</a>
              </div>

              <div className="hero-trust">
                <div className="trust-badge">
                  <div className="trust-badge-icon">🛡</div>
                  <span>ICF Çerçeveli</span>
                </div>
                <div className="trust-badge">
                  <div className="trust-badge-icon">🔒</div>
                  <span>KVKK Uyumlu</span>
                </div>
                <div className="trust-badge">
                  <div className="trust-badge-icon">🇹🇷</div>
                  <span>Türkçe Doğal Konuşma</span>
                </div>
              </div>

              <div className="hero-anchor-strip">
                <span className="hero-anchor-pulse" aria-hidden />
                <span className="hero-anchor-text">
                  Erken erişim — pilot kurum kontenjanı sınırlı.
                  İlk 5 kuruma %30 pilot indirimi.
                </span>
              </div>
            </div>

            <div className="hero-visual">
              {/* Atom modeli: yönetici merkezde, personalar farklı yörüngelerde dönüyor */}
              <div className="atom-stage">
                {/* Yörünge ringleri (statik görsel) */}
                <div className="atom-orbit atom-orbit-1-ring" aria-hidden />
                <div className="atom-orbit atom-orbit-2-ring" aria-hidden />
                <div className="atom-orbit atom-orbit-3-ring" aria-hidden />

                {/* Merkez parıltı */}
                <div className="atom-center-glow" aria-hidden />

                {/* Merkez: Yönetici */}
                <div className="atom-center">
                  <div className="atom-center-orb">
                    <span aria-hidden>👤</span>
                  </div>
                  <span className="atom-center-label">YÖNETİCİ</span>
                </div>

                {/* Yörünge 1 — iç halka: 3 gerçek persona */}
                <div className="atom-orbit-spin atom-spin-1">
                  {[
                    { angle: 0,   photo: '/assets/personas/SelinCelik.webp',  name: 'Selin Çelik' },
                    { angle: 120, photo: '/assets/personas/AhmetYilmaz.webp', name: 'Ahmet Yılmaz' },
                    { angle: 240, photo: '/assets/personas/MuratKaya.webp',   name: 'Murat Kaya' },
                  ].map((p, i) => (
                    <div
                      key={i}
                      className="atom-persona atom-persona-r1"
                      style={{ transform: `rotate(${p.angle}deg) translateX(150px)` }}
                    >
                      <div className="atom-line atom-line-r1" aria-hidden />
                      <div className="atom-persona-orb" style={{ transform: `rotate(-${p.angle}deg)` }}>
                        <span className="atom-counter-spin atom-counter-spin-1">
                          <img src={p.photo} alt={p.name} className="atom-persona-img" />
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Yörünge 2 — orta halka: 2 persona + 1 silüet */}
                <div className="atom-orbit-spin atom-spin-2">
                  {[
                    { angle: 60,  photo: '/assets/personas/NeslihanBozkurt.webp', name: 'Neslihan Bozkurt' },
                    { angle: 180, photo: '/assets/personas/EmreDemir.webp',       name: 'Emre Demir' },
                    { angle: 300, photo: null, name: null },
                  ].map((p, i) => (
                    <div
                      key={i}
                      className="atom-persona atom-persona-r2"
                      style={{ transform: `rotate(${p.angle}deg) translateX(220px)` }}
                    >
                      <div className="atom-line atom-line-r2" aria-hidden />
                      <div className="atom-persona-orb" style={{ transform: `rotate(-${p.angle}deg)` }}>
                        <span className="atom-counter-spin atom-counter-spin-2">
                          {p.photo ? (
                            <img src={p.photo} alt={p.name ?? ''} className="atom-persona-img" />
                          ) : (
                            <PersonaSilhouette />
                          )}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Yörünge 3 — dış halka: 3 silüet ("daha fazla persona" hissi) */}
                <div className="atom-orbit-spin atom-spin-3">
                  {[
                    { angle: 30 },
                    { angle: 150 },
                    { angle: 270 },
                  ].map((p, i) => (
                    <div
                      key={i}
                      className="atom-persona atom-persona-r3"
                      style={{ transform: `rotate(${p.angle}deg) translateX(280px)` }}
                    >
                      <div className="atom-line atom-line-r3" aria-hidden />
                      <div className="atom-persona-orb" style={{ transform: `rotate(-${p.angle}deg)` }}>
                        <span className="atom-counter-spin atom-counter-spin-3">
                          <PersonaSilhouette />
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ──────────────── PROBLEM ──────────────── */}
      <section id="problem" className="section-pad">
        <div className="container">
          <div style={{ textAlign: 'center', maxWidth: 660, margin: '0 auto 0.5rem' }}>
            <span className="label-caps section-eyebrow">Neden Varız</span>
            <h2 className="section-h2">
              Yönetici geliştirme programlarının iki <em>kronik</em> sorunu.
            </h2>
          </div>

          <div className="problem-grid">
            <div className="problem-card">
              <div className="problem-number">01</div>
              <h3>Pratik Açığı</h3>
              <p>
                Eğitimde anlatılan koçluk teknikleri, iş yerinde gerçek konuşmaya
                dönmüyor. Yönetici eğitimden çıkar çıkmaz eski alışkanlıklara döner.
                Çünkü pratik için güvenli bir alan yok.
              </p>
            </div>
            <div className="problem-card">
              <div className="problem-number">02</div>
              <h3>Ölçüm Açığı</h3>
              <p>
                &quot;Anketle değerlendirme&quot; davranış değişimini ölçemez. Hangi
                yöneticinizin gerçekten dinlediğini, hangisinin direktif moduna
                geri kaydığını veriyle göremezsiniz.
              </p>
            </div>
          </div>

          <div className="problem-resolution">
            <p>
              AION Mirror her ikisini de çözer: <em>sınırsız pratik</em> + <em>somut ölçüm.</em>
            </p>
          </div>
        </div>
      </section>

      {/* ──────────────── HOW IT WORKS ──────────────── */}
      <section id="how" className="section-pad" style={{ background: 'var(--surface-low)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', maxWidth: 600, margin: '0 auto' }}>
            <span className="label-caps section-eyebrow">Nasıl Çalışır</span>
            <h2 className="section-h2">Üç adımda gerçek <em>koçluk pratiği.</em></h2>
            <p className="section-sub">Yapay zeka ile gerçek koçluk seansınıza hazırlık yapın.</p>
          </div>

          <div className="steps-grid">
            <div className="step-card">
              <span className="step-badge">01</span>
              <div className="step-illu"><StepIllu1Persona /></div>
              <h3>Karakteri ve senaryoyu seç</h3>
              <p>
                Düşen performansla mücadele eden bir uzman mı, ekibe yeni katılan
                bir potansiyel mi, kendine güvensiz bir yetenek mi? Kurum
                ihtiyaçlarınıza göre seçtiğiniz personayla başlayın.
              </p>
              <div className="step-connector" aria-hidden>→</div>
            </div>
            <div className="step-card">
              <span className="step-badge">02</span>
              <div className="step-illu"><StepIllu2Voice /></div>
              <h3>Sesli koçluk konuşması yapın</h3>
              <p>
                Mikrofona basın, doğal Türkçe konuşun. AI persona gerçek bir çalışan
                gibi tepki verir; sözünü kesin, derinleştirin, sessizliği kullanın.
                Sahadaki gibi.
              </p>
              <div className="step-connector" aria-hidden>→</div>
            </div>
            <div className="step-card">
              <span className="step-badge">03</span>
              <div className="step-illu"><StepIllu3Report /></div>
              <h3>Detaylı raporu inceleyin</h3>
              <p>
                ICF rubric&apos;inin 8 boyutunda puanlama, transcript&apos;ten kanıt cümleler,
                &quot;Doğru yaptıkların&quot; + &quot;Bundan kaçın&quot; maddeleri ve bir sonraki seans
                için tek odak.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ──────────────── PERSONAS ──────────────── */}
      <section id="personas" className="section-pad dark-section">
        <div className="container">
          <div className="personas-header">
            <span className="label-caps section-eyebrow">Persona Galerisi</span>
            <h2>
              Karakterler hazır. Hangi konuşmayı{' '}
              <em style={{ color: 'var(--accent-light)', fontStyle: 'italic' }}>pratik</em>{' '}
              etmek istersiniz?
            </h2>
            <p>
              Her persona, gerçek iş hayatından gözlemlenmiş bir karakter profilidir.<br />
              Kurum ihtiyaçlarınıza göre özelleştirme yapılabilir.
            </p>
          </div>

          <div className="personas-grid">
            {personas.map((p) => (
              <div key={p.name} className="persona-card">
                <div className="persona-avatar-wrap">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.photo} alt={p.name} className="persona-photo" />
                </div>
                <div className="persona-name">{p.name}</div>
                <div className="persona-role">{p.role}</div>
                <div className="persona-desc">{p.desc}</div>
                <div className="persona-stats">
                  <div className="persona-stat">
                    <span className="persona-stat-label">Zorluk</span>
                    <Dots filled={p.zorluk} />
                  </div>
                  <div className="persona-stat">
                    <span className="persona-stat-label">Direnç</span>
                    <Dots filled={p.direnc} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="personas-cta">
            <a href="#demo">→ Tüm persona kütüphanesini görün (12+ karakter)</a>
          </div>

          <div className="section-cta">
            <a href="#demo" className="btn btn-primary">Demo Talep Et</a>
            <span className="section-cta-hint">30 dakika · sıfır taahhüt</span>
          </div>
        </div>
      </section>

      {/* ──────────────── ICF ──────────────── */}
      <section id="icf" className="section-pad">
        <div className="container">
          <div className="icf-header">
            <span className="label-caps section-eyebrow">ICF Çerçevesi</span>
            <h2 className="section-h2">
              Akademik temelli, <em>sahaya uygulanmış</em> değerlendirme.
            </h2>
            <p className="section-sub" style={{ maxWidth: 620, margin: '0 auto' }}>
              Uluslararası Koçluk Federasyonu (ICF) Core Competencies 2019 çerçevesinin
              8 boyutu her seans için ayrı ayrı ölçülür ve puanlanır.
              Kurum kendi rubric&apos;ini de ekleyebilir.
            </p>
          </div>

          <div className="rubrics-grid">
            {rubrics.map((r) => {
              const meta = pillarMeta[r.pillar]
              const image = rubricImages[r.code]
              return (
                <div key={r.code} className={`rubric-card ${image ? 'rubric-card-image' : ''}`}>
                  {image ? (
                    <img src={image} alt="" aria-hidden className="rubric-image" />
                  ) : (
                    <div className="rubric-visual" style={{ background: `linear-gradient(135deg, ${meta.color}22 0%, ${meta.color}08 100%)`, borderTop: `3px solid ${meta.color}` }} />
                  )}
                  <div className="rubric-body">
                    <div className="rubric-title" style={{ color: meta.color }}>{r.title}</div>
                    <div className="rubric-desc">{r.desc}</div>
                  </div>
                </div>
              )
            })}
          </div>

          <p className="icf-footnote">
            Her boyut için 1–5 arası puan, transcript&apos;ten kanıt cümle
            ve &quot;doğru yaptığın / bundan kaçın&quot; gelişim önerisi.
          </p>
        </div>
      </section>

      {/* ──────────────── REPORT PREVIEW ──────────────── */}
      <section id="report" className="section-pad dark-section">
        <div className="container">
          <div className="report-header">
            <span className="label-caps section-eyebrow">Raporlama</span>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '2.2rem', fontWeight: 400, color: '#fff', margin: '0.75rem auto', maxWidth: 700, lineHeight: 1.25 }}>
              <em style={{ fontStyle: 'italic', color: 'var(--accent-light)' }}>&quot;İyi geçti&quot;</em> değil; &quot;Şu cümlede şunu yaptın, şunu yapma.&quot;
            </h2>
            <p>
              Her seans sonunda yöneticinizin elinde 3 şey var: ICF rubric&apos;ine göre 8 boyutlu
              detay analizi, transcript&apos;ten kanıt alıntıları ve bir sonraki seans için tek bir odak cümlesi.
            </p>
          </div>

          <div className="report-mockup">
            <div className="mockup-scorecard">
              <div>
                <div className="mockup-score-main">
                  <span className="score-big">28</span>
                  <span className="score-denom">/ 40</span>
                </div>
              </div>
              <div>
                <div className="score-label">Gelişen Liderlik Profili</div>
                <div className="score-sublabel">Seans #3 · Selin Çelik · 24 Nisan 2026</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginBottom: '0.3rem' }}>Trend</div>
                <div style={{ fontSize: '1rem', color: '#6BD7A5', fontWeight: 700 }}>↗ +4 puan</div>
              </div>
            </div>

            <div className="mockup-pillars-row">
              {miniPillars.map((mp) => (
                <div
                  key={mp.key}
                  className={`mini-pillar ${activePillar === mp.key ? 'active' : ''}`}
                  onClick={() => setActivePillar(mp.key)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActivePillar(mp.key) }}
                >
                  <div className="mini-pillar-letter">{mp.key}</div>
                  <div className="mini-pillar-name">{mp.name}</div>
                  <div className="mini-pillar-score">{mp.score}</div>
                </div>
              ))}
            </div>

            <div className="mockup-detail">
              <div className="detail-dim-header">
                <span className="detail-dim-title">{detail.dim}</span>
                <ScorePips score={detail.score} />
              </div>
              <div className="detail-evidence">
                <div className="detail-evidence-label">📋 Transcript Kanıtı</div>
                <p>&quot;{detail.evidence}&quot;</p>
              </div>
              <div className="detail-feedback">
                <div className="feedback-item">
                  <div className="feedback-type good">✅ Doğru yaptığın</div>
                  <p>{detail.good}</p>
                </div>
                <div className="feedback-item">
                  <div className="feedback-type warn">⚠️ Bundan kaçın</div>
                  <p>{detail.warn}</p>
                </div>
              </div>
              <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: 'rgba(157,107,223,0.08)', borderRadius: '0.5rem', borderLeft: '2px solid rgba(157,107,223,0.5)' }}>
                <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(157,107,223,0.7)' }}>Bir Sonraki Odak</span>
                <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', marginTop: '0.3rem' }}>{detail.focus}</p>
              </div>
            </div>
          </div>

          <div className="report-bullets">
            <div className="report-bullet">
              <div className="report-bullet-icon">🎯</div>
              <div>
                <h4>Tek odak cümlesi</h4>
                <p>Yönetici ne yapacağını net biliyor. Her seans, bir sonrakine taşınacak somut bir davranış hedefiyle kapanır.</p>
              </div>
            </div>
            <div className="report-bullet">
              <div className="report-bullet-icon">📋</div>
              <div>
                <h4>Transcript&apos;ten kanıt</h4>
                <p>Soyut değil, somut. &quot;Şu dakikada şu cümleyi söyledin&quot; diyerek geri bildirim verilir.</p>
              </div>
            </div>
            <div className="report-bullet">
              <div className="report-bullet-icon">🔁</div>
              <div>
                <h4>Trend takibi</h4>
                <p>5 seans sonra hangi pillar&apos;ın güçlendiğini, hangisinde tıkandığını veriyle görürsünüz.</p>
              </div>
            </div>
          </div>

          <div className="section-cta">
            <a href="#demo" className="btn btn-primary">Demo Talep Et</a>
            <span className="section-cta-hint">30 dakika · sıfır taahhüt</span>
          </div>
        </div>
      </section>

      {/* ──────────────── CORPORATE BENEFITS ──────────────── */}
      <section id="corporate-benefits" className="section-pad">
        <div className="container">
          <div className="benefits-header">
            <span className="label-caps section-eyebrow">Kuruma Faydalar</span>
            <h2 className="section-h2">
              Kurum koçluk kültürünüzü <em>ölçülebilir</em> hale getirin.
            </h2>
          </div>
          <div className="benefits-grid">
            {corporateBenefits.map((b) => (
              <div key={b.title} className="benefit-card">
                <div className="benefit-icon">{b.icon}</div>
                <h3>{b.title}</h3>
                <p>{b.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ──────────────── MANAGER BENEFITS ──────────────── */}
      <section id="manager-benefits" className="section-pad">
        <div className="container">
          <div className="benefits-header">
            <span className="label-caps section-eyebrow">Yöneticiye Faydalar</span>
            <h2 className="section-h2">
              Çalışanlarınızla yapacağınız zor konuşmaları <em>önce burada</em> deneyin.
            </h2>
          </div>
          <div className="benefits-grid">
            {managerBenefits.map((b) => (
              <div key={b.title} className="benefit-card">
                <div className="benefit-icon">{b.icon}</div>
                <h3>{b.title}</h3>
                <p>{b.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ──────────────── GAMIFICATION ──────────────── */}
      <section id="gamification" className="section-pad dark-section">
        <div className="container">
          <div className="gamification-header">
            <span className="label-caps section-eyebrow">Gelişim Takibi</span>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '2.4rem', fontWeight: 400, color: '#fff', margin: '0.75rem auto', maxWidth: 700 }}>
              Davranış değişimi alışkanlık gerektirir.{' '}
              <em style={{ fontStyle: 'italic', color: 'var(--accent-light)' }}>Alışkanlık oyun - eğlence ile</em>{' '}
              oluşur.
            </h2>
            <p>AION Mirror&apos;da her seans, her ilerleme, her kazanım takip edilir ve ödüllendirilir.</p>
          </div>

          <div className="game-cards">
            <div className="game-card">
              <div className="game-card-title">Seviyeler</div>
              <div className="level-list">
                {levels.map((l) => (
                  <div key={l.badge} className={`level-item ${l.active ? 'active' : ''}`}>
                    <span className="level-icon">{l.icon}</span>
                    <span className="level-name">{l.name}</span>
                    <span className="level-badge">{l.badge}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="game-card">
              <div className="game-card-title">Rozetler</div>
              <div className="badge-list">
                {badgeList.map((b) => (
                  <span key={b} className="badge-pill">{b}</span>
                ))}
              </div>
            </div>

            <div className="game-card">
              <div className="game-card-title">Haftalık Görevler</div>
              <div className="weekly-tasks">
                {weeklyTasks.map((t, i) => (
                  <div key={i} className="task-item">
                    <div className={`task-check ${t.done ? 'done' : ''}`} />
                    <span className="task-text">{t.text}</span>
                    <span className="task-xp">{t.xp}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ──────────────── SECURITY ──────────────── */}
      <section id="security" className="section-pad">
        <div className="container">
          <div className="security-header">
            <span className="label-caps section-eyebrow">Güvenlik &amp; Veri</span>
            <h2 className="section-h2">
              Kurum verilerinizi <em>olduğu yerde</em> tutuyoruz.
            </h2>
          </div>
          <div className="security-grid">
            {securityItems.map((s) => (
              <div key={s.title} className="security-item">
                <div className="security-icon">{s.icon}</div>
                <div>
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="section-cta">
            <a href="#demo" className="btn btn-primary">Demo Talep Et</a>
            <span className="section-cta-hint">30 dakika · sıfır taahhüt</span>
          </div>
        </div>
      </section>

      {/* ──────────────── DEMO CTA ──────────────── */}
      <section id="demo">
        <div className="container">
          <div className="demo-inner">
            <div className="demo-left">
              <span className="label-caps" style={{ color: 'rgba(255,255,255,0.5)', marginBottom: '0.75rem', display: 'block' }}>
                Demo Talep Et
              </span>
              <h2>30 dakikalık demo.<br /><em style={{ fontStyle: 'italic' }}>Sıfır taahhüt.</em></h2>
              <p>
                Kendi senaryonuzla bir prova seans yapalım.
                Raporu ekrana açalım. Ekiplerinize uygun olup olmadığını
                birlikte değerlendirelim.
              </p>
              <div style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {[
                  'En geç 24 saat içinde dönüş',
                  'Pilot dönem (15 gün) seçeneği',
                  'Kurumunuza özel senaryo',
                ].map((t) => (
                  <div key={t} className="trust-badge" style={{ color: 'rgba(255,255,255,0.6)' }}>
                    <div className="trust-badge-icon" style={{ background: 'rgba(255,255,255,0.15)' }}>✓</div>
                    <span>{t}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="demo-right">
              <div className="demo-form-card">
                {!demoSubmitted ? (
                  <form onSubmit={handleSubmit} id="demo-form-body">
                    <div className="form-group">
                      <label className="form-label" htmlFor="f-name">Ad Soyad *</label>
                      <input
                        className="form-input"
                        type="text"
                        id="f-name"
                        placeholder="Ayşe Kaya"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="f-email">Kurumsal E-posta *</label>
                      <input
                        className="form-input"
                        type="email"
                        id="f-email"
                        placeholder="ayse@sirketiniz.com"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="f-company">Şirket Adı *</label>
                      <input
                        className="form-input"
                        type="text"
                        id="f-company"
                        placeholder="Şirket adı"
                        value={form.company}
                        onChange={(e) => setForm({ ...form, company: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="f-size">Çalışan Sayısı</label>
                      <select
                        className="form-select form-input"
                        id="f-size"
                        value={form.size}
                        onChange={(e) => setForm({ ...form, size: e.target.value })}
                      >
                        <option value="">Seçin</option>
                        <option value="under50">&lt;50</option>
                        <option value="50-200">50–200</option>
                        <option value="200-1000">200–1000</option>
                        <option value="1000+">1000+</option>
                      </select>
                    </div>
                    <button type="submit" className="form-submit">Demo Talep Et</button>
                    <p className="form-note">
                      Bilgileriniz Aydınlatma Metni kapsamında işlenir.<br />
                      Spam göndermiyoruz; en geç 24 saat içinde dönüş yapıyoruz.
                    </p>
                  </form>
                ) : (
                  <div className="form-success visible">
                    <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>✦</div>
                    <h3>Talebiniz alındı.</h3>
                    <p style={{ marginTop: '0.5rem' }}>En geç 24 saat içinde ekibimiz sizinle iletişime geçecek.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ──────────────── FAQ ──────────────── */}
      <section id="faq" className="section-pad">
        <div className="container">
          <div className="faq-header">
            <span className="label-caps section-eyebrow">SSS</span>
            <h2 className="section-h2">Sıkça sorulan sorular.</h2>
          </div>

          <div className="faq-list">
            {faqData.map((item, i) => (
              <div key={i} className={`faq-item ${openFaq === i ? 'open' : ''}`}>
                <button
                  className="faq-question"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  aria-expanded={openFaq === i}
                >
                  {item.q}
                  <span className="faq-icon">+</span>
                </button>
                <div className="faq-answer">
                  <div className="faq-answer-inner">{item.a}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ──────────────── FOOTER ──────────────── */}
      <footer className="site-footer">
        <div className="container">
          <div className="footer-grid">
            <div>
              <Link href="/" className="nav-logo" aria-label="AION More" style={{ marginBottom: '0.75rem', display: 'inline-flex' }}>
                <BrandLogo height={42} />
              </Link>
              <p className="footer-brand-tagline">Liderlik, sahada öğrenilir.</p>
              <div className="footer-social">
                <a href="#" className="social-btn" aria-label="LinkedIn">in</a>
                <a href="#" className="social-btn" aria-label="Twitter">𝕏</a>
              </div>
            </div>

            <div className="footer-col">
              <h4>Ürün</h4>
              <ul>
                <li><a href="#how">Özellikler</a></li>
                <li><a href="#personas">Persona Kütüphanesi</a></li>
                <li><a href="#icf">ICF Çerçevesi</a></li>
                <li><a href="#security">Güvenlik</a></li>
                <li><a href="#faq">SSS</a></li>
              </ul>
            </div>

            <div className="footer-col">
              <h4>Kurumsal</h4>
              <ul>
                <li><a href="#">Hakkımızda</a></li>
                <li><a href="#demo">Demo Talep</a></li>
                <li><a href="#contact">İletişim</a></li>
                <li><a href="#">Kariyer</a></li>
              </ul>
            </div>

            <div className="footer-col">
              <h4>Yasal</h4>
              <ul>
                <li><a href="#">Kullanım Koşulları</a></li>
                <li><a href="#">Gizlilik Politikası</a></li>
                <li><a href="#">KVKK Aydınlatma</a></li>
                <li><a href="#">Çerez Politikası</a></li>
              </ul>
              <div style={{ marginTop: '1.5rem', fontSize: '0.8rem', color: 'rgba(255,255,255,0.3)', lineHeight: 1.6 }}>
                contact@mirror.aionmore.com
              </div>
            </div>
          </div>

          <div className="footer-bottom">
            <p className="footer-copy">
              © 2026 AION Mirror · Bu platform AION More tarafından geliştirilmiştir.
            </p>
            <div className="footer-badges">
              <span className="footer-badge">KVKK Uyumlu</span>
              <span className="footer-badge">GDPR Uyumlu</span>
              <span className="footer-badge">ISO 27001 Planlanan</span>
            </div>
          </div>
        </div>
      </footer>
    </>
  )
}
