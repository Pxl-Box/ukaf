import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#142257',
          color: '#fff',
          fontFamily: 'system-ui, sans-serif',
          fontWeight: 800,
        }}
      >
        <div style={{ display: 'flex', fontSize: 76, lineHeight: 1, letterSpacing: -2 }}>UK</div>
        <div style={{ display: 'flex', fontSize: 76, lineHeight: 1, letterSpacing: -2, color: '#f5a30b' }}>AF</div>
      </div>
    ),
    { ...size },
  );
}
