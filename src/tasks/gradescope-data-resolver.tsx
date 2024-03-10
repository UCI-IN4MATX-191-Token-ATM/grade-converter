import JSZip from "jszip";
import { RawGradeItem } from "../data/raw-grade-item";
import ProgressableTask from "../util/progressable-task";
import { parse } from 'csv-parse/browser/esm/sync';

export default async function resolveGradeScopeData<T, Args extends any[]>(task: ProgressableTask<T, Args>, uploadedFile: File, assignmentName: string): Promise<RawGradeItem[]> {
  const result: RawGradeItem[] = [];
  const zipfile = await new JSZip().loadAsync(uploadedFile);
  const files = Object.values(zipfile.files).filter((x) => !x.dir);
  task.setTotal(files.length);
  task.onProgressUpdate(0, `Resolved 0 out of ${files.length} file(s)`);
  for (const [ind, data] of files.entries()) {
    if (data.dir) continue;
    // const values = CSV.parse<{
    //   "Assignment Submission ID": string;
    //   "Email": string;
    //   "SID": string;
    //   "Score": string;
    //   "Tags": string;
    // }>(await data.async('string'), { header: true }).data;
    const values = parse(await data.async('string'), { columns: true, skipRecordsWithError: true });
    for (const value of values) {
      if (value['Assignment Submission ID'].length == 0) break;
      if (Number.isNaN(Number.parseInt('Assignment Submission ID'))) break;
      if (value.Tags.length == 0) continue;
      result.push({
        sis_id: value.SID,
        email: value.Email,
        assignment: value.Tags.trim(),
        rubric_item: assignmentName,
        grade: Number.parseFloat(value.Score)
      });
    }
    task.onProgressUpdate(ind + 1, `Resolved ${ind + 1} out of ${files.length} file(s)`);
  }
  return result;
}
