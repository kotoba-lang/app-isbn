# app-isbn — itonami（dapp）上の分散型設計

状態: 第 1 スライス実装（2026-10-20）。正本はこの文書。
追跡: Linear JUN-128（親 JUN-116）。

## 位置づけ

app-isbn は ISO 2108 の書籍レジストリ —— ISBN-10/ISBN-13 の統合管理、
**チェックデジット検証と自動変換**（ADR-2605203000 Option B Phase E 参照実装、
TS + vitest）。

## このスライス: ISBN 判定コア

| 層 | 実体 | 状態 |
|---|---|---|
| 判定コア guest | `aiueos/isbn_judgment.cljk` — isbn13-valid（重み 1/3 交互 mod 10）/ isbn10-valid（重み 10..1 mod 11、X=10）/ isbn10-to-13（978 + 9 桁 + チェック自動計算） | **実装済み・実測** |
| 記述子 | `aiueos/isbn.edn` | **実装済み** |
| parity | `kotoba/test/parity_vectors.mjs` — **正本 TS を node で直接実行**し同一ベクタで一致（変換・拒否含む） | **実装済み・実測** |

実測: `amu test aiueos/isbn_judgment.cljk` → **18/18**（jvm-kir / js / wasm）。
parity → node 実行 7 ベクタ全通過（正本 `kotoba/src/types.ts` を type-strip 実行）。

## 実測で追従した分類

- チェック 10 は **X**（ISBN-10）。guest は数値 10 で受け、正本の
  `isValidIsbn10("080442957X")` と同じ判定。
- `isbn10To13` は不正な ISBN-10 を**拒否**（undefined = guest の 0 変換不可）。
  既知変換: 0306406152 → 9780306406157。
- **mod は guest 規約で禁止** —— quot で剰余を構成して同一の数学を実装
  （mod 10 / mod 11）。3 ターゲットで正本と一致。

## 未実装境界

- registerBook / lookup / listBooks / coverage（レジストリ lexicon 4 本）の
  判定化 —— register の admission（正規化 → 重複 → source 系統）は次スライス候補。
- `normalizeIsbn`（非数字除去）は文字列操作なので guest 範囲外（host）。
- mon（DNA）化、aiueos session 載せ（fleet 共通）。
