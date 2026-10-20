import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
} from 'docx';
import PDFDocument from 'pdfkit';
import fs from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import path from 'node:path';
import type { ProposalSection } from '../../shared/types/proposal.js';
import { ensureDir } from '../../shared/utils/fileSystem.js';

export async function generateDocx(
  sections: ProposalSection[],
  outputPath: string,
  title: string,
): Promise<void> {
  await ensureDir(path.dirname(outputPath));

  const children: Paragraph[] = [];

  // Title
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: title, bold: true, size: 32, font: 'Calibri' }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    }),
  );

  // Date
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Date: ${new Date().toLocaleDateString('en-IN')}`,
          size: 22,
          font: 'Calibri',
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 600 },
    }),
  );

  // Separator
  children.push(
    new Paragraph({
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
      },
      spacing: { after: 400 },
    }),
  );

  // Sections
  for (const section of sections) {
    // Section heading
    children.push(
      new Paragraph({
        text: section.title,
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
      }),
    );

    // Section content - split by paragraphs
    const paragraphs = section.content.split('\n').filter((p) => p.trim());
    for (const para of paragraphs) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: para.trim(), size: 22, font: 'Calibri' }),
          ],
          spacing: { after: 120 },
        }),
      );
    }
  }

  const doc = new Document({
    sections: [{ children }],
  });

  const buffer = await Packer.toBuffer(doc);
  await fs.writeFile(outputPath, buffer);
}

export async function generatePdf(
  sections: ProposalSection[],
  outputPath: string,
  title: string,
): Promise<void> {
  await ensureDir(path.dirname(outputPath));

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 72, bottom: 72, left: 72, right: 72 },
    });

    const stream = createWriteStream(outputPath);
    doc.pipe(stream);

    // Title
    doc
      .fontSize(24)
      .font('Helvetica-Bold')
      .text(title, { align: 'center' });
    doc.moveDown(0.5);
    doc
      .fontSize(12)
      .font('Helvetica')
      .text(`Date: ${new Date().toLocaleDateString('en-IN')}`, {
        align: 'center',
      });
    doc.moveDown(1);
    doc.moveTo(72, doc.y).lineTo(523, doc.y).stroke();
    doc.moveDown(1);

    // Sections
    for (const section of sections) {
      // Check if we need a new page
      if (doc.y > 680) doc.addPage();

      doc.fontSize(16).font('Helvetica-Bold').text(section.title);
      doc.moveDown(0.5);

      const paragraphs = section.content.split('\n').filter((p) => p.trim());
      for (const para of paragraphs) {
        doc.fontSize(11).font('Helvetica').text(para.trim(), {
          align: 'justify',
          lineGap: 2,
        });
        doc.moveDown(0.3);
      }
      doc.moveDown(0.5);
    }

    doc.end();
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}
