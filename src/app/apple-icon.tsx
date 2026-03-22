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
        <div style={{
          position: "absolute",
          inset: "14px 14px 28px 14px",
          borderRadius: 20,
          background: "#111820",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
          paddingLeft: 18,
        }}>
          <span style={{ color: "white", fontSize: 110, fontWeight: 700, fontFamily: "serif", lineHeight: 1 }}>N</span>
        </div>
        <div style={{
          position: "absolute",
          top: 14,
          right: 18,
          color: "#f59e0b",
          fontSize: 44,
          fontWeight: 900,
        }}>⚡</div>
        <div style={{
          position: "absolute",
          bottom: 0,
          left: 14,
          right: 14,
          height: 14,
          borderRadius: 8,
          background: "#21262d",
        }} />
      </div>
    ),
    { ...size }
  );
}
