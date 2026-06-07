import { ImageResponse } from "next/og";

// Sumber gambar logo (Supabase Storage public asset).
export const KATALARA_LOGO_URL =
  "https://nmggvtewovganrwcbpzk.supabase.co/storage/v1/object/public/settings-assets/e6d1a42d-8a3f-4266-9470-44ac1b6886b3/Logo.jpg";

// Render PNG icon menggunakan @vercel/og (next/og). Chrome's installability
// checker lebih reliable mendeteksi PNG dibanding JPEG, dan ImageResponse
// memastikan content-type & dimensi presisi.
export function renderKatalaraIcon(opts: {
  size: number;
  maskable?: boolean;
}): ImageResponse {
  const { size, maskable = false } = opts;
  // Safe-zone untuk maskable: konten harus berada di lingkaran ~80% dari canvas
  // agar tidak terpotong saat OS memberi mask (Android adaptive icon).
  const padding = maskable ? Math.round(size * 0.1) : 0;
  const inner = size - padding * 2;
  // Maskable wajib fill background sampai tepi karena mask bisa berbentuk apa pun.
  const background = "#000000";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={KATALARA_LOGO_URL}
          alt="Katalara"
          width={inner}
          height={inner}
          style={{ objectFit: "contain" }}
        />
      </div>
    ),
    {
      width: size,
      height: size,
    },
  );
}
