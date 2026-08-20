import ExcelJS from "exceljs";

export interface CalendarPostData {
  week: number;
  day: string;
  platform: string;
  copy: string;
  imageBrief?: string;
}

export interface CalendarData {
  posts: CalendarPostData[];
}

// Parses the JSON content Claude generated for a "calendar" asset. Throws
// if the shape is invalid -- callers should catch this the same as any
// other best-effort failure (the xlsx build is secondary to the text
// content, which already succeeded).
export function parseCalendarJson(content: string): CalendarData {
  const parsed = JSON.parse(content);
  if (!parsed || !Array.isArray(parsed.posts) || parsed.posts.length === 0) {
    throw new Error("Calendar JSON missing a non-empty posts array");
  }
  return parsed as CalendarData;
}

// Builds the actual .xlsx file (in-memory buffer, no filesystem access --
// safe for a serverless function). imageBuffers is a parallel array to
// posts -- pass null for any post whose image generation failed or was
// skipped, and that row simply has no image, same best-effort pattern used
// everywhere else in this app.
export async function buildCalendarXlsx(
  posts: CalendarPostData[],
  imageBuffers: (Buffer | null)[]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Content Calendar");

  sheet.columns = [
    { header: "Week", key: "week", width: 8 },
    { header: "Day", key: "day", width: 12 },
    { header: "Platform", key: "platform", width: 14 },
    { header: "Post Copy", key: "copy", width: 60 },
    { header: "Image", key: "image", width: 24 },
  ];
  sheet.getRow(1).font = { bold: true };

  posts.forEach((post, i) => {
    const row = sheet.addRow({
      week: post.week,
      day: post.day,
      platform: post.platform,
      copy: post.copy,
    });
    row.alignment = { vertical: "top", wrapText: true };
    row.height = 130;

    const imageBuffer = imageBuffers[i];
    if (imageBuffer) {
      const imageId = workbook.addImage({
        buffer: imageBuffer as unknown as ExcelJS.Buffer,
        extension: "png",
      });
      // Row numbers are 1-indexed and row 1 is the header, so this post's
      // row is i + 2. Anchor the image over the Image column's cell range
      // for that row so it visually sits inside the row like an attachment.
      const rowNumber = i + 2;
      sheet.addImage(imageId, `E${rowNumber}:E${rowNumber}`);
    }
  });

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer as ArrayBuffer);
}
