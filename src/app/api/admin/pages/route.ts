import { z } from 'zod';
import { prisma } from '@/lib/db';
import { guard, handler, isResponse, notFound, ok, parseJson, requireApiRole } from '@/lib/api';
import { pageSchema } from '@/lib/validation';
import { recordAudit } from '@/lib/audit';

/**
 * Legal and informational page content.
 *
 * Each save bumps the version string so it is clear which revision a customer
 * agreed to — useful evidence if terms are ever disputed.
 */

export const POST = handler(async (request: Request) => {
  const blocked = await guard(request, { limit: 'adminWrite' });
  if (blocked) return blocked;

  const user = await requireApiRole('ADMIN');
  if (isResponse(user)) return user;

  const input = await parseJson(request, pageSchema);

  const page = await prisma.page.upsert({
    where: { slug: input.slug },
    create: {
      slug: input.slug,
      title: input.title,
      excerpt: input.excerpt || null,
      body: input.body,
      version: input.version || '1.0',
      isPublished: input.isPublished,
      metaTitle: input.metaTitle || null,
      metaDescription: input.metaDescription || null,
      publishedAt: input.isPublished ? new Date() : null,
    },
    update: {
      title: input.title,
      excerpt: input.excerpt || null,
      body: input.body,
      version: input.version || undefined,
      isPublished: input.isPublished,
      metaTitle: input.metaTitle || null,
      metaDescription: input.metaDescription || null,
      publishedAt: input.isPublished ? new Date() : null,
    },
  });

  await recordAudit({
    action: 'page.updated',
    actor: user,
    entity: 'Page',
    entityId: page.id,
    summary: `Saved /${page.slug} (version ${page.version})`,
  });

  return ok({ page });
});

export const DELETE = handler(async (request: Request) => {
  const blocked = await guard(request, { limit: 'adminWrite' });
  if (blocked) return blocked;

  const user = await requireApiRole('ADMIN');
  if (isResponse(user)) return user;

  const { slug } = await parseJson(request, z.object({ slug: z.string().min(1) }));

  const page = await prisma.page.findUnique({ where: { slug }, select: { id: true } });
  if (!page) return notFound('Page');

  await prisma.page.delete({ where: { slug } });

  await recordAudit({
    action: 'page.updated',
    actor: user,
    entity: 'Page',
    entityId: page.id,
    summary: `Deleted /${slug}`,
  });

  return ok({ deleted: true });
});
