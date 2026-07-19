/**
 * isbn kotoba — registry (slice 1, 4/4 canonical complete).
 *
 *   registerBook  — register a Book record (rkey=book-{isbn13}, idempotent)
 *                   Validates ISBN-13 checksum; rejects invalid.
 *                   Auto-derives isbn10 → isbn13 when only isbn10 supplied.
 *   lookup        — by ISBN-10 OR ISBN-13 (converts before rkey lookup)
 *   listBooks     — cursor + language/group/source/publicDomainOnly filter
 *   coverage      — aggregate counts by language/group/source + PD count
 *
 * Closes isbn kotoba at canonical 4/4 in one slice. Maps to the four
 * vendor lexicons: book.json (record) / lookup.json / list.json /
 * coverage.json.
 */

import type { Etzhayyim } from "@etzhayyim/sdk";
import {
  bookDid,
  bookRkey,
  isValidIsbn10,
  isValidIsbn13,
  isbn10To13,
  normalizeIsbn,
  type BookRecord,
  type BookView,
  type CoverageInput,
  type CoverageOutput,
  type IsbnSource,
  type ListBooksInput,
  type ListBooksOutput,
  type LookupInput,
  type LookupOutput,
  type RegisterBookInput,
  type RegisterBookOutput,
} from "./types.js";

const BOOK_COLLECTION = "com.etzhayyim.isbn.book";

const PAGE_LIMIT = 100;
const DEFAULT_MAX_SCAN = 10_000;

export async function registerBook(
  e: Etzhayyim,
  input: RegisterBookInput
): Promise<RegisterBookOutput> {
  if (!input.title || !input.source) {
    return { status: "rejected", error: "missingRequiredFields" };
  }
  let isbn13 = normalizeIsbn(input.isbn13 ?? "");
  let isbn10 = input.isbn10 ? normalizeIsbn(input.isbn10) : undefined;

  // Auto-derive isbn13 from isbn10 if needed.
  if (!isbn13 && isbn10) {
    const derived = isbn10To13(isbn10);
    if (!derived) return { status: "invalidChecksum", error: "invalidIsbn10" };
    isbn13 = derived;
  }
  if (!isbn13) return { status: "rejected", error: "missingIsbn" };
  if (!isValidIsbn13(isbn13)) {
    return { status: "invalidChecksum", error: "invalidIsbn13" };
  }
  if (isbn10 && !isValidIsbn10(isbn10)) {
    return { status: "invalidChecksum", error: "invalidIsbn10" };
  }

  const rkey = bookRkey(isbn13);
  const existing = await e
    .read<BookRecord>({ collection: BOOK_COLLECTION, rkey })
    .catch(() => ({ records: [] }));
  if (existing.records[0]?.value) {
    return {
      status: "alreadyExists",
      bookUri: existing.records[0].uri,
      did: existing.records[0].value.did,
      isbn13,
    };
  }
  const did = bookDid(isbn13);
  const now = new Date().toISOString();
  const record: BookRecord = {
    did,
    isbn13,
    isbn10,
    title: input.title,
    subtitle: input.subtitle,
    authors: input.authors,
    publisherPrefix: input.publisherPrefix,
    publicationYear: input.publicationYear,
    language: input.language,
    registrationGroup: input.registrationGroup,
    pageCount: input.pageCount,
    bisacSubjects: input.bisacSubjects,
    source: input.source,
    sourceUrl: input.sourceUrl,
    publicDomain: input.publicDomain,
    collectedAt: now,
    createdAt: now,
  };
  const receipt = await e.write({
    collection: BOOK_COLLECTION,
    record: record as unknown as Record<string, unknown>,
    rkey,
  });
  return {
    status: "registered",
    bookUri: receipt.uri,
    did,
    isbn13,
  };
}

export async function lookup(
  e: Etzhayyim,
  input: LookupInput
): Promise<LookupOutput> {
  if (!input.isbn) return { error: "missingIsbn" };
  const raw = normalizeIsbn(input.isbn);
  let isbn13: string | undefined;
  if (raw.length === 13) {
    if (!isValidIsbn13(raw)) return { error: "invalidIsbn13" };
    isbn13 = raw;
  } else if (raw.length === 10) {
    if (!isValidIsbn10(raw)) return { error: "invalidIsbn10" };
    isbn13 = isbn10To13(raw);
    if (!isbn13) return { error: "isbn10ConversionFailed" };
  } else {
    return { error: "invalidIsbnLength" };
  }
  const resp = await e
    .read<BookRecord>({
      collection: BOOK_COLLECTION,
      rkey: bookRkey(isbn13),
    })
    .catch(() => ({ records: [] }));
  const r = resp.records[0];
  if (!r) return { error: "notFound" };
  const view: BookView = { ...r.value, bookUri: r.uri };
  return { book: view };
}

export async function listBooks(
  e: Etzhayyim,
  input: ListBooksInput = {}
): Promise<ListBooksOutput> {
  const limit = Math.min(input.limit ?? 50, 200);
  const resp = await e.read<BookRecord>({
    collection: BOOK_COLLECTION,
    cursor: input.cursor,
    limit,
  });
  const items: BookView[] = resp.records
    .filter((r) => {
      const v = r.value;
      if (input.language && v.language !== input.language) return false;
      if (
        input.registrationGroup &&
        v.registrationGroup !== input.registrationGroup
      ) {
        return false;
      }
      if (input.source && v.source !== input.source) return false;
      if (input.publicDomainOnly && !v.publicDomain) return false;
      return true;
    })
    .map((r) => ({ ...r.value, bookUri: r.uri }));
  return { items, cursor: resp.cursor, total: items.length };
}

export async function coverage(
  e: Etzhayyim,
  input: CoverageInput = {}
): Promise<CoverageOutput> {
  const maxScan = Math.min(input.maxScan ?? DEFAULT_MAX_SCAN, DEFAULT_MAX_SCAN);
  let cursor: string | undefined;
  let scanned = 0;
  const byLanguage: Record<string, number> = {};
  const byRegistrationGroup: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  let publicDomainCount = 0;
  while (scanned < maxScan) {
    const page = await e.read<BookRecord>({
      collection: BOOK_COLLECTION,
      cursor,
      limit: PAGE_LIMIT,
    });
    for (const r of page.records) {
      if (scanned >= maxScan) break;
      const v = r.value;
      if (v.language) {
        byLanguage[v.language] = (byLanguage[v.language] ?? 0) + 1;
      }
      if (v.registrationGroup) {
        byRegistrationGroup[v.registrationGroup] =
          (byRegistrationGroup[v.registrationGroup] ?? 0) + 1;
      }
      bySource[v.source as IsbnSource] =
        (bySource[v.source as IsbnSource] ?? 0) + 1;
      if (v.publicDomain) publicDomainCount += 1;
      scanned += 1;
    }
    if (scanned >= maxScan || !page.cursor || page.records.length < PAGE_LIMIT) break;
    cursor = page.cursor;
  }
  return {
    total: scanned,
    byLanguage,
    byRegistrationGroup,
    bySource,
    publicDomainCount,
    truncated: scanned >= maxScan,
  };
}
