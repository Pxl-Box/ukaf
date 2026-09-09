/**
 * Shared favicon artwork: "UK" / "AF" stacked in a square. Satori (which
 * `next/og`'s ImageResponse uses to rasterise these) falls back to a single
 * built-in font weight regardless of the `fontWeight` CSS value when no
 * custom font file is registered, so a numeric fontWeight alone has no
 * visible effect — this fakes a bold stroke instead by layering the same
 * glyphs at a few pixel offsets.
 */

const OFFSETS: Array<[number, number]> = [
  [0, 0],
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [-1, -1],
];

function BoldLine({ children, color, fontSize, offset }: { children: string; color: string; fontSize: number; offset: number }) {
  return (
    <div style={{ position: 'relative', display: 'flex', fontSize, lineHeight: 1 }}>
      {OFFSETS.map(([x, y], i) => (
        <div
          key={i}
          style={{
            position: i === 0 ? 'relative' : 'absolute',
            top: y * offset,
            left: x * offset,
            display: 'flex',
            color,
          }}
        >
          {children}
        </div>
      ))}
    </div>
  );
}

export function FaviconArt({ fontSize, offset, gap }: { fontSize: number; offset: number; gap: number }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#142257',
        fontFamily: 'system-ui, sans-serif',
        gap,
      }}
    >
      <BoldLine color="#fff" fontSize={fontSize} offset={offset}>
        UK
      </BoldLine>
      <BoldLine color="#f5a30b" fontSize={fontSize} offset={offset}>
        AF
      </BoldLine>
    </div>
  );
}
