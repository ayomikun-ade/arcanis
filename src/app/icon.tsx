import { ImageResponse } from "next/og";

/**
 * Browser favicon. A chunky black-bordered "A" on the brand mint-lime —
 * the smallest readable rendition of the neobrutalism brand mark.
 *
 * Next.js auto-routes this at /icon and wires <link rel="icon"> in <head>.
 */

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

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
          background: "#b3f54f",
          color: "#000",
          fontWeight: 900,
          fontSize: 22,
          letterSpacing: "-0.04em",
          border: "3px solid #000",
          borderRadius: 5,
        }}
      >
        A
      </div>
    ),
    { ...size },
  );
}
