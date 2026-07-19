/**
 * isbn kotoba — record types.
 *
 * Per ADR-2605203000 Option B (PDS XRPC). ISO 2108 International
 * Standard Book Number registry. ISBN-10/ISBN-13 unified management.
 *
 * Identity hierarchy:
 *   did:web:isbn.etzhayyim.com                              — controller
 *   did:web:isbn.etzhayyim.com:{group}                      — Registration Group
 *                                                            (0=eng, 4=jpn, ...)
 *   did:web:isbn.etzhayyim.com:book:{isbn13}                — Book
 */

export const ISBN_DID_PREFIX = "did:web:isbn.etzhayyim.com:" as const;

export type IsbnSource =
  | "openlibrary"
  | "aozora"
  | "gutenberg"
  | "ndl"
  | "hathitrust"
  | "europeana"
  | "other";

// ─── Book tier (slice 1) ────────────────────────────────────────────

export interface BookRecord {
  did: string;
  /** ISBN-13 with no hyphens (canonical key). */
  isbn13: string;
  /** ISBN-10 with no hyphens (legacy). */
  isbn10?: string;
  title: string;
  subtitle?: string;
  authors?: string[];
  publisherPrefix?: string;
  publicationYear?: number;
  /** ISO 639-1 / 639-3. */
  language?: string;
  /** ISBN registration group (0=eng, 4=jpn, etc.) */
  registrationGroup?: string;
  pageCount?: number;
  bisacSubjects?: string[];
  source: IsbnSource;
  sourceUrl?: string;
  collectedAt: string;
  /** Public domain flag — true if outside copyright (e.g. aozora,
   *  gutenberg, pre-1929 US works). */
  publicDomain?: boolean;
  createdAt: string;
}

export interface BookView extends BookRecord {
  bookUri: string;
}

export interface RegisterBookInput {
  isbn13: string;
  isbn10?: string;
  title: string;
  subtitle?: string;
  authors?: string[];
  publisherPrefix?: string;
  publicationYear?: number;
  language?: string;
  registrationGroup?: string;
  pageCount?: number;
  bisacSubjects?: string[];
  source: IsbnSource;
  sourceUrl?: string;
  publicDomain?: boolean;
}

export interface RegisterBookOutput {
  status:
    | "registered"
    | "alreadyExists"
    | "rejected"
    | "invalidChecksum";
  bookUri?: string;
  did?: string;
  isbn13?: string;
  error?: string;
}

export interface LookupInput {
  /** ISBN-13 or ISBN-10 (hyphens stripped automatically). */
  isbn?: string;
}

export interface LookupOutput {
  book?: BookView;
  error?: string;
}

export interface ListBooksInput {
  language?: string;
  registrationGroup?: string;
  source?: IsbnSource;
  publicDomainOnly?: boolean;
  limit?: number;
  cursor?: string;
}

export interface ListBooksOutput {
  items: BookView[];
  cursor?: string;
  total: number;
}

export interface CoverageInput {
  maxScan?: number;
}

export interface CoverageOutput {
  total?: number;
  byLanguage?: Record<string, number>;
  byRegistrationGroup?: Record<string, number>;
  bySource?: Record<string, number>;
  publicDomainCount?: number;
  truncated?: boolean;
  error?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────

export function normalizeIsbn(isbn: string): string {
  return isbn.replace(/[^0-9Xx]/g, "").toUpperCase();
}

/** ISBN-13 checksum: modulo 10 with alternating weights 1/3. */
export function isValidIsbn13(isbn13: string): boolean {
  if (!/^\d{13}$/.test(isbn13)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += Number(isbn13[i]) * (i % 2 === 0 ? 1 : 3);
  }
  const check = (10 - (sum % 10)) % 10;
  return check === Number(isbn13[12]);
}

/** ISBN-10 checksum: modulo 11 with weights 10..1 (X = 10). */
export function isValidIsbn10(isbn10: string): boolean {
  if (!/^\d{9}[\dX]$/.test(isbn10)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += Number(isbn10[i]) * (10 - i);
  }
  const last = isbn10[9];
  const checkValue = last === "X" ? 10 : Number(last);
  sum += checkValue;
  return sum % 11 === 0;
}

export function isbn10To13(isbn10: string): string | undefined {
  if (!isValidIsbn10(isbn10)) return undefined;
  const prefix = "978" + isbn10.slice(0, 9);
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += Number(prefix[i]) * (i % 2 === 0 ? 1 : 3);
  }
  const check = (10 - (sum % 10)) % 10;
  return prefix + check;
}

export function bookDid(isbn13: string): string {
  return `${ISBN_DID_PREFIX}book:${isbn13}`;
}

export function bookRkey(isbn13: string): string {
  return `book-${isbn13}`;
}

export function registrationGroupDid(group: string): string {
  return `${ISBN_DID_PREFIX}${group}`;
}
