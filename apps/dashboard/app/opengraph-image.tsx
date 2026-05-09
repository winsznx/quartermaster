/**
 * Open Graph card for the dashboard — 1200×630 PNG generated at request
 * time via next/og. The dashboard's per-route titles use the metadata
 * template ("Overview | Quartermaster", etc.) so this OG card stays
 * generic — links to /overview, /policies, /treasury all share the
 * same product preview.
 */
import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Quartermaster Dashboard — operational interface for your agent fleet.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 96px",
          background:
            "radial-gradient(circle at 80% 20%, rgba(201,169,97,0.18), transparent 50%), #0B0D0E",
          color: "#F5F1E8",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <Emblem size={56} />
          <span
            style={{
              fontFamily: "monospace",
              fontSize: 18,
              letterSpacing: 4,
              textTransform: "uppercase",
              color: "#9A9285",
            }}
          >
            Quartermaster — dashboard
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div style={{ fontSize: 96, fontWeight: 400, lineHeight: 1.05, letterSpacing: -2 }}>
            Watch the daemon work.
          </div>
          <div style={{ fontSize: 32, color: "#C9C4B5", maxWidth: 920, lineHeight: 1.35 }}>
            Live fleet runway, every burn-rate-oracle decision, every top-up tx hash. Polls a
            local daemon by default; targets a Railway daemon when deployed.
          </div>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 22,
            color: "#9A9285",
          }}
        >
          <span style={{ fontFamily: "monospace" }}>quartermaster-dashboard.vercel.app</span>
          <span style={{ fontFamily: "monospace", color: "#C9A961" }}>
            github.com/winsznx/quartermaster
          </span>
        </div>
      </div>
    ),
    { ...size },
  );
}

function Emblem({ size: emblemSize = 56 }: { size?: number }) {
  const center = emblemSize / 2;
  const lineLength = emblemSize * 0.42;
  return (
    <div style={{ position: "relative", width: emblemSize, height: emblemSize }}>
      {Array.from({ length: 24 }).map((_, i) => {
        const angle = (i * 360) / 24;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: center,
              top: center,
              width: lineLength,
              height: 1.5,
              background: "#C9A961",
              borderRadius: 1,
              transformOrigin: "0 50%",
              transform: `translate(0, -0.75px) rotate(${angle}deg)`,
            }}
          />
        );
      })}
      <div
        style={{
          position: "absolute",
          left: center - emblemSize * 0.15,
          top: center - emblemSize * 0.15,
          width: emblemSize * 0.3,
          height: emblemSize * 0.3,
          borderRadius: emblemSize * 0.15,
          background: "#0B0D0E",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#C9A961",
          fontSize: emblemSize * 0.22,
          fontWeight: 600,
        }}
      >
        d
      </div>
    </div>
  );
}
