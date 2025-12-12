"use server";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { createIdentity } from "@/lib/identities";
import { generateFaceEmbeddingFromUrl } from "@/lib/face-embedding";

export interface CSVImportResult {
  success: boolean;
  processed: number;
  created: number;
  skipped: number;
  errors: string[];
}

interface CSVRow {
  name: string;
  linkedin_url?: string;
  headshot_media_url?: string;
}

/**
 * Parse CSV content into rows
 */
function parseCSV(csvContent: string): CSVRow[] {
  const lines = csvContent.trim().split("\n");
  if (lines.length === 0) return [];

  // Parse header
  const headerLine = lines[0];
  const headers = headerLine.split(",").map((h) => h.trim().toLowerCase());

  // Find column indices
  const nameIndex = headers.indexOf("name");
  const linkedinIndex = headers.indexOf("linkedin_url");
  const headshotIndex = headers.indexOf("headshot_media_url");

  if (nameIndex === -1) {
    throw new Error("CSV must contain a 'name' column");
  }

  // Parse data rows
  const rows: CSVRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; // Skip empty lines

    // Simple CSV parsing (handles quoted values)
    const values = parseCSVLine(line);
    
    const row: CSVRow = {
      name: values[nameIndex]?.trim() || "",
    };

    if (linkedinIndex !== -1 && values[linkedinIndex]) {
      row.linkedin_url = values[linkedinIndex].trim();
    }

    if (headshotIndex !== -1 && values[headshotIndex]) {
      row.headshot_media_url = values[headshotIndex].trim();
    }

    // Skip rows without a name
    if (!row.name) continue;

    rows.push(row);
  }

  return rows;
}

/**
 * Simple CSV line parser that handles quoted values
 */
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      // End of value
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  // Add last value
  values.push(current);

  return values;
}

/**
 * Server action to import identities from CSV
 * @param csvContent - The CSV file content as string
 * @returns Import result with statistics
 */
export async function importCSV(csvContent: string): Promise<CSVImportResult> {
  const result: CSVImportResult = {
    success: true,
    processed: 0,
    created: 0,
    skipped: 0,
    errors: [],
  };

  try {
    // Parse CSV
    const rows = parseCSV(csvContent);
    result.processed = rows.length;

    // Process each row
    for (const row of rows) {
      try {
        // Skip if no headshot URL (as per requirements)
        if (!row.headshot_media_url) {
          result.skipped++;
          continue;
        }

        // Generate face embedding from headshot URL
        const embedding = await generateFaceEmbeddingFromUrl(
          row.headshot_media_url
        );

        if (!embedding) {
          result.skipped++;
          result.errors.push(
            `Skipped ${row.name}: Could not generate embedding from headshot URL`
          );
          continue;
        }

        // Create identity with embedding
        await createIdentity({
          name: row.name,
          linkedinUrl: row.linkedin_url || null,
          headshotMediaUrl: row.headshot_media_url,
          faceEmbedding: embedding,
          metadata: {
            imported_from_csv: true,
            imported_at: new Date().toISOString(),
          },
        });

        result.created++;
      } catch (error) {
        result.errors.push(
          `Error processing ${row.name}: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
        result.success = false;
      }
    }
  } catch (error) {
    result.success = false;
    result.errors.push(
      `CSV parsing error: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }

  return result;
}

