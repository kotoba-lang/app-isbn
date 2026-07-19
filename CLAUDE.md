# isbn.etzhayyim.com — ISBN Book Identification

## Identity

| key | value |
|---|---|
| domain | isbn.etzhayyim.com |
| performerType | service |
| nanoid | bn7k2m4x |
| primary DID | `did:web:isbn.etzhayyim.com` |
| NSID prefix | `com.etzhayyim.isbn.*` |

## What This App Does

ISO 2108 International Standard Book Number registry。世界中の書籍を DID 化。ISBN-10/ISBN-13 統一管理。

- ISBN-13 (現行、978/979 prefix) + ISBN-10 (legacy) 相互変換
- Registration Group (言語/国) → path-based DID
- Check digit validation (ISBN-13: modulo 10, ISBN-10: modulo 11)
- Publisher prefix → 出版社 DID
- 書誌データ (タイトル、著者、出版社、出版年、言語)

## Multi-DID Model

| DID | 用途 |
|---|---|
| `did:web:isbn.etzhayyim.com` | App coordinator |
| `did:web:isbn.etzhayyim.com:{group}` | Registration Group (e.g., `0` English, `4` Japan) |

## Data Collections

| collection | NSID | 内容 |
|---|---|---|
| book | `com.etzhayyim.isbn.book` | ISBN master (isbn13, title, authors, publisher, year, language) |
| publisher | `com.etzhayyim.isbn.publisher` | Publisher prefix registry |
| edition | `com.etzhayyim.isbn.edition` | Edition/format variants (hardcover, paperback, ebook) |
| series | `com.etzhayyim.isbn.series` | Book series grouping |
| coverage_report | `com.etzhayyim.isbn.coverage_report` | Coverage metrics per group |
| book_chapter | `com.etzhayyim.isbn.book_chapter` | チャプター単位テキスト (isbn13, chapter_number, title, text, token_count, language) |
| book_fulltext | `com.etzhayyim.isbn.book_fulltext` | 全文メタデータ (isbn13, source, source_url, format, total_chapters, total_tokens, license) |
| book_copyright | `com.etzhayyim.isbn.book_copyright` | 著作権状態 (isbn13, status: pd/cc0/cc_by/cc_by_sa, author_death_year, jurisdiction, evidence_url) |

## SQL Graph (Fulltext)

```sql
(:Book)-[:HAS_CHAPTER]->(:BookChapter)
(:Book)-[:HAS_FULLTEXT]->(:BookFulltext)
(:Book)-[:HAS_COPYRIGHT]->(:BookCopyright {status: "pd"})
```

## Copyright Determination Logic

| 法域 | PD 判定 (2025年時点) |
|---|---|
| 日本 | 著者没後70年 (2018年改正)。1953年以前死亡 = 確実 PD |
| 米国 | 1929年以前出版 = PD |
| EU | 著者没後70年 |

## WIT Capability Exports

| interface | 機能 |
|---|---|
| `book-registry` | ISBN lookup, search, register, validate, convert (10↔13) |
| `publisher-registry` | Publisher prefix management |
| `cross-classification` | BISAC/BIC/Thema subject classification |
| `fulltext-library` | PD 全文格納 (ingest-fulltext, get-book-text, get-book-chapter, list-public-domain, check-copyright, bulk-ingest-catalog) |

## Cross-actor Integration

| Direction | Target | Method | Purpose |
|---|---|---|---|
| isbn → Follows | content.etzhayyim.com | ComAtprotoSyncSubscribeRepos | content_source から ISBN メタデータ抽出 + 書籍登録 |
| isbn → Follows | webpage.etzhayyim.com | ComAtprotoSyncSubscribeRepos | PD ソース (aozora/gutenberg/ndl) page から全文自動 ingest |

## Heartbeat (Shinka)

60s heartbeat → coverage per registration group → weakest group → ATPost

## Commands

| command | 説明 |
|---|---|
| `register-book` | ISBN + 書誌データ登録 |
| `lookup-isbn` | ISBN で書籍検索 |
| `search-books` | タイトル・著者で検索 |
| `validate-isbn` | Check digit validation |
| `list-books` | 書籍一覧 (language/group フィルタ) |
| `register-publisher` | 出版社 prefix 登録 |
| `list-publishers` | 出版社一覧 |
| `ingest-fulltext` | 全文 ingest (自動チャプター分割) |
| `get-book-text` | 全文メタデータ + チャプター取得 |
| `get-book-chapter` | 特定チャプター取得 |
| `list-public-domain` | PD 書籍一覧 (全文あり) |
| `check-copyright` | 著作権状態確認/設定 |
| `bulk-ingest-catalog` | Aozora/Gutenberg/NDL カタログ一括 ingest |

## Bulk Ingest Pipeline (BPMN-as-actor, ADR-0056, 2026-05-05)

**Status**: ✅ Live — schema deployed, 5 ingest sources running as **pure autonomous timer-start BPMN** in kotodama 0.3.36. **CF Worker は使用しない** (ADR-2604282300 K8s-internal routing 準拠)。XRPC 公開エンドポイントなし。

### Sources (autonomous timer-start, no XRPC entry)

