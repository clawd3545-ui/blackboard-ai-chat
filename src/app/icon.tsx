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
        <div style={{
          position: "absolute",
          inset: "2px 2px 5px 2px",
          borderRadius: 5,
          background: "#111820",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
          paddingLeft: 4,
        }}>
          <span style={{ color: "white", fontSize: 20, fontWeight: 700, fontFamily: "serif", lineHeight: 1 }}>N</span>
        </div>
        {/* Lightning bolt */}
        <div style={{
          position: "absolute",
          top: 1,
          right: 3,
          color: "#f59e0b",
          fontSize: 10,
          fontWeight: 900,
        }}>⚡</div>
        {/* Tray */}
        <div style={{
          position: "absolute",
          bottom: 0,
          left: 2,
          right: 2,
          height: 3,
          borderRadius: 2,
          background: "#21262d",
        }} />
      </div>
    ),
    { ...size }
  );
}
