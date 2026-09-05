import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import PDFDocument from 'pdfkit';

const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../sample-docs');
fs.mkdirSync(outDir, { recursive: true });

function writeInvoice({
  filename,
  title,
  vendor,
  address,
  invoiceNumber,
  date,
  currency,
  lines,
  subtotal,
  tax,
  total,
  note,
}) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 56 });
    const stream = fs.createWriteStream(path.join(outDir, filename));
    doc.pipe(stream);

    doc.fontSize(22).text('INVOICE', { align: 'left' });
    doc.moveDown(0.5);
    doc.fontSize(12).text(vendor);
    doc.text(address);
    doc.moveDown();
    if (invoiceNumber) doc.text(`Invoice #: ${invoiceNumber}`);
    doc.text(`Date: ${date}`);
    doc.text(`Currency: ${currency}`);
    doc.moveDown();
    doc.text('Description                         Qty          Amount');
    for (const line of lines) {
      doc.text(`${line.description.padEnd(34)}${String(line.qty).padEnd(13)}${line.amount}`);
    }
    doc.moveDown();
    doc.text(`Subtotal: ${subtotal}`);
    doc.text(`Tax: ${tax}`);
    doc.fontSize(14).text(`Total: ${total}`);
    doc.moveDown();
    doc.fontSize(10).fillColor('#555').text(note);
    doc.fontSize(9).text(title);

    doc.end();
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}

const northlineLines = [
  { description: 'Copy paper', qty: 10, amount: '184.60' },
  { description: 'Toner cartridge', qty: 2, amount: '980.00' },
  { description: 'Freight', qty: 1, amount: '120.00' },
];

await writeInvoice({
  filename: 'clean.pdf',
  title: 'Sample: clean',
  vendor: 'Northline Supplies',
  address: '4410 Harbor Ave, Oakland CA',
  invoiceNumber: 'INV-1042',
  date: '12 Mar 2026',
  currency: 'USD',
  lines: northlineLines,
  subtotal: '1284.60',
  tax: '0.00',
  total: '1284.60',
  note: 'Line items sum to the total.',
});

await writeInvoice({
  filename: 'mismatch.pdf',
  title: 'Sample: totals mismatch',
  vendor: 'Northline Supplies',
  address: '4410 Harbor Ave, Oakland CA',
  invoiceNumber: 'INV-1042',
  date: '12 Mar 2026',
  currency: 'USD',
  lines: northlineLines,
  subtotal: '1284.60',
  tax: '0.00',
  total: '1184.60',
  note: 'Total is wrong on purpose - line items sum to 1284.60.',
});

await writeInvoice({
  filename: 'missing.pdf',
  title: 'Sample: missing invoice number',
  vendor: 'River & Oak Print',
  address: '90 Cedar Street, Portland OR',
  invoiceNumber: '',
  date: '1 Sep 2026',
  currency: 'USD',
  lines: [
    { description: 'Letterhead', qty: 500, amount: '210.00' },
    { description: 'Business cards', qty: 250, amount: '85.00' },
  ],
  subtotal: '295.00',
  tax: '0.00',
  total: '295.00',
  note: 'Invoice number is left blank on purpose.',
});

await writeInvoice({
  filename: 'euro.pdf',
  title: 'Sample: euro vendor',
  vendor: 'Atelier Moreau',
  address: '18 Rue des Archives, Paris',
  invoiceNumber: 'INV-EU-220',
  date: '4 Sep 2026',
  currency: 'EUR',
  lines: [
    { description: 'Studio time', qty: 8, amount: '640.00' },
    { description: 'Prints', qty: 20, amount: '160.00' },
  ],
  subtotal: '800.00',
  tax: '160.00',
  total: '960.00',
  note: 'EUR invoice. Line items plus tax match the total.',
});

await writeInvoice({
  filename: 'baddate.pdf',
  title: 'Sample: unparseable date',
  vendor: 'Pacific Freight Co',
  address: '210 Terminal Rd, Long Beach CA',
  invoiceNumber: 'INV-PF-88',
  date: 'next Friday',
  currency: 'USD',
  lines: [{ description: 'Drayage', qty: 1, amount: '430.00' }],
  subtotal: '430.00',
  tax: '0.00',
  total: '430.00',
  note: 'Date is "next Friday" on purpose - not a real date.',
});

console.log('Wrote sample-docs/clean, mismatch, missing, euro, and baddate PDFs');
