import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 7,
          background: "#0d1117",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        {/* Board surface */}
        <div style={{ position: "absolute", inset: 2, borderRadius: 4, background: "#111820", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontFamily: "Georgia, serif", fontSize: 18, fontWeight: 700, color: "white", marginTop: -4 }}>N</span>
        </div>
        {/* Lightning bolt */}
        <div style={{ position: "absolute", top: 2, right: 3, fontSize: 8, color: "#f59e0b" }}>⚡</div>
      </div>
    ),
    size
  );
}
