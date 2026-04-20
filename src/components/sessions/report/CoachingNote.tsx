import { cn } from '@/lib/utils'

interface CoachingNoteProps {
  coachingNote: string
  managerInsight: string
}

export function CoachingNote({ coachingNote, managerInsight }: CoachingNoteProps) {
  return (
    <aside className="w-full xl:w-[400px] bg-on-background text-surface relative rounded-2xl overflow-hidden shrink-0 shadow-2xl">
      <div className="p-8 lg:p-12 h-full flex flex-col justify-between">
        <div className="mb-16">
          <h3 className="font-label text-xs uppercase tracking-[0.2em] font-bold text-on-primary-container mb-8">
            Executive Summary
          </h3>
          <div className="w-full h-[240px] rounded-xl overflow-hidden mb-8 grayscale hover:grayscale-0 transition-all duration-700 bg-surface-container-highest">
            <img 
              className="w-full h-full object-cover mix-blend-luminosity opacity-80" 
              alt="Executive Theme" 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuBSzAtmL0DNnyTRZl6ESrpiuP1daqvMlOumJdFhELItXZVzagCFWzkfAEPZonckoL-ls4NqTj7CRkDx6uJRp8TXmkYXhey71pkoHhDWhtKrYE4Ci1C8DTWtylSEsyW6P-sOK9bYK-OIG1FOpwCxRLMfvZo2mi4CvCbEoz2s2VNNaUnlTRsnfILwnA-wVrqbr2faEjfDMoWosjhaBhl15vfq8DcVKbrOwbCtls15_-c0Tq-F9eFjG5hVWBvFPGTdLO076FEtx7TlSkQ7" 
            />
          </div>
          
          {managerInsight && (
            <p className="serif-italic text-2xl leading-tight mb-8">
              “{managerInsight}”
            </p>
          )}
        </div>

        <div className="space-y-8">
          <div>
            <div className="flex items-center gap-4 mb-4">
              <span className="text-on-primary-container font-headline text-4xl italic">AI</span>
              <h4 className="font-label text-sm uppercase tracking-widest font-bold">Coaching Note</h4>
            </div>
            <p className="text-sm text-surface-container opacity-60 leading-relaxed whitespace-pre-wrap">
              {coachingNote || "Not bulunamadı."}
            </p>
          </div>
        </div>

        <div className="mt-16 pt-8 border-t border-surface/10 text-center">
          <p className="font-label text-[10px] uppercase tracking-[0.3em] opacity-30 text-surface">
            CONFIDENTIAL EVALUATION
          </p>
        </div>
      </div>
    </aside>
  )
}
