import { Assignment } from "../data/assignment";
import { RawGradeItem } from "../data/raw-grade-item";
import { RubricGradeData } from "../data/rubric-grade-data";
import { Submission } from "../data/submission";
import { User } from "../data/user";
import { CanvasService } from "../services/canvas-service";
import ProgressableTask from "../util/progressable-task";
import merge from 'deepmerge';

export default async function transformRawData<T, Args extends any[]>(task: ProgressableTask<T, Args>, rawGradeItems: [RawGradeItem, User][], assignmentMap: Map<string, Assignment>, canvasService: CanvasService, courseId: string): Promise<RubricGradeData[]> {

  const studentIds = [...new Set(rawGradeItems.map((x) => x[1].id))];
  const assignmentIds = [...assignmentMap.values()].map((x) => x.id);

  task.onProgressUpdate(0, `Getting student assignment submission information from Canvas`);
  const cachedSubmissions = new Map<string, Map<string, Submission>>();
  const total = studentIds.length * assignmentIds.length;
  task.setTotal(total);
  let cnt = 0;
  const studentIdSet = new Set(studentIds);

  for (const assignment of assignmentIds) {
    cachedSubmissions.set(assignment, new Map<string, Submission>());
    const tmpMap = cachedSubmissions.get(assignment)!;
    for await (const submission of await canvasService.getAssignmentSubmissions(courseId, assignment)) {
      if (!studentIdSet.has(submission.user_id)) continue;
      tmpMap.set(submission.user_id, submission);
      cnt++;
      task.onProgressUpdate(cnt, `Got ${cnt} out of ${total} submissions from Canvas`);
    }
    for (const student of studentIds) {
      if (!tmpMap.has(student)) {
        tmpMap.set(student, await canvasService.getSubmission(courseId, assignment, student));
        cnt++;
        task.onProgressUpdate(cnt, `Got ${cnt} out of ${total} submissions from Canvas`);
      }
    }
  }

  const assignmentRubricItemMap = new Map<string, Map<string, string>>();
  for (const assignment of assignmentMap.values()) {
    if (!assignment.rubric) continue;
    const tmpMap = new Map<string, string>();
    for (const item of assignment.rubric) {
      tmpMap.set(item.description, item.id);
    }
    assignmentRubricItemMap.set(assignment.name, tmpMap);
  }

  const rubricAssessmentMap = new Map<string, Map<string, Map<string, number>>>();
  for (const [item, user] of rawGradeItems) {
    const assignmentId = assignmentMap.get(item.assignment)!.id;
    if (!rubricAssessmentMap.has(assignmentId)) rubricAssessmentMap.set(assignmentId, new Map<string, Map<string, number>>());
    const tmpMap1 = rubricAssessmentMap.get(assignmentId)!;
    const studentId = user.id;
    if (!tmpMap1.has(studentId)) tmpMap1.set(studentId, new Map<string, number>());
    const tmpMap2 = tmpMap1.get(studentId)!;
    const rubricItemId = assignmentRubricItemMap.get(item.assignment)!.get(item.rubric_item)!;
    if (!tmpMap2.has(rubricItemId)) tmpMap2.set(rubricItemId, item.grade);
    else tmpMap2.set(rubricItemId, tmpMap2.get(rubricItemId)! + item.grade);
  }

  const result: RubricGradeData[] = [];

  for (const [assignmentId, studentRubricAssessments] of rubricAssessmentMap.entries()) {
    for (const [studentId, rubricAssessments] of studentRubricAssessments.entries()) {
      const updatedRubricAssessment: Record<string, Record<'points', number>> = {};
      for (const [rubricItemId, rubricItemScore] of rubricAssessments.entries()) {
        updatedRubricAssessment[rubricItemId] = {
          points: rubricItemScore
        };
      }
      result.push({
        user_id: studentId,
        assignment_id: assignmentId,
        rubricAssessment: merge<any, any>(cachedSubmissions.get(assignmentId)!.get(studentId)!.rubric_assessment as any, updatedRubricAssessment)
      });
    }
  }

  result.sort((a, b) => a.user_id != b.user_id ? a.user_id.localeCompare(b.user_id) : a.assignment_id.localeCompare(b.assignment_id));

  return result;
}
