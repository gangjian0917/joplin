// Shared SQL predicate matching JS `String.trim() === ''` for title/body
// blankness. SQLite's one-argument trim() only strips U+0020 in the version
// we ship (3.41), so the full JS whitespace set is built with char() —
// raw unprintables in source would be too easy to corrupt.
// Used by the embedding indexer's candidate queries so a note the JS side
// skips (indexNote() writes no meta row) is also skipped here — otherwise the
// initial scan would re-select it forever.

// JS WhiteSpace + LineTerminator per the ECMAScript spec (what trim() removes).
const JS_WHITESPACE_CODEPOINTS = [
	0x0009, 0x000A, 0x000B, 0x000C, 0x000D, 0x0020, 0x00A0, 0x1680,
	0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006, 0x2007,
	0x2008, 0x2009, 0x200A, 0x2028, 0x2029, 0x202F, 0x205F, 0x3000, 0xFEFF,
];

const charExpr = `char(${JS_WHITESPACE_CODEPOINTS.join(', ')})`;

// Both title and body must be blank (after JS-trim semantics) for a note to
// count as empty. The n. alias matches the notes-table alias used by the
// callers' queries.
export const noteIsBlankSql = `(
	trim(coalesce(n.title, ''), ${charExpr}) = ''
	AND trim(coalesce(n.body, ''), ${charExpr}) = ''
)`;

// Same predicate for an unaliased notes reference.
export const noteIsBlankUnaliasedSql = `(
	trim(coalesce(title, ''), ${charExpr}) = ''
	AND trim(coalesce(body, ''), ${charExpr}) = ''
)`;
