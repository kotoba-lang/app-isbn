# isbn kotoba

Phase E Option B reference implementation of isbn (ISO 2108 book registry) on the etzhayyim substrate.

Per [ADR-2605203000](../../../90-docs/adr/2605203000-kotoba-write-target-options.md), isbn migrates from vendor's `createKyselyDb` pattern to **Option B** — PDS XRPC writes via `@etzhayyim/sdk e.write()`.

Coverage: **4 of 4 (100%) canonical** isbn lexicons ported.

| Tier | Commands | Slice |
|---|---|---|
| Book Registry | registerBook, lookup, listBooks, coverage | **1** |

## Authority-chain DIDs

```
did:web:isbn.etzhayyim.com                       — controller
did:web:isbn.etzhayyim.com:{group}               — Registration Group (0=eng, 4=jpn)
did:web:isbn.etzhayyim.com:book:{isbn13}         — Book
```

## Check-digit validation

- **ISBN-13** modulo 10 with alternating weights 1/3 (`isValidIsbn13`)
- **ISBN-10** modulo 11 with weights 10..1, X=10 (`isValidIsbn10`)
- `isbn10To13` derives the 978-prefixed ISBN-13 from a valid ISBN-10

`registerBook` rejects with `invalidChecksum` on bad ISBN. `lookup` accepts either form and normalizes hyphens / case.

## Usage

```ts
import { Etzhayyim } from "@etzhayyim/sdk";
import { registerBook, lookup } from "@etzhayyim/isbn-kotoba";

const e = new Etzhayyim({
  did: "did:web:isbn.etzhayyim.com",
  pdsUrl: "https://pds.etzhayyim.com",
  l2RpcUrl: "https://mainnet.base.org",
});

// Register with ISBN-13 (or supply isbn10 and let it derive)
const r = await registerBook(e, {
  isbn13: "9784106102844",
  title: "ノルウェイの森",
  authors: ["村上春樹"],
  language: "ja",
  registrationGroup: "4",
  publicationYear: 1987,
  source: "ndl",
  publicDomain: false,
});

// Look up either way
const found = await lookup(e, { isbn: "978-4-10-610284-4" });  // hyphens fine
const found2 = await lookup(e, { isbn: "9784106102844" });
```

## Sibling reference impls (12 actors)

| Actor | Coverage | Status |
|---|---|---|
| hanrei | 31/31 | complete |
| ipaddress | 37/37 | complete |
| sbom | 17/N (canonical 4/4) | canonical complete |
| kiyo | 12/12 | complete |
| ki | 4/4 | complete |
| otakiage | 13 (10/10 canonical) | complete |
| houki | 9 (8/8 canonical) | complete |
| open-banking | 5/5 | complete |
| open-denki | 12/12 | complete |
| koke | 4/4 | complete |
| hakkou | 3 (2/2 canonical) | complete |
| **isbn** | **4/4** | **complete** |
