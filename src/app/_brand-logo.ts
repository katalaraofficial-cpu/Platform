// Shared proxy: serve the Katalara brand logo for PWA icon endpoints.
const LOGO_URL =
  "https://nmggvtewovganrwcbpzk.supabase.co/storage/v1/object/public/settings-assets/e6d1a42d-8a3f-4266-9470-44ac1b6886b3/Logo.jpg";

export async function fetchKatalaraLogo(): Promise<Response> {
  try {
    const upstream = await fetch(LOGO_URL, { cache: "force-cache" });
    if (!upstream.ok) {
      return new Response("Logo unavailable", { status: 502 });
    }
    const buf = await upstream.arrayBuffer();
    return new Response(buf, {
      status: 200,
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? "image/jpeg",
        "Cache-Control": "public, max-age=86400, s-maxage=604800, immutable",
      },
    });
  } catch {
    return new Response("Logo fetch failed", { status: 502 });
  }
}
