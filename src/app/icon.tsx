import { ImageResponse } from "next/og";

export const size = {
  width: 512,
  height: 512,
};

export const contentType = "image/jpeg";

const LOGO_URL =
  "https://nmggvtewovganrwcbpzk.supabase.co/storage/v1/object/public/settings-assets/e6d1a42d-8a3f-4266-9470-44ac1b6886b3/Logo.jpg";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#000000",
        }}
      >
        <img
          src={LOGO_URL}
          alt="Katalara"
          width={460}
          height={460}
          style={{ objectFit: "contain" }}
        />
      </div>
    ),
    {
      ...size,
    }
  );
}
