/**
 * Static product mark exposed at `/logo.png`.
 *
 * Generated at request time via next/og's ImageResponse so we don't ship
 * binary assets in the repo. The output is a 512×512 PNG matching the
 * `app/icon.svg` emblem (24-ray sunburst + "d" center). next/og caches
 * static-only routes (we use no Request-time APIs here).
 */
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
          background: "#0B0D0E",
          position: "relative",
        }}
      >
        {Array.from({ length: 24 }).map((_, i) => {
          const angle = (i * 360) / 24;
          const length = 210;
          const x = 256 + length * Math.cos((angle * Math.PI) / 180);
          const y = 256 + length * Math.sin((angle * Math.PI) / 180);
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: 256,
                top: 256,
                width: length,
                height: 8,
                background: "#C9A961",
                borderRadius: 4,
                opacity: 0.9,
                transformOrigin: "0 50%",
                transform: `translate(0, -4px) rotate(${angle}deg)`,
              }}
            />
          );
        })}
        <div
          style={{
            position: "absolute",
            left: 184,
            top: 184,
            width: 144,
            height: 144,
            borderRadius: 72,
            background: "#0B0D0E",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#C9A961",
            fontSize: 96,
            fontWeight: 600,
          }}
        >
          d
        </div>
      </div>
    ),
    { width: 512, height: 512 },
  );
}
