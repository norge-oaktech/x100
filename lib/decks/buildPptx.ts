import PptxGenJS from "pptxgenjs";

export interface DeckSlideData {
  title: string;
  kind?: "cover" | "content";
  subtitle?: string;
  bullets?: string[];
  notes?: string;
}

export interface DeckData {
  slides: DeckSlideData[];
}

const NAVY = "1C2B4A";
const OFFWHITE = "FAF8F4";
const ACCENT = "5B7FFF";

// Parses the JSON slide content Claude generated for a "presentation"
// category asset. Throws if the shape is invalid -- callers should catch
// this and treat it the same as any other best-effort failure (deck file
// generation is secondary to the text content, which already succeeded).
export function parseDeckJson(content: string): DeckData {
  const parsed = JSON.parse(content);
  if (!parsed || !Array.isArray(parsed.slides) || parsed.slides.length === 0) {
    throw new Error("Deck JSON missing a non-empty slides array");
  }
  return parsed as DeckData;
}

// Builds an actual .pptx file (as an in-memory buffer, no filesystem
// access needed -- safe for a serverless function) from parsed slide data.
// Cover slide: navy background, large title. Content slides: off-white
// background, navy title + bulleted body. Speaker notes go into the
// presentation's real Notes field (visible in PowerPoint's Notes view),
// not printed on the slide itself.
export async function buildDeckPptx(deck: DeckData): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE"; // 13.33" x 7.5"

  for (const slideData of deck.slides) {
    const slide = pptx.addSlide();
    const isCover = slideData.kind === "cover";

    if (isCover) {
      slide.background = { color: NAVY };
      slide.addShape(pptx.ShapeType.rect, {
        x: 0.8,
        y: 2.35,
        w: 1.2,
        h: 0.06,
        fill: { color: ACCENT },
        line: { color: ACCENT, width: 0 },
      });
      slide.addText(slideData.title, {
        x: 0.8,
        y: 2.6,
        w: 11.7,
        h: 1.6,
        fontFace: "Calibri",
        fontSize: 40,
        bold: true,
        color: "FFFFFF",
        align: "left",
        valign: "top",
      });
      if (slideData.subtitle) {
        slide.addText(slideData.subtitle, {
          x: 0.8,
          y: 4.1,
          w: 11.7,
          h: 0.8,
          fontFace: "Calibri",
          fontSize: 18,
          color: ACCENT,
          align: "left",
        });
      }
    } else {
      slide.background = { color: OFFWHITE };
      slide.addText(slideData.title, {
        x: 0.6,
        y: 0.4,
        w: 12.1,
        h: 0.8,
        fontFace: "Calibri",
        fontSize: 26,
        bold: true,
        color: NAVY,
        align: "left",
      });
      slide.addShape(pptx.ShapeType.rect, {
        x: 0.6,
        y: 1.15,
        w: 1.0,
        h: 0.045,
        fill: { color: ACCENT },
        line: { color: ACCENT, width: 0 },
      });

      if (slideData.subtitle) {
        slide.addText(slideData.subtitle, {
          x: 0.6,
          y: 1.3,
          w: 12.1,
          h: 0.5,
          fontFace: "Calibri",
          fontSize: 15,
          italic: true,
          color: NAVY,
        });
      }

      if (slideData.bullets && slideData.bullets.length > 0) {
        const bulletRuns = slideData.bullets.map((text) => ({
          text,
          options: { bullet: true, breakLine: true },
        }));
        slide.addText(bulletRuns, {
          x: 0.6,
          y: slideData.subtitle ? 1.9 : 1.55,
          w: 12.1,
          h: 5.0,
          fontFace: "Calibri",
          fontSize: 16,
          color: NAVY,
          valign: "top",
          paraSpaceAfter: 12,
        });
      }
    }

    if (slideData.notes) {
      slide.addNotes(slideData.notes);
    }
  }

  const buffer = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  return buffer;
}
