import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0f172a, #1d4ed8)",
          color: "white",
          fontSize: 64,
          fontWeight: 800,
          letterSpacing: 3,
          fontFamily: "Arial",
        }}
      >
        KPOS
      </div>
    ),
    {
      width: 180,
      height: 180,
    }
  );
}
