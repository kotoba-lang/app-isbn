/**
 * isbn kotoba — barrel.
 *
 * Per ADR-2605203000 Option B Phase E reference impl. ISO 2108 ISBN
 * book registry — ISBN-10/ISBN-13 unified management with check-digit
 * validation and auto-conversion.
 *
 * Slice 1: 4 of 4 canonical lexicons ported.
 *   registerBook + lookup + listBooks + coverage
 */

export * from "./types.js";
export { registerBook, lookup, listBooks, coverage } from "./registry.js";
