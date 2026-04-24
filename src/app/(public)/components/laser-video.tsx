"use client";

export function LaserVideo() {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        borderRadius: "20px",
        overflow: "hidden",
        aspectRatio: "9/16",
        maxHeight: "560px",
        background: "#000",
      }}
    >
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        src="/img/personalizacion/laser-engraving.mp4"
        autoPlay
        loop
        muted
        playsInline
        disablePictureInPicture
        onContextMenu={(e) => e.preventDefault()}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: "block",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
