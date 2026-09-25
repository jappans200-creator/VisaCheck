// Parse CSV without treating an empty cell as an observation. Row numbers are
// physical starting lines, including when a quoted field spans multiple lines.
function parseCSV(text) {
  const rows = [], issues = [];
  let cells = [], cell = "", quoted = false, closed = false;
  let line = 1, startLine = 1, malformed = false;
  function finishCell() { cells.push(cell); cell = ""; closed = false; }
  function finishRow() {
    finishCell();
    if (malformed || cells.some(value => value.trim() !== "")) {
      rows.push({ cells, rowNumber: startLine, malformed });
    }
    cells = []; malformed = false;
  }
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else { quoted = false; closed = true; }
      } else { cell += ch; if (ch === '\n') line++; }
    } else if (ch === ',') finishCell();
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      finishRow(); line++; startLine = line;
    } else if (ch === '"') {
      if (cell !== "" || closed) malformed = true;
      else quoted = true;
    } else {
      if (closed) malformed = true;
      cell += ch;
    }
  }
  if (quoted) malformed = true;
  if (cell || cells.length || closed || malformed) finishRow();
  const header = rows.shift();
  const headers = header ? header.cells.map(value => value.trim()) : [];
  if (!header || header.malformed || headers.some(h => !h) || new Set(headers).size !== headers.length) {
    issues.push({ rowNumber: header?.rowNumber || 1, field: null, value: header?.cells || null, code: "invalid_header", message: "Missing, duplicate, empty, or malformed CSV headers." });
    return { records: [], issues, headers };
  }
  const records = [];
  for (const row of rows) {
    if (row.malformed || row.cells.length !== headers.length) {
      issues.push({ rowNumber: row.rowNumber, field: null, value: row.cells, code: "malformed_row", message: "Invalid quoting or incorrect number of cells; row excluded." });
      continue;
    }
    const raw = Object.fromEntries(headers.map((h, i) => [h, row.cells[i]]));
    records.push({ values: Object.fromEntries(headers.map((h, i) => [h, row.cells[i].trim() || null])), provenance: { rowNumber: row.rowNumber, raw } });
  }
  return { records, issues, headers };
}
