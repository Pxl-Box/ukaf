# Admin documentation changelog

This app is still under active development, so admin-facing behaviour keeps
changing faster than documentation can reasonably keep up in real time. This
file is a running log of admin-facing changes, kept so the in-app docs
(`/admin/docs`, content in `src/lib/admin-docs.ts`) can be reconciled and
corrected in a dedicated pass later, rather than trying to keep them
perfectly in sync on every commit.

**Convention:** whenever a change alters, adds, or removes admin-facing
behaviour, add a dated entry below noting what changed and which doc
article(s) in `src/lib/admin-docs.ts` it affects (by `slug`). Once an entry
has been checked against the docs and they've been corrected if needed,
strike it through (`~~like this~~`) rather than deleting it, so there's a
history of what's already been reconciled.

---

## 2026-09-10

- Initial documentation system built: `/admin/docs` (searchable, browsable
  by section), content in `src/lib/admin-docs.ts`, rendered by
  `src/app/admin/docs/DocsBrowser.tsx`. Covers every admin section that
  existed at the time of writing — see that file for the full article list.
- Added pipeline drag-and-drop (desktop only) — affects `pipeline` article,
  which already documents this since it was written after the feature.
- Fixed `EnquiryForm.tsx`: phone was optional and email was required in the
  UI, the opposite of what `enquirySchema` actually enforces (phone
  mandatory, email optional — from the WhatsApp-mandatory-contact work).
  Pure bug fix, brings the UI in line with behaviour the `enquiries` article
  already describes correctly.
- Added dark mode toggle. No dedicated doc article — it's supporting UI, not
  an admin workflow, so it didn't seem worth a guide. Revisit if that
  judgement turns out wrong.

### Known gaps at time of writing (not built, so not documented as if they exist)

Flagged here so whoever builds these remembers to add/update the
corresponding doc article rather than leaving it silently missing:

- **Public-facing WhatsApp button** on vehicle pages — customers currently
  reach staff via the enquiry form (which collects a WhatsApp number), not a
  direct "Message us on WhatsApp" link. Affects `whatsapp-enquiries`.
- **Shipping cost calculator** — `ShippingZone`/`ShippingRate` Prisma models
  and a migration exist, but there is no admin UI or quote logic built on
  top of them yet. No doc article exists for this — add one (probably under
  "Pricing & currency") once it's built.
- **Bulk CSV import/export for vehicles** — not built. Documented honestly
  as not-yet-built in `bulk-import-export` rather than omitted, so nobody
  mistakes silence for "ask someone else."
- **"Listings revised weekly" staleness indicator** — mentioned in the
  original requirements, not implemented. No doc article.
