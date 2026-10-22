import ExcelJS from 'exceljs';

/** Build an .xlsx from sheets: [{ name, columns: [{ header, key, width?, numFmt? }], rows }]. */
export async function workbook(sheets) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Vahan Seva Kendra';
  for (const s of sheets) {
    const ws = wb.addWorksheet(s.name.slice(0, 31));
    ws.columns = s.columns.map((c) => ({ header: c.header, key: c.key, width: c.width || Math.max(12, c.header.length + 2), style: c.numFmt ? { numFmt: c.numFmt } : undefined }));
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B2A6F' } };
    ws.views = [{ state: 'frozen', ySplit: 1 }];
    for (const row of s.rows) ws.addRow(row);
  }
  return wb.xlsx.writeBuffer();
}

export function sendXlsx(res, filename, buffer) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(Buffer.from(buffer));
}

/** Read the first sheet of an .xlsx or a .csv buffer into { headers, rows } (rows as arrays). */
export async function readTable(buffer, filename = '') {
  const wb = new ExcelJS.Workbook();
  let ws;
  if (/\.csv$/i.test(filename)) {
    const { Readable } = await import('node:stream');
    ws = await wb.csv.read(Readable.from(buffer), { parserOptions: { delimiter: sniffDelimiter(buffer) } });
  } else {
    await wb.xlsx.load(buffer);
    ws = wb.worksheets[0];
  }
  if (!ws) return { headers: [], rows: [] };
  const all = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const vals = [];
    for (let i = 1; i <= ws.columnCount; i += 1) vals.push(cellValue(row.getCell(i).value));
    all.push(vals);
  });
  const [headers = [], ...rows] = all;
  return { headers: headers.map((h, i) => String(h ?? '').trim() || `Column ${i + 1}`), rows: rows.filter((r) => r.some((v) => v !== null && v !== '')) };
}

function sniffDelimiter(buffer) {
  const first = buffer.toString('utf8', 0, 2000).split(/\r?\n/)[0] || '';
  return [',', ';', '\t'].sort((a, b) => first.split(b).length - first.split(a).length)[0];
}

function cellValue(v) {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') {
    if ('result' in v) return cellValue(v.result);
    if ('text' in v) return v.text;
    if ('richText' in v) return v.richText.map((t) => t.text).join('');
  }
  return v;
}
