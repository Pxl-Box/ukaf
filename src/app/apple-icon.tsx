import { ImageResponse } from 'next/og';
import { FaviconArt } from '@/lib/favicon';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(<FaviconArt fontSize={88} offset={3} gap={4} />, { ...size });
}
