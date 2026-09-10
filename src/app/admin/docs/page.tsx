import type { Metadata } from 'next';
import { requireStaff } from '@/lib/auth';
import { AdminHeader } from '@/components/admin/shell';
import { DocsBrowser } from './DocsBrowser';

export const metadata: Metadata = {
  title: 'Help & guides',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminDocsPage() {
  await requireStaff();

  return (
    <div>
      <AdminHeader
        title="Help & guides"
        description="How to use each part of the admin — search or browse by section."
      />
      <DocsBrowser />
    </div>
  );
}
