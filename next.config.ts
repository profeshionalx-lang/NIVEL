import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
  // ffmpeg-static's binary isn't referenced through a JS import, so Next's
  // file tracer won't pick it up on its own — the STT chunking pipeline
  // (src/lib/stt/chunk.ts, NIVEL#244) needs it bundled into every route/
  // server action that can reach transcribeSessionCore.
  outputFileTracingIncludes: {
    "/*": ["node_modules/ffmpeg-static/**/*"],
  },
};

export default nextConfig;
