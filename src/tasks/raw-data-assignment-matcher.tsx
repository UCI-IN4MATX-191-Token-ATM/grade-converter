import DataArrayCSVExporter from "../components/data-array-csv-exporter";
import { Assignment } from "../data/assignment";
import { RawGradeItem, RawGradeItemWithError } from "../data/raw-grade-item";
import { User } from "../data/user";
import { CanvasService } from "../services/canvas-service";
import ProgressableTask from "../util/progressable-task";

export default async function matchRawDataWithAssignment<T, Args extends any[]>(task: ProgressableTask<T, Args>, rawGradeItems: [RawGradeItem, User][], canvasService: CanvasService, courseId: string): Promise<[Map<string, Assignment>, [RawGradeItem, User][], RawGradeItemWithError[], boolean]> {
  task.onProgressUpdate(0, `Getting assignment information from Canvas`);
  const result = new Map<string, Assignment>(), assignments = new Map<string, Assignment>(), skipped: RawGradeItemWithError[] = [], matched: [RawGradeItem, User][] = [];
  let cnt = 0;
  for await (const v of await canvasService.getAssignments(courseId)) {
    if (!v.rubric) continue;
    assignments.set(v.name, v);
    cnt++;
    task.onProgressUpdate(0, `Got information of ${cnt} assignment(s) from Canvas`)
  }
  for (const [item, user] of rawGradeItems) {
    if (!assignments.has(item.assignment)) {
      skipped.push({
        ...item,
        error: 'No Canvas assignment is matched with given specification grading bundle'
      });
      continue;
    }
    const assignment = assignments.get(item.assignment)!;
    if (!assignment.rubric || !assignment.rubric.some((x) => x.description == item.rubric_item)) skipped.push({
      ...item,
      error: 'The Canvas assignment matched with given specification grading bundle does not have the given rubric item'
    });
    else {
      result.set(item.assignment, assignment);
      matched.push([item, user]);
    }
  }

  if (skipped.length > 0) if (!(await task.onWarning(() => <><p className="mb-2">Out of {rawGradeItems.length} records, {skipped.length} failed to match with any current pair of assignment and rubric item. Do you want to proceed anyway by skipping these records?</p><DataArrayCSVExporter data={skipped} filename={'Skipped-Records-No-Matched-Assignment-Rubric-Item-Pair'} /></>))) return [result, matched, skipped, false];

  return [result, matched, skipped, true];
}
