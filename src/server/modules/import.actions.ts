"use server";

import { revalidatePath } from "next/cache";
import { assertPermission } from "@/server/auth/guard";
import {
  commitImport,
  previewImport,
  type ImportField,
  type ImportPreview,
  type ImportResult,
} from "./import";

export interface PreviewState {
  error?: string;
  preview?: ImportPreview;
  /** Echoed back so the commit step reuses the exact text that was previewed. */
  csvText?: string;
}

export interface CommitState {
  error?: string;
  result?: ImportResult;
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
      return { error: "Choose a CSV file to import." };
    }
    if (file.size > MAX_BYTES) {
      return { error: `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB; the limit is 5 MB.` };
    }

    const csvText = await file.text();
    const preview = await previewImport(csvText);
    return { preview, csvText };
  } catch (e) {
    return { error: message(e) };
  }
}

/** Re-run the preview after the user changes the column mapping. */
export async function remapAction(
  csvText: string,
  mapping: Record<number, ImportField | "">,
  skipDuplicates: boolean,
): Promise<PreviewState> {
  try {
    await assertPermission("lead.write", "You do not have permission to import leads.");
    const preview = await previewImport(csvText, mapping, skipDuplicates);
    return { preview, csvText };
  } catch (e) {
    return { error: message(e) };
  }
}

export async function commitImportAction(
  csvText: string,
  mapping: Record<number, ImportField | "">,
  skipDuplicates: boolean,
): Promise<CommitState> {
  let result: ImportResult;
  try {
    await assertPermission("lead.write", "You do not have permission to import leads.");
    result = await commitImport(csvText, mapping, skipDuplicates);
  } catch (e) {
    return { error: message(e) };
  }
  revalidatePath("/leads");
  revalidatePath("/pipeline");
  revalidatePath("/dashboard");
  return { result };
}
