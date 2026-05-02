import path from "node:path";
import type { NextConfig } from "next";

function getSupabaseHostname(): string {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').hostname;
  } catch {
    return 'dqmivckxqdvwlzudshlz.supabase.co';
  }
}

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  // ElevenLabs Conv. AI SDK has browser-only deps; transpile so SSR
  // bundling treats them like first-party code (spike branch).
  transpilePackages: ['@elevenlabs/react', '@elevenlabs/client'],
  // SharedArrayBuffer — ONNX Runtime (VAD) için gerekli
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'credentialless' },
        ],
      },
    ]
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: getSupabaseHostname(),
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

export default nextConfig;
