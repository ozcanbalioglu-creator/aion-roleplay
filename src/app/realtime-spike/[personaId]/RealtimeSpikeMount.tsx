'use client'

/**
 * Dynamic mount wrapper for RealtimeSpikeClient.
 *
 * @elevenlabs/react ships with browser-only dependencies (audio worklets,
 * WebRTC). Loading it during server render causes the page to crash with
 * Vercel's generic "This page couldn't load" error. We isolate the client
 * with `next/dynamic` + ssr:false so the bundle is fetched only in the
 * browser. This wrapper itself is a client component, so the
 * server-component page.tsx can import it safely.
 */

import dynamic from 'next/dynamic'

const RealtimeSpikeClient = dynamic(
  () => import('./RealtimeSpikeClient').then((m) => m.RealtimeSpikeClient),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-lg border border-outline/20 bg-surface-low p-6 text-sm text-on-surface-variant">
        Conv. AI istemcisi yükleniyor…
      </div>
    )
  }
)

interface Props {
  personaId: string
  scenarioId: string | null
}

export function RealtimeSpikeMount(props: Props) {
  return <RealtimeSpikeClient {...props} />
}
