import { ImageResponse } from "next/og";

/**
 * iOS home-screen icon (180×180). Same brand mark as /icon, scaled up
 * with proportional border and corner radius.
 */

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#b3f54f",
          color: "#000",
          fontWeight: 900,
          fontSize: 130,
          letterSpacing: "-0.04em",
          border: "12px solid #000",
          borderRadius: 28,
        }}
      >
        A
      </div>
    ),
    { ...size },
  );
}
