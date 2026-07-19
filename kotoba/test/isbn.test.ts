import { describe, it, expect, beforeEach } from "vitest";
import { MockEtzhayyim } from "@etzhayyim/sdk-mock";
import {
  registerBook,
  lookup,
  listBooks,
  coverage,
  isValidIsbn13,
  isbn10To13,
  normalizeIsbn,
} from "../src/index.js";

describe("isbn kotoba", () => {
  let e: any;

  beforeEach(() => {
    e = new MockEtzhayyim({ did: "did:web:isbn.etzhayyim.com" });
  });

  describe("registerBook", () => {
    it("registers a new book with valid ISBN-13", async () => {
      const result = await registerBook(e, {
        isbn13: "9784106102844",
        title: "Test Book",
        source: "openlibrary",
      });

      expect(result.status).toBe("registered");
      expect(result.bookUri).toBeDefined();
      expect(result.did).toBeDefined();
      expect(result.isbn13).toBe("9784106102844");
    });

    it("rejects with invalid checksum for ISBN-13", async () => {
      const result = await registerBook(e, {
        isbn13: "9784106102845", // Wrong check digit
        title: "Test Book",
        source: "openlibrary",
      });

      expect(result.status).toBe("invalidChecksum");
      expect(result.error).toBe("invalidIsbn13");
    });

    it("is idempotent on ISBN-13", async () => {
      const input = {
        isbn13: "9784106102844",
        title: "Test Book",
        source: "openlibrary" as const,
      };

      const first = await registerBook(e, input);
      expect(first.status).toBe("registered");
      const firstUri = first.bookUri;

      const second = await registerBook(e, input);
      expect(second.status).toBe("alreadyExists");
      expect(second.bookUri).toBe(firstUri);
    });

    it("derives ISBN-13 from ISBN-10", async () => {
      const result = await registerBook(e, {
        isbn10: "4106102846",
        title: "Test Book",
        source: "openlibrary",
      });

      expect(result.status).toBe("registered");
      expect(result.isbn13).toBe("9784106102844");
    });

    it("rejects missing title", async () => {
      const result = await registerBook(e, {
        isbn13: "9784106102845",
        title: "",
        source: "openlibrary",
      });

      expect(result.status).toBe("rejected");
      expect(result.error).toBe("missingRequiredFields");
    });

    it("rejects missing source", async () => {
      const result = await registerBook(e, {
        isbn13: "9784106102845",
        title: "Test Book",
        source: undefined as any,
      });

      expect(result.status).toBe("rejected");
      expect(result.error).toBe("missingRequiredFields");
    });
  });

  describe("lookup", () => {
    beforeEach(async () => {
      await registerBook(e, {
        isbn13: "9784106102844",
        isbn10: "4106102846",
        title: "Test Book",
        language: "ja",
        registrationGroup: "4",
        source: "openlibrary",
      });
    });

    it("finds book by ISBN-13", async () => {
      const result = await lookup(e, { isbn: "9784106102844" });

      expect(result.error).toBeUndefined();
      expect(result.book).toBeDefined();
      expect(result.book?.isbn13).toBe("9784106102844");
      expect(result.book?.title).toBe("Test Book");
    });

    it("finds book by ISBN-10", async () => {
      const result = await lookup(e, { isbn: "4106102846" });

      expect(result.error).toBeUndefined();
      expect(result.book).toBeDefined();
      expect(result.book?.isbn13).toBe("9784106102844");
    });

    it("handles hyphenated ISBN", async () => {
      const result = await lookup(e, { isbn: "978-4-10-610284-4" });

      expect(result.error).toBeUndefined();
      expect(result.book?.isbn13).toBe("9784106102844");
    });

    it("returns notFound for missing ISBN", async () => {
      const result = await lookup(e, { isbn: "9780000000002" });

      expect(result.error).toBe("notFound");
      expect(result.book).toBeUndefined();
    });

    it("returns error for missing isbn parameter", async () => {
      const result = await lookup(e, { isbn: "" });

      expect(result.error).toBe("missingIsbn");
    });

    it("rejects invalid ISBN-13 checksum", async () => {
      const result = await lookup(e, { isbn: "9784106102845" });

      expect(result.error).toBe("invalidIsbn13");
    });
  });

  describe("listBooks", () => {
    beforeEach(async () => {
      await registerBook(e, {
        isbn13: "9784106102844",
        title: "Japanese Book",
        language: "ja",
        registrationGroup: "4",
        source: "aozora",
        publicDomain: true,
      });
      await registerBook(e, {
        isbn13: "9780451524935",
        title: "English Book",
        language: "en",
        registrationGroup: "0",
        source: "gutenberg",
        publicDomain: true,
      });
      await registerBook(e, {
        isbn13: "9782070456697",
        title: "French Book",
        language: "fr",
        registrationGroup: "2",
        source: "openlibrary",
        publicDomain: false,
      });
    });

    it("lists all books", async () => {
      const result = await listBooks(e, {});

      expect(result.items.length).toBe(3);
      expect(result.total).toBe(3);
    });

    it("filters by language", async () => {
      const result = await listBooks(e, { language: "ja" });

      expect(result.items.length).toBe(1);
      expect(result.items[0]?.language).toBe("ja");
      expect(result.items[0]?.title).toBe("Japanese Book");
    });

    it("filters by registrationGroup", async () => {
      const result = await listBooks(e, { registrationGroup: "4" });

      expect(result.items.length).toBe(1);
      expect(result.items[0]?.registrationGroup).toBe("4");
    });

    it("filters by source", async () => {
      const result = await listBooks(e, { source: "aozora" });

      expect(result.items.length).toBe(1);
      expect(result.items[0]?.source).toBe("aozora");
    });

    it("filters by publicDomainOnly", async () => {
      const result = await listBooks(e, { publicDomainOnly: true });

      expect(result.items.length).toBe(2);
      expect(result.items.every((b) => b.publicDomain)).toBe(true);
    });

    it("respects limit parameter", async () => {
      const result = await listBooks(e, { limit: 2 });

      expect(result.items.length).toBeLessThanOrEqual(2);
    });

    it("combines multiple filters", async () => {
      const result = await listBooks(e, {
        language: "ja",
        publicDomainOnly: true,
      });

      expect(result.items.length).toBe(1);
      expect(result.items[0]?.language).toBe("ja");
      expect(result.items[0]?.publicDomain).toBe(true);
    });

    it("returns empty list when no books match filters", async () => {
      const result = await listBooks(e, { language: "de" });

      expect(result.items.length).toBe(0);
      expect(result.total).toBe(0);
    });
  });

  describe("coverage", () => {
    beforeEach(async () => {
      await registerBook(e, {
        isbn13: "9784106102844",
        title: "Japanese Book 1",
        language: "ja",
        registrationGroup: "4",
        source: "openlibrary",
        publicDomain: true,
      });
      await registerBook(e, {
        isbn13: "9780451524935",
        title: "English Book",
        language: "en",
        registrationGroup: "0",
        source: "gutenberg",
        publicDomain: true,
      });
      await registerBook(e, {
        isbn13: "9782070456697",
        title: "French Book",
        language: "fr",
        registrationGroup: "2",
        source: "openlibrary",
        publicDomain: false,
      });
    });

    it("aggregates coverage statistics", async () => {
      const result = await coverage(e, {});

      expect(result.total).toBe(3);
      expect(result.byLanguage).toBeDefined();
      expect(result.byLanguage?.ja).toBe(1);
      expect(result.byLanguage?.en).toBe(1);
      expect(result.byLanguage?.fr).toBe(1);
      expect(result.publicDomainCount).toBe(2);
    });

    it("counts by registrationGroup", async () => {
      const result = await coverage(e, {});

      expect(result.byRegistrationGroup).toBeDefined();
      expect(result.byRegistrationGroup?.["4"]).toBe(1);
      expect(result.byRegistrationGroup?.["0"]).toBe(1);
      expect(result.byRegistrationGroup?.["2"]).toBe(1);
    });

    it("counts by source", async () => {
      const result = await coverage(e, {});

      expect(result.bySource).toBeDefined();
      expect(result.bySource?.openlibrary).toBe(2);
      expect(result.bySource?.gutenberg).toBe(1);
    });

    it("respects maxScan limit", async () => {
      const result = await coverage(e, { maxScan: 1 });

      expect(result.total).toBeLessThanOrEqual(1);
      expect(result.truncated).toBe(true);
    });

    it("returns empty stats for no books", async () => {
      const fresh = new MockEtzhayyim({
        did: "did:web:isbn.etzhayyim.com",
      });
      const result = await coverage(fresh, {});

      expect(result.total).toBe(0);
      expect(result.publicDomainCount).toBe(0);
    });
  });
});
