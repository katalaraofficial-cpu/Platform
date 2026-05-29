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
          background: "#0f172a",
          color: "white",
          fontSize: 120,
          fontWeight: 800,
          letterSpacing: 6,
          fontFamily: "Arial",
          borderRadius: 96,
        }}
      >
        KPOS
      </div>
    ),
    {
      width: 512,
      height: 512,
    }
  );
}
