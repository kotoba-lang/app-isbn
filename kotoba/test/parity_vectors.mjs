// aiueos/isbn_judgment.cljk（判定コア）と正本 TS（kotoba/src/types.ts）の
// 実行 parity。同じ既知ベクタで両者が同じ判定・同じ変換を返すことを
// node で直接実行して照合する（guest 側は amu test で同じベクタを検証済み）。
import { isValidIsbn13, isValidIsbn10, isbn10To13 } from "../src/types.ts";
import assert from "node:assert";

// guest test-isbn13 / test-isbn13-bad
assert.equal(isValidIsbn13("9784106102844"), true);
assert.equal(isValidIsbn13("9784106102845"), false);
// guest test-isbn10 / test-isbn10-x
assert.equal(isValidIsbn10("0306406152"), true);
assert.equal(isValidIsbn10("080442957X"), true);
// guest test-convert / test-convert-known
assert.equal(isbn10To13("0306406152"), "9780306406157");
assert.equal(isValidIsbn13(isbn10To13("0306406152")), true);
// guest と同じ境界: 不正な ISBN-10 からの変換は拒否（undefined）
assert.equal(isbn10To13("0306406153"), undefined);
console.log("parity_vectors: all pass");
