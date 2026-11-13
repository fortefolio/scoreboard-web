export interface SignupSchemaField {
  id: string;
  label?: string;
  type?: string;
  required?: boolean;
  min?: number | null;
  max?: number | null;
  options?: string[];
}

export interface ParsedTeamRow {
  rowNumber: number;
  name: string;
  contact_email: string | null;
  form_responses: Record<string, string | boolean>;
}

export interface CsvParseError {
  rowNumber: number;
  message: string;
}

export interface CsvParseResult {
  validRows: ParsedTeamRow[];
  errors: CsvParseError[];
}

/** Parses raw CSV text into a matrix of trimmed cells, handling quoted values and escaped quotes. */
export function parseCsvMatrix(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let inQuotes = false;

  const normalized = text.replace(/^\uFEFF/, "");

  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    const next = normalized[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        currentCell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        currentCell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      currentRow.push(currentCell.trim());
      currentCell = "";
    } else if (ch === "\r" && next === "\n") {
      currentRow.push(currentCell.trim());
      if (currentRow.some((cell) => cell !== "")) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = "";
      i++;
    } else if (ch === "\n" || ch === "\r") {
      currentRow.push(currentCell.trim());
      if (currentRow.some((cell) => cell !== "")) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = "";
    } else {
      currentCell += ch;
    }
  }

  currentRow.push(currentCell.trim());
  if (currentRow.some((cell) => cell !== "")) {
    rows.push(currentRow);
  }

  return rows;
}

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export interface ExportParticipant {
  name: string;
  contact_email?: string | null;
  form_responses?: Record<string, any> | null;
}

/** Exports participants and their signup form details to a CSV string. */
export function buildParticipantsCsv(
  participants: ExportParticipant[],
  signupSchema: SignupSchemaField[] = []
): string {
  const headers = ["#", "name", "email", ...signupSchema.map((f) => f.label || f.id)];
  const lines = [headers.map(escapeCsvCell).join(",")];

  participants.forEach((p, idx) => {
    const row = [
      String(idx + 1),
      p.name || "",
      p.contact_email || "",
      ...signupSchema.map((field) => {
        const val = p.form_responses?.[field.id];
        if (val === undefined || val === null) return "";
        return String(val);
      }),
    ];
    lines.push(row.map(escapeCsvCell).join(","));
  });

  return `${lines.join("\n")}\n`;
}

/** Builds a downloadable CSV template with headers matching the tournament signup schema. */
export function buildCsvTemplate(signupSchema: SignupSchemaField[] = []): string {
  const headers = ["name", "email", ...signupSchema.map((f) => f.label || f.id)];
  const sampleValues = [
    "Example Team",
    "captain@example.com",
    ...signupSchema.map((f) => {
      if (f.type === "checkbox") return "true";
      if (f.type === "select" && f.options && f.options.length > 0) return f.options[0];
      if (f.type === "number") return String(f.min ?? 1);
      return "";
    }),
  ];

  return `${headers.map(escapeCsvCell).join(",")}\n${sampleValues.map(escapeCsvCell).join(",")}\n`;
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase();
}

/** Parses and validates team rows from CSV text against the tournament's signup schema. */
export function parseTeamCsv(
  csvText: string,
  signupSchema: SignupSchemaField[] = []
): CsvParseResult {
  const matrix = parseCsvMatrix(csvText);
  if (matrix.length < 2) {
    return {
      validRows: [],
      errors: [{ rowNumber: 1, message: "CSV must include a header row and at least one team row." }],
    };
  }

  const headers = matrix[0].map(normalizeHeader);
  const nameColIdx = headers.findIndex((h) =>
    ["name", "team", "team name", "team_name", "player"].includes(h)
  );
  if (nameColIdx === -1) {
    return {
      validRows: [],
      errors: [{ rowNumber: 1, message: 'Missing required "name" column in CSV header.' }],
    };
  }

  const emailColIdx = headers.findIndex((h) =>
    ["email", "contact_email", "contact email"].includes(h)
  );

  const schemaColumnMap = signupSchema.map((field) => {
    const labelKey = normalizeHeader(field.label || "");
    const idKey = normalizeHeader(field.id);
    const colIdx = headers.findIndex((h) => (labelKey && h === labelKey) || h === idKey);
    return { field, colIdx };
  });

  const validRows: ParsedTeamRow[] = [];
  const errors: CsvParseError[] = [];

  for (let r = 1; r < matrix.length; r++) {
    const row = matrix[r];
    const rowNumber = r + 1;
    const teamName = (row[nameColIdx] || "").trim();

    if (!teamName) {
      errors.push({ rowNumber, message: "Missing team name." });
      continue;
    }

    const contactEmail = emailColIdx >= 0 ? (row[emailColIdx] || "").trim() || null : null;
    const formResponses: Record<string, string | boolean> = {};
    let rowError: string | null = null;

    for (const { field, colIdx } of schemaColumnMap) {
      const label = field.label || field.id;
      const rawVal = colIdx >= 0 ? (row[colIdx] || "").trim() : "";

      if (field.type === "checkbox") {
        const isChecked = ["true", "1", "yes", "y", "sim"].includes(rawVal.toLowerCase());
        if (field.required && !isChecked) {
          rowError = `Missing required agreement: ${label}`;
          break;
        }
        formResponses[field.id] = isChecked;
        continue;
      }

      if (field.required && !rawVal) {
        rowError = `Missing required field: ${label}`;
        break;
      }

      if (rawVal) {
        if (field.type === "number") {
          const num = Number(rawVal);
          if (Number.isNaN(num)) {
            rowError = `Field "${label}" must be a valid number.`;
            break;
          }
          if (field.min != null && num < field.min) {
            rowError = `Field "${label}" must be at least ${field.min}.`;
            break;
          }
          if (field.max != null && num > field.max) {
            rowError = `Field "${label}" must be at most ${field.max}.`;
            break;
          }
        } else if (
          field.type === "select" &&
          Array.isArray(field.options) &&
          field.options.length > 0 &&
          !field.options.includes(rawVal)
        ) {
          rowError = `Invalid option "${rawVal}" for field "${label}".`;
          break;
        }
        formResponses[field.id] = rawVal;
      }
    }

    if (rowError) {
      errors.push({ rowNumber, message: rowError });
      continue;
    }

    validRows.push({
      rowNumber,
      name: teamName,
      contact_email: contactEmail,
      form_responses: formResponses,
    });
  }

  return { validRows, errors };
}
