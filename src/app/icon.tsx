import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
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
        <div style={{ display: 'flex', fontSize: 15, lineHeight: 1, letterSpacing: -0.5 }}>UK</div>
        <div style={{ display: 'flex', fontSize: 15, lineHeight: 1, letterSpacing: -0.5, color: '#f5a30b' }}>AF</div>
      </div>
    ),
    { ...size },
  );
}
