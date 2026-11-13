import { describe, expect, it } from "vitest";
import { buildCsvTemplate, buildParticipantsCsv, parseTeamCsv, SignupSchemaField } from "./csvTeams";

const schema: SignupSchemaField[] = [
  { id: "shirt_size", label: "T-Shirt", type: "select", required: true, options: ["S", "M", "L", "XL"] },
  { id: "id_doc", label: "Documento de identificação", type: "text", required: true },
  { id: "age", label: "Age", type: "number", required: false, min: 14, max: 99 },
  { id: "terms", label: "Waiver", type: "checkbox", required: false },
];

describe("csvTeams", () => {
  it("builds a CSV template matching signup schema labels", () => {
    const csv = buildCsvTemplate(schema);
    const lines = csv.trim().split("\n");
    expect(lines[0]).toBe("name,email,T-Shirt,Documento de identificação,Age,Waiver");
    expect(lines[1]).toBe("Example Team,captain@example.com,S,,14,true");
  });

  it("parses valid CSV rows and maps dynamic fields to field ids", () => {
    const csv = [
      "name,email,T-Shirt,Documento de identificação,Age,Waiver",
      '"Lisbon, Master",lisbon@example.com,M,12345678,24,true',
      "Porto Club,,L,87654321,,false",
    ].join("\n");

    const result = parseTeamCsv(csv, schema);
    expect(result.errors).toEqual([]);
    expect(result.validRows).toEqual([
      {
        rowNumber: 2,
        name: "Lisbon, Master",
        contact_email: "lisbon@example.com",
        form_responses: {
          shirt_size: "M",
          id_doc: "12345678",
          age: "24",
          terms: true,
        },
      },
      {
        rowNumber: 3,
        name: "Porto Club",
        contact_email: null,
        form_responses: {
          shirt_size: "L",
          id_doc: "87654321",
          terms: false,
        },
      },
    ]);
  });

  it("reports validation errors for missing required fields and invalid select options", () => {
    const csv = [
      "name,T-Shirt,Documento de identificação",
      "Valid Team,S,111222",
      "Missing Shirt,,111222",
      "Bad Shirt,XXL,111222",
    ].join("\n");

    const result = parseTeamCsv(csv, schema);
    expect(result.validRows).toHaveLength(1);
    expect(result.validRows[0].name).toBe("Valid Team");
    expect(result.errors).toEqual([
      { rowNumber: 3, message: "Missing required field: T-Shirt" },
      { rowNumber: 4, message: 'Invalid option "XXL" for field "T-Shirt".' },
    ]);
  });

  it("exports participants and their dynamic form responses to CSV", () => {
    const csv = buildParticipantsCsv(
      [
        {
          name: "Lisbon, Master",
          contact_email: "manager@team.com",
          form_responses: {
            shirt_size: "M",
            id_doc: "CC-1234",
            age: "22",
            terms: true,
          },
        },
        {
          name: "AAC",
          contact_email: null,
          form_responses: null,
        },
      ],
      schema
    );

    expect(csv.trim().split("\n")).toEqual([
      "#,name,email,T-Shirt,Documento de identificação,Age,Waiver",
      '1,"Lisbon, Master",manager@team.com,M,CC-1234,22,true',
      "2,AAC,,,,,",
    ]);
  });
});
