import { ImageResponse } from 'next/og';
import { FaviconArt } from '@/lib/favicon';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(<FaviconArt fontSize={18} offset={0.6} gap={1} />, { ...size });
}
