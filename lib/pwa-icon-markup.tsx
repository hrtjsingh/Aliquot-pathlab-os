/** Inline-style mark for ImageResponse / PWA PNG icons. */
export function PwaIconMarkup() {
  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        alignItems: "center",
        justifyContent: "center",
        background: "#1C3F52",
      }}
    >
      <div
        style={{
          display: "flex",
          position: "relative",
          width: "62%",
          height: "62%",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            width: "70%",
            height: "78%",
            borderRadius: 10,
            background: "#F4F6F7",
          }}
        />
        <div
          style={{
            display: "flex",
            position: "absolute",
            left: "8%",
            top: "2%",
            width: "28%",
            height: "36%",
            borderRadius: "50%",
            background: "#0F766E",
          }}
        />
      </div>
    </div>
  );
}
