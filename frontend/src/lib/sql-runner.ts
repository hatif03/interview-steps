/** Run SQL in-browser with sql.js against question schema metadata. */

export type SqlRunResult = {
  passed: boolean;
  error?: string;
  rows?: Record<string, unknown>[];
};

type SqlJsStatic = import("sql.js").SqlJsStatic;

let sqlInitPromise: Promise<SqlJsStatic> | null = null;

async function getSqlJs(): Promise<SqlJsStatic> {
  if (!sqlInitPromise) {
    sqlInitPromise = import("sql.js").then((mod) =>
      mod.default({
        // Serve WASM from same origin — loading from sql.js.org fails in many dev/prod setups.
        locateFile: (file: string) => `/vendor/sql.js/${file}`,
      })
    );
  }
  return sqlInitPromise;
}

function normalizeRows(rows: Record<string, unknown>[]): string {
  const sorted = rows.map((r) =>
    JSON.stringify(
      Object.keys(r)
        .sort()
        .reduce((acc, k) => ({ ...acc, [k]: r[k] }), {} as Record<string, unknown>)
    )
  );
  return JSON.stringify(sorted.sort());
}

export async function runSqlQuery(
  sql: string,
  schema: { tables?: Array<{ name: string; columns: string[]; rows: Record<string, unknown>[] }> }
): Promise<SqlRunResult> {
  if (typeof window === "undefined") {
    return { passed: false, error: "SQL execution requires browser" };
  }

  try {
    const SQL = await getSqlJs();
    const db = new SQL.Database();

    for (const table of schema.tables || []) {
      const cols = table.columns.join(", ");
      const colDefs = table.columns.map((c) => `${c} TEXT`).join(", ");
      db.run(`CREATE TABLE ${table.name} (${colDefs})`);
      for (const row of table.rows || []) {
        const vals = table.columns.map((c) => {
          const v = row[c];
          if (v == null) return "NULL";
          return `'${String(v).replace(/'/g, "''")}'`;
        });
        db.run(`INSERT INTO ${table.name} (${cols}) VALUES (${vals.join(", ")})`);
      }
    }

    const result = db.exec(sql.trim());
    const rows: Record<string, unknown>[] = [];
    if (result[0]) {
      const { columns, values } = result[0];
      for (const row of values) {
        const obj: Record<string, unknown> = {};
        columns.forEach((col, i) => {
          obj[col] = row[i];
        });
        rows.push(obj);
      }
    }
    return { passed: true, rows };
  } catch (e) {
    return { passed: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export function compareSqlResults(
  actual: Record<string, unknown>[],
  expected: Record<string, unknown>[]
): boolean {
  return normalizeRows(actual) === normalizeRows(expected);
}

export async function gradeSqlAnswer(
  sql: string,
  question: { correct_answer?: { expected_rows?: Record<string, unknown>[] }; metadata?: Record<string, unknown> }
): Promise<SqlRunResult & { passed: boolean }> {
  const schema = (question.metadata?.schema as { tables?: Array<{ name: string; columns: string[]; rows: Record<string, unknown>[] }> }) || { tables: [] };
  const run = await runSqlQuery(sql, schema);
  if (run.error || !run.rows) {
    return { passed: false, error: run.error || "No results", rows: run.rows };
  }
  const expected = question.correct_answer?.expected_rows || [];
  const passed = compareSqlResults(run.rows, expected);
  return { ...run, passed };
}
