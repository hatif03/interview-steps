declare module "sql.js" {
  export interface SqlJsStatic {
    Database: new () => {
      run: (sql: string) => void;
      exec: (sql: string) => Array<{ columns: string[]; values: unknown[][] }>;
    };
  }

  export default function initSqlJs(config?: {
    locateFile?: (file: string) => string;
  }): Promise<SqlJsStatic>;
}
