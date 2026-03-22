import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          borderRadius: 40,
          background: "#0d1117",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        <div style={{ position: "absolute", inset: 10, borderRadius: 20, background: "#111820", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontFamily: "Georgia, serif", fontSize: 110, fontWeight: 700, color: "white", marginTop: -20 }}>N</span>
        </div>
        <div style={{ position: "absolute", top: 14, right: 18, fontSize: 44, color: "#f59e0b" }}>⚡</div>
      </div>
    ),
    size
  );
}
