import { RubricGradeData, RubricGradeDataWithError } from "../data/rubric-grade-data";
import { CanvasService } from "../services/canvas-service";
import ParallelTaskController from "../services/parallel-task-controller";
import formatError from "../util/error-formatter";
import ProgressableTask from "../util/progressable-task";

export default async function uploadCanvasGrade<T, Args extends any[]>(task: ProgressableTask<T, Args>, data: RubricGradeData[], canvasService: CanvasService, courseId: string): Promise<RubricGradeDataWithError[]> {
  const tasks: (() => Promise<void>)[] = [], taskDataMap = new Map<() => Promise<void>, RubricGradeData>();
  for (const {assignment_id, user_id, rubricAssessment } of data) {
    const task = () => {
      return canvasService.gradeSubmissionWithRubric(courseId, assignment_id, user_id, rubricAssessment);
    };
    tasks.push(task);
    taskDataMap.set(task, {
      user_id,
      assignment_id,
      rubricAssessment: JSON.stringify(rubricAssessment)
    });
  }

  task.setTotal(tasks.length);
  const taskController = new ParallelTaskController(tasks, 
    (curTaskCnt) => canvasService.remainingQuota > 150 && curTaskCnt < 10, 
    (_, e, retryCnt) => retryCnt <= 3 && ((e?.response?.data as (string | undefined))?.startsWith('403 Forbidden (Rate Limit Exceeded)') ?? false));
  
  const completePromise = taskController.execute();
  taskController.progress$.subscribe(([x, y]) => task.onProgressUpdate(x + y, `Updated grade for ${x} out of ${tasks.length} submissions` + (y != 0 ? ` (${y} error(s) occurred)` : '')));
  const [, errs] = await completePromise;
  if (errs.length != 0) {
    return errs.map((x) => {
      const [task, e]: [() => Promise<void>, any] = x;
      return {
        ...taskDataMap.get(task)!,
        error: formatError(e)
      };
    });
  }
  return [];
}
