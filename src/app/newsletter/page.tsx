import type { Metadata } from 'next';
import Link from 'next/link';
import { AlertIcon, CheckCircleIcon, MailIcon } from '@/components/ui/Icons';

export const metadata: Metadata = {
  title: 'Stock alerts',
  robots: { index: false, follow: true },
};

const STATES = {
  confirmed: {
    icon: <CheckCircleIcon className="text-4xl text-emerald-600" />,
    title: 'You are subscribed',
    body: 'Thanks — we will email you when stock arrives that matches what you are looking for. Never more than a couple of times a month, and you can unsubscribe from any email in one click.',
  },
  already: {
    icon: <CheckCircleIcon className="text-4xl text-emerald-600" />,
    title: 'Already subscribed',
    body: 'You are on the list — nothing more to do.',
  },
  unsubscribed: {
    icon: <MailIcon className="text-4xl text-steel-500" />,
    title: 'Unsubscribed',
    body: 'You will not receive any more stock alerts from us. Transactional emails about orders and enquiries will still be sent, because you need those.',
  },
  invalid: {
    icon: <AlertIcon className="text-4xl text-amber-600" />,
    title: 'That link is not valid',
    body: 'The link may be incomplete or have already been used. Try subscribing again from the footer of any page.',
  },
};

export default async function NewsletterStatusPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const key = typeof params.status === 'string' && params.status in STATES ? params.status : 'invalid';
  const state = STATES[key as keyof typeof STATES];

  return (
    <div className="container-page py-16">
      <div className="mx-auto max-w-lg text-center">
        {state.icon}
        <h1 className="mt-4 text-2xl font-bold">{state.title}</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-steel-600">{state.body}</p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/trucks" className="btn-primary">
            Browse stock
          </Link>
          <Link href="/account/profile" className="btn-secondary">
            Manage email preferences
          </Link>
        </div>

        <p className="mt-8 text-xs text-steel-400">
          You can change your marketing preferences at any time in your account, or read our{' '}
          <Link href="/legal/privacy" className="underline hover:text-steel-600">
            privacy policy
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
