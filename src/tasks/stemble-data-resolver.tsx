import ExcelJS from 'exceljs';
import { RawGradeItem } from '../data/raw-grade-item';
import ProgressableTask from '../util/progressable-task';

const skippedHeaders = ['Student Name', 'Email', 'Section', 'Tasks with Possible Grade Extraction Error'];

export default async function resolveStembleData<T, Args extends any[]>(task: ProgressableTask<T, Args>, uploadedFile: File, worksheetName: string, assignmentName: string): Promise<RawGradeItem[]> {
  task.setTotal(1);
  task.onProgressUpdate(0, `Loading the uploaded file`);
  const workBook = new ExcelJS.Workbook();
  await workBook.xlsx.load(await uploadedFile.arrayBuffer());

  const workSheet = workBook.getWorksheet(worksheetName);
  if (workSheet === undefined) throw new Error('Specified worksheet does not exist!');

  task.onProgressUpdate(0.5, `Resolving records from the loaded content`);

  let emailCol = -1;
  const headerRows: [number, string][] = [];
  const result: RawGradeItem[] = [];
  workSheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    if (row.actualCellCount == 0) return;
    if (rowNumber == 1) {
      let emptyCnt = 0;
      for (const [ind, v] of (row.values as ExcelJS.CellValue[]).entries()) {
        if (v === undefined) {
          emptyCnt++;
          if (emptyCnt > 1) break;
          continue;
        } else emptyCnt = 0;
        if (v == null) continue;
        if (v.toString() == 'Email') emailCol = ind;
        if (skippedHeaders.indexOf(v.toString()) != -1) continue;
        headerRows.push([ind, v.toString()]);
      }
      return;
    }
    if (emailCol == -1) throw new Error('Fail to locate the column of emails in the worksheet');
    for (const [ind, key] of headerRows) {
      const value = row.getCell(ind).value?.toString();
      const email = row.getCell(emailCol).value?.toString();
      if (email === undefined || email === null) continue;
      result.push({
        sis_id: undefined,
        email: email.toString(),
        assignment: key.toString(),
        rubric_item: assignmentName,
        grade: Number.parseFloat(value ?? '0')
      })
    }
  });
  return result;
}
