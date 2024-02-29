import { useContext, useEffect, useState } from "react";
import { Control, Controller, useForm } from "react-hook-form";
import Select from "react-select";
import RequestProcessor from "../../components/request-processor";
import CanvasServiceContext from "../../services/canvas-service";
import asyncIterableToList from "../../util/async-iterator-util";
import { Course } from "../../data/course";
import { useNavigate } from "react-router-dom";
import RedErrorMessage from "../../components/red-error-message";
import ExcelJS from 'exceljs';
import SequentialTaskController from "../../util/sequential-task-controller";

const SelectFormField = ({ name, formControl, options, isRequired = false, isDisabled = false, isLoading = false }: {
  name: string;
  formControl: Control;
  options: {
    value: string;
    label: string;
  }[];
  isRequired?: boolean;
  isDisabled?: boolean;
  isLoading?: boolean;
}) => {
  return <Controller
    name={name}
    control={formControl}
    {...(isRequired ? { rules: { required: true } } : {})}
    render={({ field }) => (
      <Select
        {...field}
        options={options}
        value={field.value ? options.find((x) => x.value == field.value) : null}
        placeholder={isLoading ? "Loading" : "Search / Select an option..."}
        isDisabled={isDisabled}
        isLoading={isLoading}
        onChange={(option) => field.onChange(option?.value)} />
    )} />;
}


export default function MainPage() {
  const canvasService = useContext(CanvasServiceContext);
  const isLoggedIn = canvasService.hasCredential();
  const navigate = useNavigate();
  useEffect(() => {
    if (!isLoggedIn) {
      navigate('/login');
    }
  }, [isLoggedIn, navigate]);

  const { control, handleSubmit, register, formState: { errors }, watch, setValue } = useForm();

  const fileFormatOptions = [{ value: "GradeScope", label: "GradeScope" }, { value: 'Stemble', label: 'Stemble' }];

  const curFileFormat = watch('fileFormat');
  const curUploadedFile = watch('uploadedFile');

  const fileSuffix: Record<string, string> = {
    'GradeScope': '.zip',
    'Stemble': '.xlsx'
  };

  const [courses, setCourses] = useState<{
    value: string;
    label: string;
  }[] | undefined>(undefined);
  const [stembleWorkSheets, setStembleWorkSheets] = useState<{
    value: string;
    label: string;
  }[] | undefined>(undefined);
  const [ stembleWorkSheetTaskController ] = useState<SequentialTaskController<string[]>>(new SequentialTaskController<string[]>((v) => setStembleWorkSheets(v.map((x) => ({ value: x, label: x})))));

  const [data, setData] = useState<Record<string, any> | undefined>(undefined);
  const [isFinished, setIsFinished] = useState<boolean>(false);

  const onSubmit = (data: any) => {
    setData(data);
    setIsFinished(false);
  }

  useEffect(() => {
    if (!isLoggedIn) return;
    (async () => {
      const coursesAsTA = await asyncIterableToList(await canvasService.getCourses('ta'));
      const coursesAsTeacher = await asyncIterableToList(await canvasService.getCourses('teacher'));
      const courses: Course[] = [], courseIds = new Set<string>();
      [...coursesAsTA, ...coursesAsTeacher].forEach((x) => {
        if (courseIds.has(x.id)) return;
        courses.push(x);
        courseIds.add(x.id);
      })
      setCourses(courses.sort((a, b) => a.created_at.getDate() - b.created_at.getDate()).map((x) => ({ value: x.id, label: `${x.name} (${x.term})` })))
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn]);

  useEffect(() => {
    setValue('uploadedFile', []);
  }, [curFileFormat, setValue]);

  useEffect(() => {
    if (curFileFormat == 'Stemble') setValue('stembleWorkSheet', undefined);
  }, [curFileFormat, curUploadedFile, setValue]);

  useEffect(() => {
    if (curFileFormat !== 'Stemble' || curUploadedFile?.[0] === undefined) return;
    stembleWorkSheetTaskController.runTask(async () => {
      const workBook = new ExcelJS.Workbook();
      await workBook.xlsx.load(await (curUploadedFile?.[0] as File).arrayBuffer());
      return workBook.worksheets.map((x) => x.name);
    });
  }, [curFileFormat, curUploadedFile, stembleWorkSheetTaskController]);

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="mb-4">
        <fieldset disabled={data !== undefined} className="space-y-4">
          <div>
            <h2 className="text-2xl">Which system did you export the data from?</h2>
            <SelectFormField name="fileFormat" formControl={control} options={fileFormatOptions} isRequired={true} isDisabled={data !== undefined}></SelectFormField>
            <RedErrorMessage errors={errors} name="fileFormat" message="This field is required" />
          </div>
          <div>
            <h2 className="text-2xl">Please select the data file.</h2>
            <div>
              <input {...register('uploadedFile', { required: true })} type="file" accept={fileSuffix[curFileFormat]} disabled={curFileFormat === undefined}></input>
            </div>
            {curFileFormat === undefined && <p className="my-1">Please select the source of the file first.</p>}
            <RedErrorMessage errors={errors} name="uploadedFile" message="This field is required" />
          </div>
          {curFileFormat == 'Stemble' && <div>
            <h2 className="text-2xl">Which worksheet within the file do you want to upload?</h2>
            {curUploadedFile?.[0] !== undefined ?
              (stembleWorkSheets === undefined ? <SelectFormField name="stembleWorkSheet" formControl={control} options={[]} isDisabled={true} isLoading={true}></SelectFormField> : <SelectFormField name="stembleWorkSheet" formControl={control} options={stembleWorkSheets} isRequired={true} isDisabled={data !== undefined}></SelectFormField>)
              : <p className="my-1">Please upload a file first.</p>
            }
            <RedErrorMessage errors={errors} name="stembleWorkSheet" message="This field is required" />
          </div>
          }
          <div>
            <h2 className="text-2xl">Which course do you want to update the grade for?</h2>
            {courses === undefined ? <SelectFormField name="course" formControl={control} options={[]} isDisabled={true} isLoading={true}></SelectFormField> : <SelectFormField name="course" formControl={control} options={courses} isRequired={true} isDisabled={data !== undefined}></SelectFormField>}
            <RedErrorMessage errors={errors} name="course" message="This field is required" />
          </div>
          <div>
            <h2 className="text-2xl">What is the assignment name you want to update the grade for?</h2>
            <div><input {...register("assignment", { required: true })} type="string" className="my-input"></input></div>
            <RedErrorMessage errors={errors} name="assignment" message="This field is required" />
          </div>
          {/* <div>
            <h2><input {...register("useBatchUpdate", { value: true })} type="checkbox"></input>Do you want to use Canvas&apos; batch update feature?</h2>
          </div> */}
          <button type="submit" className="btn-primary-outline">Start</button>
        </fieldset>
      </form>
      {isFinished && <button onClick={() => { setData(undefined); setIsFinished(false); }} disabled={!isFinished} className="mb-4 btn-danger">Clear</button>}
      {data && <RequestProcessor value={data} onFinish={() => setIsFinished(true)} />}
    </>
  );
}
