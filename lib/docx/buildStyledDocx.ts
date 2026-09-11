import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  ShadingType,
  BorderStyle,
} from "docx";

// Same brand navy used across every other branded output in this app
// (pptx deck builder, questionnaire PDF banner).
const NAVY = "1C2B4A";
const NAVY_TINT = "E8EBF2"; // light tint of NAVY, for table header shading
const BORDER_GRAY = "CCCCCC";

const CELL_BORDER = {
  top: { style: BorderStyle.SINGLE, size: 2, color: BORDER_GRAY },
  bottom: { style: BorderStyle.SINGLE, size: 2, color: BORDER_GRAY },
  left: { style: BorderStyle.SINGLE, size: 2, color: BORDER_GRAY },
  right: { style: BorderStyle.SINGLE, size: 2, color: BORDER_GRAY },
};

// Splits a line like "Some **bold** text" into TextRun objects with bold
// spans applied. Only handles **bold** -- this app's prompts don't ask for
// italics/links, and keeping this simple keeps it reliable.
function parseInlineRuns(text: string, opts: { bold?: boolean; color?: string } = {}): TextRun[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((part) => {
    const isBold = part.startsWith("**") && part.endsWith("**");
    const clean = isBold ? part.slice(2, -2) : part;
    return new TextRun({ text: clean, bold: opts.bold || isBold, color: opts.color });
  });
}

function isTableSeparatorLine(line: string): boolean {
  // e.g. "|---|:---:|---|" or "| --- | --- |"
  return /^\|?[\s:|-]+\|?$/.test(line) && line.includes("-");
}

function parseTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

function buildTable(rows: string[][]): Table {
  const [headerRow, ...bodyRows] = rows;
  const colCount = headerRow.length;
  const colWidth = Math.floor(9000 / colCount);

  const headerCells = headerRow.map(
    (text) =>
      new TableCell({
        width: { size: colWidth, type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, fill: NAVY_TINT },
        borders: CELL_BORDER,
        children: [
          new Paragraph({
            children: parseInlineRuns(text, { bold: true, color: NAVY }),
          }),
        ],
      })
  );

  const bodyTableRows = bodyRows.map(
    (row) =>
      new TableRow({
        children: row.map(
          (cell, i) =>
            new TableCell({
              width: { size: colWidth, type: WidthType.DXA },
              borders: CELL_BORDER,
              children: [
                new Paragraph({
                  children: parseInlineRuns(cell ?? ""),
                }),
              ],
            })
        ),
      })
  );

  return new Table({
    width: { size: 9000, type: WidthType.DXA },
    rows: [new TableRow({ tableHeader: true, children: headerCells }), ...bodyTableRows],
  });
}

// Converts Markdown-ish content (## headings, **bold**, "- " bullets, GFM
// pipe tables) into an array of docx elements (Paragraph | Table),
// suitable for passing straight into a Document's section children.
function markdownToDocxElements(content: string): (Paragraph | Table)[] {
  const lines = content.split("\n");
  const elements: (Paragraph | Table)[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === "") {
      i++;
      continue;
    }

    // Table: a line starting with "|", followed by a separator line.
    if (trimmed.startsWith("|") && i + 1 < lines.length && isTableSeparatorLine(lines[i + 1].trim())) {
      const tableLines: string[] = [trimmed];
      i += 2; // skip the header line (already captured) and the separator line
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        tableLines.push(lines[i].trim());
        i++;
      }
      const rows = tableLines.map(parseTableRow);
      elements.push(buildTable(rows));
      elements.push(new Paragraph({ text: "" })); // breathing room after a table
      continue;
    }

    const h3 = trimmed.match(/^###\s+(.*)/);
    const h2 = trimmed.match(/^##\s+(.*)/);
    const h1 = trimmed.match(/^#\s+(.*)/);
    const bullet = trimmed.match(/^[-*]\s+(.*)/);

    if (h1) {
      elements.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 240, after: 120 },
          children: parseInlineRuns(h1[1], { color: NAVY }),
        })
      );
    } else if (h2) {
      elements.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 240, after: 120 },
          children: parseInlineRuns(h2[1], { color: NAVY }),
        })
      );
    } else if (h3) {
      elements.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 180, after: 100 },
          children: parseInlineRuns(h3[1], { color: NAVY }),
        })
      );
    } else if (bullet) {
      elements.push(
        new Paragraph({
          bullet: { level: 0 },
          spacing: { after: 60 },
          children: parseInlineRuns(bullet[1]),
        })
      );
    } else {
      elements.push(
        new Paragraph({
          spacing: { after: 120 },
          children: parseInlineRuns(trimmed),
        })
      );
    }
    i++;
  }

  return elements;
}

// Builds a complete, downloadable .docx: a title block (matching the
// reference document's "Report Title" + client/fund name pattern) followed
// by the parsed body. Returns the raw file bytes.
export async function buildStyledDocx(title: string, content: string): Promise<Buffer> {
  const bodyElements = markdownToDocxElements(content);

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 }, // 1in margins, matches the reference doc
          },
        },
        children: [
          new Paragraph({
            heading: HeadingLevel.TITLE,
            spacing: { after: 240 },
            children: [new TextRun({ text: title, bold: true, color: NAVY, size: 44 })],
          }),
          ...bodyElements,
        ],
      },
    ],
  });

  const uint8 = await Packer.toBuffer(doc);
  return Buffer.from(uint8);
}
