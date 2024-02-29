import DataArrayCSVExporter from "../components/data-array-csv-exporter";
import { RawGradeItem, RawGradeItemWithError } from "../data/raw-grade-item";
import { User } from "../data/user";
import { CanvasService } from "../services/canvas-service";
import ProgressableTask from "../util/progressable-task";

export default async function matchRawDataWithStudent<T, Args extends any[]>(task: ProgressableTask<T, Args>, rawGradeItems: RawGradeItem[], canvasService: CanvasService, courseId: string): Promise<[[RawGradeItem, User][], RawGradeItemWithError[], boolean]> {
  task.onProgressUpdate(0, `Getting student information from Canvas`);
  const emailMap = new Map<string, User>(), sidMap = new Map<string, User>(), emailSIDTupleMap = new Map<string, User>();
  let cnt = 0;
  for await (const student of (await canvasService.getCourseStudents(courseId))) {
    if (student.email) emailMap.set(student.email, student);
    if (student.sis_user_id) sidMap.set(student.sis_user_id, student);
    if (student.email && student.sis_user_id) emailSIDTupleMap.set(student.email + student.sis_user_id, student);
    cnt++;
    task.onProgressUpdate(0, `Got information of ${cnt} student(s) from Canvas`);
  }

  const result: [RawGradeItem, User][] = [], skipped: RawGradeItemWithError[] = [];

  for (const item of rawGradeItems) {
    const tmpArr: User[] = [];
    if (item.email && emailMap.has(item.email)) tmpArr.push(emailMap.get(item.email)!);
    if (item.sis_id && sidMap.has(item.sis_id)) tmpArr.push(sidMap.get(item.sis_id)!);
    if (item.email && item.sis_id && emailSIDTupleMap.has(item.email + item.sis_id)) tmpArr.push(emailSIDTupleMap.get(item.email + item.sis_id)!);
    if (tmpArr.length == 0) skipped.push({
      ...item,
      error: 'No student is matched with given SID / Email pair'
    });
    else if (new Set(tmpArr.map((x) => x.id)).size > 1) skipped.push({
      ...item,
      error: 'Multiple students are matched with given SID / Email pair'
    });
    else result.push([item, tmpArr[0]]);
  }

  if (skipped.length > 0) if (!(await task.onWarning(() => <><p className="mb-2">Out of {rawGradeItems.length} records, {skipped.length} failed to match with any current student. Do you want to proceed anyway by skipping these records?</p><DataArrayCSVExporter data={skipped} filename={'Skipped-Records-No-Matched-Student'} /></>))) return [result, skipped, false];

  return [result, skipped, true];
}
