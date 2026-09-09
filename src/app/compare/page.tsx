import type { Metadata } from 'next';
import { CompareClient } from './CompareClient';
import { Breadcrumbs } from '@/components/ui/primitives';

export const metadata: Metadata = {
  title: 'Compare vehicles',
  description: 'Compare specification, mileage and price across the vehicles you are considering.',
  robots: { index: false, follow: true },
};

export default function ComparePage() {
  return (
    <div className="container-page py-8">
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Compare' }]} />
      <h1 className="text-2xl font-bold sm:text-3xl">Compare vehicles</h1>
      <p className="mt-1.5 text-sm text-steel-500">
        Side-by-side specification for the vehicles you have shortlisted. Your list is kept in this browser only.
      </p>

      <CompareClient />
    </div>
  );
}
