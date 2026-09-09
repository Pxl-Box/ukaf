import { z } from 'zod';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from './password';

/**
 * Every request body is validated here before it reaches the database.
 * Schemas are shared between route handlers, server actions and forms so the
 * client and server agree on what is acceptable.
 */

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

export const emailSchema = z
  .string()
  .trim()
  .min(3, 'Enter your email address.')
  .max(254, 'That email address is too long.')
  .toLowerCase()
  .email('Enter a valid email address.');

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`)
  .max(PASSWORD_MAX_LENGTH, 'Password is too long.');

export const nameSchema = z
  .string()
  .trim()
  .min(1, 'This field is required.')
  .max(80, 'Please use 80 characters or fewer.');

export const phoneSchema = z
  .string()
  .trim()
  .max(32, 'Phone number is too long.')
  .regex(/^[+0-9\s().-]*$/, 'Enter a valid phone number.')
  .optional()
  .or(z.literal(''));

/**
 * A phone number that is required — used where WhatsApp is the mandatory
 * contact route (general enquiries, part exchange), as opposed to
 * `phoneSchema`, which stays optional everywhere else (account profile,
 * checkout, addresses).
 */
export const whatsappSchema = z
  .string()
  .trim()
  .min(6, 'Enter your WhatsApp number.')
  .max(32, 'Phone number is too long.')
  .regex(/^[+0-9\s().-]*$/, 'Enter a valid phone number, including the country code.');

/** An email address that may be left blank. */
export const optionalEmailSchema = z
  .union([emailSchema, z.literal('')])
  .optional()
  .transform((value) => (value ? value : undefined));

export const optionalText = (max: number) =>
  z.string().trim().max(max, `Please use ${max} characters or fewer.`).optional().or(z.literal(''));

/** Honeypot: bots fill hidden fields, humans leave them empty. */
export const honeypotSchema = z.literal('').optional();

const numeric = z.union([z.string(), z.number()]);

export const intFromInput = (options: { min?: number; max?: number } = {}) =>
  numeric
    .transform((value) => (typeof value === 'string' ? value.replace(/[,\s]/g, '') : value))
    .pipe(z.coerce.number().int())
    .refine((value) => options.min === undefined || value >= options.min, {
      message: `Must be at least ${options.min}.`,
    })
    .refine((value) => options.max === undefined || value <= options.max, {
      message: `Must be at most ${options.max}.`,
    });

export const optionalInt = (options: { min?: number; max?: number } = {}) =>
  z
    .union([z.string(), z.number(), z.null(), z.undefined()])
    .transform((value) => {
      if (value === null || value === undefined) return null;
      if (typeof value === 'string') {
        const cleaned = value.replace(/[,\s]/g, '');
        if (cleaned === '') return null;
        return Number(cleaned);
      }
      return value;
    })
    .refine((value) => value === null || Number.isFinite(value), { message: 'Enter a valid number.' })
    .refine((value) => value === null || options.min === undefined || value >= options.min, {
      message: `Must be at least ${options.min}.`,
    })
    .refine((value) => value === null || options.max === undefined || value <= options.max, {
      message: `Must be at most ${options.max}.`,
    })
    .transform((value) => (value === null ? null : Math.round(value)));

export const booleanFromInput = z
  .union([z.boolean(), z.string(), z.undefined()])
  .transform((value) => value === true || value === 'true' || value === 'on' || value === '1');

export const currencyCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .length(3, 'Currency codes are three letters.')
  .regex(/^[A-Z]{3}$/, 'Currency codes are three letters.');

/** Money entered in major units by an admin, stored as minor units. */
export const moneyInput = z
  .union([z.string(), z.number()])
  .transform((value) => {
    const raw = typeof value === 'string' ? value.replace(/[^0-9.-]/g, '') : String(value);
    if (raw === '' || raw === '-') return Number.NaN;
    return Math.round(Number(raw) * 100);
  })
  .refine((value) => Number.isFinite(value), { message: 'Enter a valid amount.' })
  .refine((value) => value >= 0, { message: 'Amount cannot be negative.' })
  .refine((value) => value <= 2_000_000_000, { message: 'Amount is too large.' });

export const optionalMoneyInput = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((value) => {
    if (value === null || value === undefined || value === '') return null;
    const raw = typeof value === 'string' ? value.replace(/[^0-9.-]/g, '') : String(value);
    if (raw === '' || raw === '-') return null;
    return Math.round(Number(raw) * 100);
  })
  .refine((value) => value === null || (Number.isFinite(value) && value >= 0), {
    message: 'Enter a valid amount.',
  });

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

export const registerSchema = z
  .object({
    firstName: nameSchema,
    lastName: nameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    phone: phoneSchema,
    companyName: optionalText(120),
    marketingOptIn: booleanFromInput,
    acceptTerms: booleanFromInput.refine((value) => value === true, {
      message: 'You must accept the terms and conditions to create an account.',
    }),
    website: honeypotSchema, // honeypot
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password.'),
  remember: booleanFromInput.optional(),
  next: z.string().optional(),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
  website: honeypotSchema,
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(10, 'This reset link is invalid.'),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password.'),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

export const updateProfileSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  phone: phoneSchema,
  companyName: optionalText(120),
  vatNumber: optionalText(32),
  preferredCurrency: currencyCodeSchema.optional(),
  marketingOptIn: booleanFromInput,
});

export const addressSchema = z.object({
  type: z.enum(['BILLING', 'DELIVERY']).default('BILLING'),
  fullName: nameSchema,
  company: optionalText(120),
  line1: z.string().trim().min(1, 'Enter the first line of the address.').max(120),
  line2: optionalText(120),
  city: z.string().trim().min(1, 'Enter a town or city.').max(80),
  county: optionalText(80),
  postcode: z.string().trim().min(2, 'Enter a postcode.').max(16),
  country: z.string().trim().length(2, 'Select a country.').toUpperCase().default('GB'),
  phone: phoneSchema,
  isDefault: booleanFromInput.optional(),
});

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

export const stockStatusSchema = z.enum(['DRAFT', 'AVAILABLE', 'RESERVED', 'SOLD', 'ARCHIVED']);
export const conditionSchema = z.enum(['NEW', 'USED', 'EX_DEMO']);
export const fuelTypeSchema = z.enum(['DIESEL', 'ELECTRIC', 'HYDROGEN', 'CNG', 'LNG', 'HYBRID', 'PETROL']);
export const transmissionSchema = z.enum(['MANUAL', 'AUTOMATIC', 'SEMI_AUTOMATIC']);
export const emissionsSchema = z.enum(['EURO_3', 'EURO_4', 'EURO_5', 'EURO_6', 'ZERO_EMISSION']);
export const vatTreatmentSchema = z.enum(['PLUS_VAT', 'VAT_QUALIFYING', 'MARGIN_SCHEME', 'NO_VAT']);

const currentYear = new Date().getFullYear();

export const truckSchema = z.object({
  title: z.string().trim().min(3, 'Give the listing a title.').max(160),
  stockNumber: z.string().trim().min(1, 'Enter a stock number.').max(32),
  slug: z
    .string()
    .trim()
    .max(120)
    .regex(/^[a-z0-9-]*$/, 'Slugs may only contain lowercase letters, numbers and hyphens.')
    .optional()
    .or(z.literal('')),

  makeId: z.string().min(1, 'Select a make.'),
  modelId: z.string().optional().or(z.literal('')),
  modelName: z.string().trim().min(1, 'Enter the model.').max(80),
  variant: optionalText(80),
  categoryId: z.string().min(1, 'Select a body type.'),
  locationId: z.string().optional().or(z.literal('')),

  year: intFromInput({ min: 1970, max: currentYear + 2 }),
  mileageKm: optionalInt({ min: 0, max: 5_000_000 }),
  condition: conditionSchema.default('USED'),
  fuelType: fuelTypeSchema.default('DIESEL'),
  transmission: transmissionSchema.default('AUTOMATIC'),
  gears: optionalInt({ min: 1, max: 24 }),
  emissions: emissionsSchema.default('EURO_6'),

  axleConfig: optionalText(16),
  cabType: optionalText(60),
  bodyLengthMm: optionalInt({ min: 0, max: 30_000 }),
  wheelbaseMm: optionalInt({ min: 0, max: 15_000 }),
  grossWeightKg: optionalInt({ min: 0, max: 100_000 }),
  payloadKg: optionalInt({ min: 0, max: 100_000 }),
  engineCc: optionalInt({ min: 0, max: 30_000 }),
  powerBhp: optionalInt({ min: 0, max: 2_000 }),
  colour: optionalText(40),
  previousOwners: optionalInt({ min: 0, max: 50 }),
  motExpiry: z.string().optional().or(z.literal('')),
  serviceHistory: optionalText(200),

  registration: optionalText(16),
  vin: optionalText(32),
  costPriceNet: optionalMoneyInput,

  priceNet: moneyInput,
  retailPriceNet: optionalMoneyInput,
  vatTreatment: vatTreatmentSchema.default('PLUS_VAT'),
  vatRate: intFromInput({ min: 0, max: 10_000 }).default(2000),
  priceOnApplication: booleanFromInput,
  reservationFee: moneyInput.default(50000),

  quantity: intFromInput({ min: 0, max: 999 }).default(1),
  status: stockStatusSchema.default('DRAFT'),
  featured: booleanFromInput,

  shortDescription: optionalText(300),
  description: optionalText(20_000),
  features: z
    .union([z.string(), z.array(z.string())])
    .transform((value) =>
      (Array.isArray(value) ? value : value.split('\n'))
        .map((entry) => entry.trim())
        .filter(Boolean)
        .slice(0, 100),
    )
    .optional()
    .default([]),

  metaTitle: optionalText(70),
  metaDescription: optionalText(180),

  /**
   * Raw values for the selected category's admin-defined fields, keyed by
   * field `key`. Deliberately untyped here — the shape depends on which
   * category is chosen, so it is validated and coerced against that
   * category's `CategoryField` rows in the route handler (see
   * `coerceCustomFieldValues` in `@/lib/category-fields`), not by this schema.
   */
  customFields: z.record(z.string(), z.unknown()).optional().default({}),
});

export const truckImageSchema = z.object({
  truckId: z.string().min(1),
  url: z.string().trim().min(1, 'Enter an image URL.').max(2000),
  alt: optionalText(160),
  isPrimary: booleanFromInput.optional(),
});

export const makeSchema = z.object({
  name: z.string().trim().min(1, 'Enter a make name.').max(60),
  logoUrl: optionalText(2000),
  sortOrder: optionalInt({ min: 0, max: 999 }),
});

export const categorySchema = z.object({
  name: z.string().trim().min(1, 'Enter a category name.').max(60),
  description: optionalText(500),
  imageUrl: optionalText(2000),
  icon: optionalText(40),
  sortOrder: optionalInt({ min: 0, max: 999 }),
  isActive: booleanFromInput,
});

export const locationSchema = z.object({
  name: z.string().trim().min(1, 'Enter a depot name.').max(80),
  line1: optionalText(120),
  city: z.string().trim().min(1, 'Enter a town or city.').max(80),
  postcode: optionalText(16),
  country: z.string().trim().length(2).toUpperCase().default('GB'),
  phone: phoneSchema,
  email: z.union([emailSchema, z.literal('')]).optional(),
  isActive: booleanFromInput,
});

/** Public listing filters, parsed straight from the query string. */
export const truckFilterSchema = z.object({
  q: optionalText(120),
  make: optionalText(60),
  category: optionalText(60),
  condition: conditionSchema.optional(),
  fuelType: fuelTypeSchema.optional(),
  transmission: transmissionSchema.optional(),
  emissions: emissionsSchema.optional(),
  axleConfig: optionalText(16),
  location: optionalText(60),
  minPrice: optionalInt({ min: 0 }),
  maxPrice: optionalInt({ min: 0 }),
  minYear: optionalInt({ min: 1970, max: currentYear + 2 }),
  maxYear: optionalInt({ min: 1970, max: currentYear + 2 }),
  maxMileage: optionalInt({ min: 0 }),
  sort: z
    .enum(['newest', 'price-asc', 'price-desc', 'year-desc', 'year-asc', 'mileage-asc', 'popular'])
    .default('newest'),
  page: optionalInt({ min: 1, max: 500 }),
});

// ---------------------------------------------------------------------------
// Commerce
// ---------------------------------------------------------------------------

export const addToCartSchema = z.object({
  truckId: z.string().min(1, 'Select a vehicle.'),
  purchaseType: z.enum(['RESERVATION', 'FULL_PURCHASE']).default('RESERVATION'),
});

export const checkoutSchema = z.object({
  purchaseType: z.enum(['RESERVATION', 'FULL_PURCHASE']).default('RESERVATION'),
  email: emailSchema,
  firstName: nameSchema,
  lastName: nameSchema,
  phone: z.string().trim().min(6, 'Enter a contact phone number.').max(32),
  company: optionalText(120),

  billingLine1: z.string().trim().min(1, 'Enter the first line of your billing address.').max(120),
  billingLine2: optionalText(120),
  billingCity: z.string().trim().min(1, 'Enter a town or city.').max(80),
  billingPostcode: z.string().trim().min(2, 'Enter a postcode.').max(16),
  billingCountry: z.string().trim().length(2).toUpperCase().default('GB'),

  deliveryRequired: booleanFromInput,
  deliveryLine1: optionalText(120),
  deliveryCity: optionalText(80),
  deliveryPostcode: optionalText(16),
  deliveryCountry: optionalText(2),
  deliveryNotes: optionalText(500),

  discountCode: optionalText(40),
  customerNotes: optionalText(1000),
  acceptTerms: booleanFromInput.refine((value) => value === true, {
    message: 'Please accept the terms of sale to continue.',
  }),
  website: honeypotSchema,
});

export const orderStatusSchema = z.enum([
  'PENDING',
  'AWAITING_PAYMENT',
  'PAID',
  'IN_PREPARATION',
  'READY_FOR_COLLECTION',
  'COMPLETED',
  'CANCELLED',
  'REFUNDED',
]);

export const updateOrderSchema = z.object({
  status: orderStatusSchema.optional(),
  internalNotes: optionalText(4000),
  deliveryNotes: optionalText(1000),
});

export const discountSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(3, 'Codes must be at least 3 characters.')
    .max(40)
    .regex(/^[A-Z0-9-]+$/, 'Use letters, numbers and hyphens only.'),
  description: optionalText(200),
  type: z.enum(['FIXED', 'PERCENTAGE']).default('FIXED'),
  value: intFromInput({ min: 1 }),
  minSubtotal: optionalMoneyInput,
  usageLimit: optionalInt({ min: 1, max: 100_000 }),
  startsAt: z.string().optional().or(z.literal('')),
  expiresAt: z.string().optional().or(z.literal('')),
  isActive: booleanFromInput,
});

// ---------------------------------------------------------------------------
// CRM
// ---------------------------------------------------------------------------

export const enquirySchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  // WhatsApp is the mandatory contact route; email is a bonus, not a
  // requirement — a buyer can enquire with just their name and number.
  phone: whatsappSchema,
  email: optionalEmailSchema,
  company: optionalText(120),
  country: optionalText(2),
  subject: optionalText(160),
  message: z
    .string()
    .trim()
    .min(10, 'Please tell us a little more (at least 10 characters).')
    .max(4000, 'Please keep your message under 4000 characters.'),
  truckId: z.string().optional().or(z.literal('')),
  source: z
    .enum([
      'WEBSITE_ENQUIRY',
      'VEHICLE_ENQUIRY',
      'WHATSAPP',
      'PART_EXCHANGE',
      'FINANCE_APPLICATION',
      'NEWSLETTER',
      'REFERRAL',
    ])
    .default('WEBSITE_ENQUIRY'),
  utmSource: optionalText(80),
  utmMedium: optionalText(80),
  utmCampaign: optionalText(80),
  acceptPrivacy: booleanFromInput.refine((value) => value === true, {
    message: 'Please confirm you have read the privacy policy.',
  }),
  website: honeypotSchema,
});

export const partExchangeSchema = enquirySchema.extend({
  pxMake: z.string().trim().min(1, 'Enter the make of your vehicle.').max(60),
  pxModel: z.string().trim().min(1, 'Enter the model of your vehicle.').max(60),
  pxYear: optionalInt({ min: 1970, max: currentYear + 1 }),
  pxMileageKm: optionalInt({ min: 0, max: 5_000_000 }),
  pxRegistration: optionalText(16),
  pxCondition: optionalText(60),
});

export const leadStatusSchema = z.enum([
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'QUOTED',
  'NEGOTIATION',
  'WON',
  'LOST',
]);

export const updateLeadSchema = z.object({
  status: leadStatusSchema.optional(),
  assignedToId: z.string().optional().or(z.literal('')),
  estimatedValue: optionalMoneyInput,
  score: optionalInt({ min: 0, max: 100 }),
  nextActionAt: z.string().optional().or(z.literal('')),
  lostReason: optionalText(200),
});

export const activitySchema = z.object({
  leadId: z.string().optional().or(z.literal('')),
  orderId: z.string().optional().or(z.literal('')),
  type: z.enum(['NOTE', 'CALL', 'EMAIL', 'MEETING', 'TASK', 'VIEWING']).default('NOTE'),
  subject: optionalText(160),
  body: z.string().trim().min(1, 'Enter some detail.').max(4000),
  dueAt: z.string().optional().or(z.literal('')),
});

export const financeApplicationSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  email: emailSchema,
  phone: z.string().trim().min(6, 'Enter a contact phone number.').max(32),
  company: optionalText(120),
  yearsTrading: optionalInt({ min: 0, max: 200 }),
  truckId: z.string().optional().or(z.literal('')),
  vehiclePriceNet: moneyInput,
  depositNet: moneyInput,
  termMonths: intFromInput({ min: 6, max: 84 }),
  balloonNet: optionalMoneyInput,
  notes: optionalText(2000),
  acceptPrivacy: booleanFromInput.refine((value) => value === true, {
    message: 'Please confirm you have read the privacy policy.',
  }),
  website: honeypotSchema,
});

export const newsletterSchema = z.object({
  email: emailSchema,
  source: optionalText(60),
  website: honeypotSchema,
});

// ---------------------------------------------------------------------------
// Admin: users, currency, settings, content
// ---------------------------------------------------------------------------

export const roleSchema = z.enum(['CUSTOMER', 'SALES', 'MANAGER', 'ADMIN', 'SUPERADMIN']);
export const userStatusSchema = z.enum(['ACTIVE', 'PENDING', 'SUSPENDED', 'DELETED']);

export const adminCreateUserSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  email: emailSchema,
  role: roleSchema.default('CUSTOMER'),
  status: userStatusSchema.default('ACTIVE'),
  phone: phoneSchema,
  companyName: optionalText(120),
  password: passwordSchema.optional().or(z.literal('')),
  sendInvite: booleanFromInput.optional(),
  notes: optionalText(2000),
});

export const adminUpdateUserSchema = z.object({
  firstName: nameSchema.optional(),
  lastName: nameSchema.optional(),
  role: roleSchema.optional(),
  status: userStatusSchema.optional(),
  phone: phoneSchema,
  companyName: optionalText(120),
  vatNumber: optionalText(32),
  notes: optionalText(2000),
});

export const currencySchema = z.object({
  code: currencyCodeSchema,
  name: z.string().trim().min(1, 'Enter the currency name.').max(60),
  symbol: z.string().trim().min(1, 'Enter a symbol.').max(6),
  rateToBase: z
    .union([z.string(), z.number()])
    .pipe(z.coerce.number().positive('Rate must be greater than zero.').max(1_000_000)),
  decimals: intFromInput({ min: 0, max: 4 }).default(2),
  roundTo: intFromInput({ min: 1, max: 100_000 }).default(1),
  isActive: booleanFromInput,
  sortOrder: optionalInt({ min: 0, max: 999 }),
});

export const settingsSchema = z.object({
  siteName: optionalText(80),
  tagline: optionalText(160),
  contactEmail: z.union([emailSchema, z.literal('')]).optional(),
  contactPhone: phoneSchema,
  address: optionalText(300),
  openingHours: optionalText(300),
  defaultReservationFee: optionalMoneyInput,
  defaultVatRate: optionalInt({ min: 0, max: 10_000 }),
  financeApr: z
    .union([z.string(), z.number()])
    .transform((value) => Number(value))
    .refine((value) => Number.isFinite(value) && value >= 0 && value <= 100, {
      message: 'Enter an APR between 0 and 100.',
    })
    .optional(),
  enableGuestCheckout: booleanFromInput,
  enableFullPurchase: booleanFromInput,
  maintenanceMode: booleanFromInput,
});

export const pageSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, 'Enter a slug.')
    .max(80)
    .regex(/^[a-z0-9-]+$/, 'Use lowercase letters, numbers and hyphens.'),
  title: z.string().trim().min(1, 'Enter a title.').max(160),
  excerpt: optionalText(300),
  body: z.string().trim().min(1, 'The page needs some content.').max(200_000),
  version: optionalText(16),
  isPublished: booleanFromInput,
  metaTitle: optionalText(70),
  metaDescription: optionalText(180),
});

export const cookieConsentSchema = z.object({
  analytics: booleanFromInput,
  marketing: booleanFromInput,
  preferences: booleanFromInput,
  policyVersion: z.string().trim().max(16).default('1.0'),
});

export const testimonialSchema = z.object({
  authorName: nameSchema,
  company: optionalText(120),
  rating: intFromInput({ min: 1, max: 5 }).default(5),
  body: z.string().trim().min(10, 'Enter the testimonial.').max(2000),
  isApproved: booleanFromInput,
  isFeatured: booleanFromInput,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type TruckInput = z.infer<typeof truckSchema>;
export type TruckFilterInput = z.infer<typeof truckFilterSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type EnquiryInput = z.infer<typeof enquirySchema>;
export type FinanceApplicationInput = z.infer<typeof financeApplicationSchema>;
