import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { getActiveCurrencies } from '@/lib/currency';
import { ProfileForm } from './ProfileForm';
import { AddressBook } from './AddressBook';

export const metadata: Metadata = {
  title: 'Profile & addresses',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const user = await requireUser('/account/profile');

  const [record, addresses, currencies] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: {
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        companyName: true,
        vatNumber: true,
        marketingOptIn: true,
        preferredCurrency: true,
        createdAt: true,
      },
    }),
    prisma.address.findMany({
      where: { userId: user.id },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    }),
    getActiveCurrencies(),
  ]);

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Profile & addresses</h1>
        <p className="mt-1 text-sm text-steel-500">
          Keep your details up to date so checkout and delivery run smoothly.
        </p>
      </header>

      <ProfileForm
        profile={{
          firstName: record.firstName,
          lastName: record.lastName,
          email: record.email,
          phone: record.phone ?? '',
          companyName: record.companyName ?? '',
          vatNumber: record.vatNumber ?? '',
          marketingOptIn: record.marketingOptIn,
          preferredCurrency: record.preferredCurrency,
        }}
        currencies={currencies.map((currency) => ({
          value: currency.code,
          label: `${currency.code} — ${currency.name}`,
        }))}
      />

      <div className="mt-8">
        <AddressBook
          addresses={addresses.map((address) => ({
            id: address.id,
            type: address.type,
            isDefault: address.isDefault,
            fullName: address.fullName,
            company: address.company ?? '',
            line1: address.line1,
            line2: address.line2 ?? '',
            city: address.city,
            county: address.county ?? '',
            postcode: address.postcode,
            country: address.country,
            phone: address.phone ?? '',
          }))}
        />
      </div>
    </div>
  );
}
