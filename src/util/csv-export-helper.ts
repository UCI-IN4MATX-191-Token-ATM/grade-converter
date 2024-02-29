// Adopted from https://github.com/UCI-IN4MATX-191-Token-ATM/token-atm-spa/blob/main/src/app/services/csvs.service.ts
import { formatISO } from "date-fns";
import * as CSV from "papaparse";
import sanitize from "sanitize-filename";

function filenameTemplate(filename: string, date?: Date): string {
  const taggedDate = date ?? new Date();
  return [filename, formatISO(taggedDate, { format: 'basic' })]
      .filter((x) => x)
      .join('_');
}

export default function exportDataAsCSV(data: Record<string, any>[], filename: string): File {
  return new File([CSV.unparse(data)], sanitize(filenameTemplate(filename, new Date()) + '.csv'),
    {
      type: 'text/csv;charset=utf-8;'
    });
}
