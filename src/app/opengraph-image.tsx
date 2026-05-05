import { ImageResponse } from "next/og";

/**
 * Open Graph + Twitter card image. Generated at build time.
 *
 * Twitter falls back to this when no twitter-image.{ext} is provided and
 * the metadata declares `card: "summary_large_image"`.
 */

export const alt = "Arcanis — End-to-end encrypted messaging";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 64,
          background: "#f5f2e9",
          backgroundImage:
            "radial-gradient(circle, rgba(0,0,0,0.10) 1.5px, transparent 1.5px)",
          backgroundSize: "32px 32px",
          color: "#000",
          fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        }}
      >
        {/* Top row: E2EE badge */}
        <div style={{ display: "flex" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: "10px 20px",
              background: "#f0e548",
              border: "3px solid #000",
              borderRadius: 6,
              boxShadow: "6px 6px 0 0 #000",
              fontWeight: 800,
              fontSize: 22,
              letterSpacing: "-0.01em",
              textTransform: "uppercase",
            }}
          >
            🔒 End-to-end encrypted
          </div>
        </div>

        {/* Wordmark + tagline */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <h1
            style={{
              margin: 0,
              fontSize: 220,
              fontWeight: 900,
              lineHeight: 0.9,
              letterSpacing: "-0.04em",
              textTransform: "uppercase",
            }}
          >
            Arcanis
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: 36,
              fontWeight: 600,
              maxWidth: 900,
              lineHeight: 1.2,
              color: "#3a3a3a",
            }}
          >
            A zero-knowledge messenger. Your messages are encrypted on your
            device — the server only ever sees ciphertext.
          </p>
        </div>

        {/* Bottom row: brand mark + tech footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 92,
              height: 92,
              background: "#b3f54f",
              color: "#000",
              fontWeight: 900,
              fontSize: 64,
              letterSpacing: "-0.04em",
              border: "5px solid #000",
              borderRadius: 12,
              boxShadow: "8px 8px 0 0 #000",
            }}
          >
            A
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: "0.02em",
              textTransform: "uppercase",
              color: "#3a3a3a",
            }}
          >
            RSA-OAEP · AES-GCM · Web Crypto
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
