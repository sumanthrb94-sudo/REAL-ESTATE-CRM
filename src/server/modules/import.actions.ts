"use server";

import { revalidatePath } from "next/cache";
import { assertPermission } from "@/server/auth/guard";
import { readWorkbook } from "@/lib/spreadsheet";
import {
  commitImport,
  previewImport,
  type DuplicateStrategy,
  type ImportField,
  type ImportPreview,
  type ImportResult,
} from "./import";

/** Re-serialise any parsed sheet as CSV, so remap and commit reuse one shape. */
function toCsv(headers: string[], rows: string[][]): string {
  const esc = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return [headers, ...rows].map((r) => r.map((c) => esc(c ?? "")).join(",")).join("\r\n");
}

export interface PreviewState {
  error?: string;
  preview?: ImportPreview;
  /** Echoed back so the commit step reuses the exact text that was previewed. */
  csvText?: string;
  meta?: UploadMeta;
}

export interface CommitState {
  error?: string;
  result?: ImportResult;
}

/** Shown on the preview so the user knows which file the merges came from. */
export interface UploadMeta {
  fileName: string;
  format: string;
  sheetName: string;
}

/** 5 MB — comfortably above any realistic lead export, below a memory problem. */
const MAX_BYTES = 5 * 1024 * 1024;

function message(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong reading that file.";
}

export async function previewImportAction(
  _prev: PreviewState,
  formData: FormData,
): Promise<PreviewState> {
  try {
    await assertPermission("lead.write", "You do not have permission to import leads.");

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { error: "Choose a CSV or Excel file to import." };
    }
    if (file.size > MAX_BYTES) {
      return { error: `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB; the limit is 5 MB.` };
    }

    // Normalise .xlsx, .csv and .tsv to one CSV string up front, so every
    // later step — remap, preview, commit — works on the same grid.
    const buf = Buffer.from(await file.arrayBuffer());
    const wb = readWorkbook(buf, file.name);
    if (wb.headers.length === 0) return { error: "That file has no header row." };
    const csvText = toCsv(wb.headers, wb.rows);
    const preview = await previewImport(csvText, undefined, "merge", file.name);
    return {
      preview: { ...preview, format: wb.format },
      csvText,
      meta: { fileName: file.name, format: wb.format, sheetName: wb.sheetName },
    };
  } catch (e) {
    return { error: message(e) };
  }
}

/** Re-run the preview after the user changes the column mapping. */
export async function remapAction(
  csvText: string,
  mapping: Record<number, ImportField | "">,
  strategy: DuplicateStrategy,
  fileName = "an upload",
): Promise<PreviewState> {
  try {
    await assertPermission("lead.write", "You do not have permission to import leads.");
    const preview = await previewImport(csvText, mapping, strategy, fileName);
    return { preview, csvText };
  } catch (e) {
    return { error: message(e) };
  }
}

export async function commitImportAction(
  csvText: string,
  mapping: Record<number, ImportField | "">,
  strategy: DuplicateStrategy,
  fileName = "an upload",
): Promise<CommitState> {
  let result: ImportResult;
  try {
    await assertPermission("lead.write", "You do not have permission to import leads.");
    result = await commitImport(csvText, mapping, strategy, fileName);
  } catch (e) {
    return { error: message(e) };
  }
  revalidatePath("/leads");
  revalidatePath("/pipeline");
  revalidatePath("/dashboard");
  return { result };
}