| BPMN process | Source | Schedule (cron) | License | Fulltext |
|---|---|---|---|---|
| `isbn_ingest_open_library` | openlibrary.org/data dump | `0 0 0 5 * ?` (monthly day 5) | CC0 | no |
| `isbn_ingest_aozora` | 青空文庫 catalog (CSV) | `R/PT24H` (daily) | PD (JP) | yes (chapters → B2 + RisingWave) |
| `isbn_ingest_gutenberg` | Project Gutenberg via GutenDex | `R/PT24H` (daily) | PD (US) | yes |
| `isbn_ingest_ndl` | NDL Search SRU API | `0 0 0 ? * MON` (weekly Mon) | NDL ToS | no (metadata only) |
| `isbn_ingest_hathitrust` | HathiTrust hathifile (.txt.gz) | `0 0 0 8 * ?` (monthly day 8) | rights-flagged | no (rights URI only) |

### Tables (RisingWave Hyperdrive, ADR-0036)

```
vertex_isbn_book              ISBN-13 master + bibliographic metadata (PK = vertex_id)
vertex_isbn_publisher         publisher prefix → name registry
vertex_isbn_book_chapter      chunked plaintext (≤8 KiB target, 64 KiB hard cap)
vertex_isbn_book_fulltext     fulltext metadata (B2 bucket/prefix, sha256, license)
vertex_isbn_book_copyright    PD / CC0 / CC-BY / CC-BY-SA / © per jurisdiction
edge_isbn_book_publisher      book → publisher
mv_isbn_book_by_language      language → (book_count, pd_count)
mv_isbn_book_by_jurisdiction  jurisdiction × copyright_status → book_count
```

### Trigger surface (No CF Worker)

**Default**: 5 BPMNs fire autonomously per the cron schedule above. LangServer broker (K8s) → pod-side LangServer handler → RisingWave INSERT。**XRPC endpoint なし、`atproto.etzhayyim.com` 経由なし、CF Worker 経由なし**。

**Operator override (manual run)** — `kubectl exec` で in-pod 直接実行:

```bash
# Aozora 200 冊を即時 ingest (本文込み)
kubectl exec -n mitama-udf deploy/langserver-worker -- python -c "
import asyncio
from kotodama.primitives.isbn import task_isbn_aozora_ingest
print(asyncio.run(task_isbn_aozora_ingest(fulltext=True, limit=200)))
"

# HathiTrust hathifile (URL を Secret/env で注入)
kubectl exec -n mitama-udf deploy/langserver-worker -- python -c "
import asyncio
from kotodama.primitives.isbn import task_isbn_hathitrust_ingest
print(asyncio.run(task_isbn_hathitrust_ingest(
    hathifileUrl='https://www.hathitrust.org/files/hathifiles/hathi_full_YYYYMMDD.txt.gz',
    publicDomainOnly=True)))
"
```

**Read access** = RisingWave Hyperdrive 直接 (ADR-0036)。downstream consumer (yoro / search etc.) は `db.selectFrom("vertex_isbn_book")` で query。XRPC `lookup`/`list`/`coverage` lexicon は **schema 文書化のみ** で active endpoint なし。

### B2 storage layout (env: `B2_ISBN_BUCKET`, default `etzhayyim-isbn`)

```
etzhayyim-isbn/
├── aozora/{work_id}/original.txt
├── aozora/{work_id}/ch{NNNN}.txt
├── gutenberg/{ebook_id}/original.txt
└── gutenberg/{ebook_id}/ch{NNNN}.txt
```

When B2 credentials are absent the ingest still INSERTs chapter text inline into `vertex_isbn_book_chapter` (subject to the 64 KiB hard cap per chapter — works without ISBN are split before that limit).

### Synthetic ISBN-13 namespace

Aozora, Gutenberg, and Internet Archive works without a published ISBN are mapped to a deterministic numeric synthetic ISBN-13 in the unassigned `97990` range (`97990{source_digit}{stable_hash_digits}{check}`). This gives every PD work a stable graph key without colliding with real ISBNs.

### Files

- `30-graph/graph-schema/migrations/20260505100000_vertex_isbn_book.ts` — schema (5 vertex + 1 edge + 2 MV)
- `30-graph/graph-schema/migrations/20260505100100_seed_isbn_bpmn_actors.ts` — initial BPMN seed (v1, manual-start, superseded)
- `30-graph/graph-schema/migrations/20260505110000_isbn_bpmn_v2_no_cf_worker.ts` — **v2 redesign**: drop XRPC bindings, drop refreshDaily, all 5 ingests timer-start
- `00-contracts/lexicons/com/etzhayyim/apps/isbn/{book,lookup,list,coverage}.json` — 4 lexicons (1 record + 3 read query, schema documentation only — no live endpoint)
- `etzhayyim-root/00-contracts/bpmn/com/etzhayyim/isbn/*.bpmn` — 5 timer-start BPMN definitions
- `40-engine/kotoba/crates/kotoba-kotodama/py/src/kotodama/primitives/isbn.py` — 5 LangServer task handlers + chapter chunking + B2 sigv4
- `40-engine/kotoba/crates/kotoba-kotodama/py/src/kotodama/zeebe_worker_main.py` — `_isbn_register(worker)` wired after patent register
