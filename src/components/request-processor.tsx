import { FC, useContext, useEffect, useState } from "react";
import ProgressableTask from "../util/progressable-task";
import CanvasServiceContext, { CanvasService } from "../services/canvas-service";
import { RawGradeItem, RawGradeItemWithError } from "../data/raw-grade-item";
import { User } from "../data/user";
import { Assignment } from "../data/assignment";
import ProgressBar from "./progress-bar";
import { RubricGradeData, RubricGradeDataWithError } from "../data/rubric-grade-data";
import resolveGradeScopeData from "../tasks/gradescope-data-resolver";
import DataArrayCSVExporter from "./data-array-csv-exporter";
import matchRawDataWithStudent from "../tasks/raw-data-student-matcher";
import matchRawDataWithAssignment from "../tasks/raw-data-assignment-matcher";
import transformRawData from "../tasks/raw-data-transformer";
import uploadCanvasGrade from "../tasks/canvas-grade-uploader";
import resolveStembleData from "../tasks/stemble-data-resolver";
import formatError from "../util/error-formatter";


export default function RequestProcessor({ value, onFinish }: { value: Record<string, any>, onFinish: () => void }) {

  const canvasService: CanvasService = useContext(CanvasServiceContext);

  const [rootTaskProgress, setRootTaskProgress] = useState<number | undefined>();

  const [rootTaskMessage, setRootTaskMessage] = useState<string | undefined>();

  const [subTaskProgress, setSubTaskProgress] = useState<number | undefined>();

  const [subTaskMessage, setSubTaskMessage] = useState<string | undefined>();

  const [warningComp, setWarningComp] = useState<[FC, (v: boolean) => void] | undefined>();

  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  // Simply use FC won't work, has to be wrapped
  const [finalReport, setFinalReport] = useState<[FC] | undefined>();

  useEffect(() => {
    (async () => {
      const fileFormat: "GradeScope" | 'Stemble' = value['fileFormat'];
      const uploadedFile: File = value['uploadedFile'][0];
      const courseId: string = value['course'];
      const assignmentName: string = value['assignment'];
      // const useBatchUpdate: boolean = value['useBatchUpdate'];

      const setupFinalReport = (status: 'error' | 'aborted' | 'finished', rawDataSkipped?: Record<string, any>[], gradeDataSkipped?: Record<string, any>[]) => {
        if ((rawDataSkipped === undefined || rawDataSkipped.length == 0) && (gradeDataSkipped === undefined || gradeDataSkipped.length == 0)) return;
        setFinalReport([() => <>
          <p>{status != 'error' ? `The upload process is ${status}` : 'An error occurred during the upload process.'}. Here is some data you might need:</p>
          {(rawDataSkipped !== undefined && rawDataSkipped.length > 0) && <div className="my-3"><span>Skipped Records: </span> <DataArrayCSVExporter data={rawDataSkipped} filename={'Skipped-Records'} /></div>}
          {(gradeDataSkipped !== undefined && gradeDataSkipped.length > 0) && <div className="my-3"><span>Fail to Grade: </span> <DataArrayCSVExporter data={gradeDataSkipped} filename={'Fail-to-Grade'} /></div>}
        </>]);
      };

      const linkSubTaskInfo = <T, Args extends any[]>(task: ProgressableTask<T, Args>): (() => void) => {
        const progressSubscription = task.percentage$.subscribe(setSubTaskProgress);
        const messageSubscription = task.message$.subscribe(setSubTaskMessage);
        return () => {
          progressSubscription.unsubscribe();
          messageSubscription.unsubscribe();
          setSubTaskProgress(undefined);
          setSubTaskMessage(undefined);
        }
      };

      const warningFunc = async (comp: FC) => {
        let promiseResolve: ((v: boolean) => void) | undefined = undefined;
        const promise = new Promise<boolean>(resolve => promiseResolve = resolve);
        setWarningComp([comp, promiseResolve!]);
        const result = await promise;
        setWarningComp(undefined);
        return result;
      };

      const executeSubTask = async <T, Args extends any[]>(task: ProgressableTask<T, Args>, messageOnError: string, ...args: Args): Promise<T> => {
        const unsubscribe = linkSubTaskInfo(task);
        try {
          const result = await task.execute(...args);
          if (result === undefined) throw new Error(messageOnError);
          return result;
        } finally {
          unsubscribe();
        }
      };

      const skippedRawData: RawGradeItemWithError[] = [], failedRubricGradeData: RubricGradeDataWithError[] = [];

      const rootTask = new ProgressableTask<boolean>(async (rootTask) => {

        rootTask.onProgressUpdate(0, "Resolving records from the uploaded file");
        let rawGradeItems: RawGradeItem[] = [];
        switch (fileFormat) {
          case 'GradeScope': {
            const dataResolveTask = new ProgressableTask<RawGradeItem[], [File, string]>(resolveGradeScopeData, warningFunc);
            rawGradeItems = await executeSubTask(dataResolveTask, 'Fail to resolve the uploaded file', uploadedFile, assignmentName);
            break;
          }
          case 'Stemble': {
            const dataResolveTask = new ProgressableTask<RawGradeItem[], [File, string, string]>(resolveStembleData, warningFunc); rawGradeItems = await executeSubTask(dataResolveTask, 'Fail to resolve the uploaded file', uploadedFile, value['stembleWorkSheet'], assignmentName);
            break;
          }
        }
        // console.log('Raw grade items', rawGradeItems);

        rootTask.onProgressUpdate(1, "Matching records with current students");
        const matchStudentTask = new ProgressableTask<[[RawGradeItem, User][], RawGradeItemWithError[], boolean], [RawGradeItem[], CanvasService, string]>(matchRawDataWithStudent, warningFunc);

        const [matchedRawGradeItems, userMatchingSkippedItems, willContinue] = await executeSubTask(matchStudentTask, 'Error occurred when matching students with records', rawGradeItems, canvasService, courseId);
        skippedRawData.push(...userMatchingSkippedItems);
        if (!willContinue) {
          rootTask.onProgressUpdate(0, "Aborted!");
          return false;
        }
        // if (userMatchingSkippedItems.length > 0) console.log("Skipped the following raw grade items due to no user matched", userMatchingSkippedItems);

        rootTask.onProgressUpdate(2, "Matching records with current assignments");
        const matchAssignmentTask = new ProgressableTask<[Map<string, Assignment>, [RawGradeItem, User][], RawGradeItemWithError[], boolean], [[RawGradeItem, User][], CanvasService, string]>(matchRawDataWithAssignment, warningFunc);
        const [assignmentMap, finalMatchedRawGradeItems, assignmentMatchingSkippedItems, willUpload] = await executeSubTask(matchAssignmentTask, 'Error occurred when matching the pair of assignment and rubric item with records', matchedRawGradeItems, canvasService, courseId);
        skippedRawData.push(...assignmentMatchingSkippedItems);
        if (!willUpload) {
          rootTask.onProgressUpdate(0, "Aborted!");
          return false;
        }
        // if (assignmentMatchingSkippedItems.length > 0) console.log("Skipped the following raw grade items due to no assignment & rubric item pair matched", assignmentMatchingSkippedItems);
        // console.log('Matched raw grade items', finalMatchedRawGradeItems, assignmentMap);

        rootTask.onProgressUpdate(3, "Caching student submissions");
        const cacheSubmissionsTask = new ProgressableTask<RubricGradeData[], [[RawGradeItem, User][], Map<string, Assignment>, CanvasService, string]>(transformRawData, warningFunc);


        const rubricGradeDataArray = await executeSubTask(cacheSubmissionsTask, 'Error occurred when caching student submissions', finalMatchedRawGradeItems, assignmentMap, canvasService, courseId);
        if (rubricGradeDataArray.length == 0) {
          rootTask.onProgressUpdate(5, 'Finished since there is nothing to upload.');
          return true;
        }
        // console.log('Cached submissions', rubricGradeDataArray);

        rootTask.onProgressUpdate(4, "Updating scores on Canvas");
        const updateScoreTask = new ProgressableTask<RubricGradeDataWithError[], [RubricGradeData[], CanvasService, string]>(uploadCanvasGrade, warningFunc);

        const result = await executeSubTask(updateScoreTask, 'Error occurred when uploading grades to Canvas', rubricGradeDataArray, canvasService, courseId);
        rootTask.onProgressUpdate(5, 'Upload process finished!');
        failedRubricGradeData.push(...result);
        return true;
      }, warningFunc);

      rootTask.setTotal(5);
      const rootTaskProgressSubscription = rootTask.percentage$.subscribe(setRootTaskProgress);
      const rootTaskMessageSubscription = rootTask.message$.subscribe(setRootTaskMessage);

      let status: 'aborted' | 'finished' | 'error' = 'aborted';
      try {
        const result = await rootTask.execute();
        status = result ? 'finished' : 'aborted';
      } catch (e: any) {
        setErrorMessage(formatError(e));
        status = 'error';
      }
      // console.log('Task performed.');

      rootTaskProgressSubscription.unsubscribe();
      rootTaskMessageSubscription.unsubscribe();
      setupFinalReport(status, skippedRawData, failedRubricGradeData);

      onFinish();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const WarningComponentRef = warningComp !== undefined ? warningComp[0] : undefined;
  const FinalReportRef = finalReport !== undefined ? finalReport[0] : undefined;

  return <>
    <div className="space-y-4">
      {rootTaskProgress !== undefined &&
        <div>
          <ProgressBar progress={rootTaskProgress} />
          {rootTaskMessage && <p className="text-center">{rootTaskMessage}</p>}
        </div>}
      {subTaskProgress !== undefined &&
        <div>
          <ProgressBar progress={subTaskProgress} />
          {subTaskMessage && <p className="text-center">{subTaskMessage}</p>}
        </div>
      }
      {warningComp !== undefined && WarningComponentRef &&
        <div className="border border-black bg-yellow-100 rounded-3xl p-4">
          <h2 className="text-2xl mb-2">Warning</h2>
          <WarningComponentRef />
          <div className="flex justify-around">
            <button onClick={() => warningComp[1](false)} className="btn-dark-outline">Cancel</button>
            <button onClick={() => warningComp[1](true)} className="btn-danger">Proceed Anyway</button>
          </div>
        </div>
      }
      {
        errorMessage !== undefined &&
        <div className="border border-black bg-red-200 rounded-3xl p-4">
          <h2 className="text-2xl mb-2">An error occurred</h2>
          <p>{errorMessage}</p>
        </div>
      }
      {
        finalReport !== undefined && FinalReportRef &&
        <div className="border border-black bg-blue-200 rounded-3xl p-4">
          <h2 className="text-2xl mb-2">Final Report</h2>
          <FinalReportRef />
        </div>
      }
    </div>
  </>;
}
