"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app/error]", error.message, error.stack);
  }, [error]);

  return (
    <html lang="id">
      <body style={{ fontFamily: "sans-serif", padding: "40px", maxWidth: "600px", margin: "0 auto" }}>
        <h1 style={{ color: "#dc2626", fontSize: "20px" }}>Server Error</h1>
        <p style={{ color: "#374151", marginTop: "8px" }}>
          {error.message || "Terjadi kesalahan server."}
        </p>
        <pre style={{ background: "#f3f4f6", padding: "12px", borderRadius: "6px", fontSize: "12px", overflowX: "auto", marginTop: "12px" }}>
          {error.stack}
        </pre>
        {error.digest && (
          <p style={{ color: "#6b7280", fontSize: "12px", marginTop: "8px" }}>Digest: {error.digest}</p>
        )}
        <div style={{ marginTop: "16px", display: "flex", gap: "8px" }}>
          <button
            onClick={reset}
            style={{ padding: "8px 16px", background: "#111827", color: "white", border: "none", borderRadius: "6px", cursor: "pointer" }}
          >
            Coba lagi
          </button>
          <Link href="/login" style={{ padding: "8px 16px", border: "1px solid #d1d5db", borderRadius: "6px", textDecoration: "none", color: "#374151" }}>
            Login
          </Link>
        </div>
      </body>
    </html>
  );
}
