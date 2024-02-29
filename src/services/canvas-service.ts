import { AxiosRequestConfig } from "axios";
import getAxiosService, { AxiosService, IPCCompatibleAxiosResponse, isNetworkOrServerError } from "./axios-service";
import { PaginatedResult } from "../util/paginated-result";
import CourseDef, { Course } from "../data/course";
import { createContext } from "react";
import { unwrapValidation } from "../util/io-ts-validation-unwrapper";
import UserDef, { User } from "../data/user";
import AssignmentDef, { Assignment } from "../data/assignment";
import SubmissionDef, { Submission } from "../data/submission";
import ProgressDataDef from "../data/progress-data";
import Progress from "../util/progress";
import { differenceInSeconds } from "date-fns";
import exponentialBackoffExecute from "../util/exponential-backoff-executor";

export class CanvasService {

  private static PREFLIGHT_COST = 50;
  private static DEFAULT_TOTAL_QUOTA = 700;
  private static DEFAULT_QUOTA_RECOVERY_RATE = 10;
  private static RETRY_MSG = 'Fail to communicate with Canvas. Retrying...';

  #axiosService: AxiosService;
  #url?: string;
  #accessToken?: string;
  private _remainingQuota = CanvasService.DEFAULT_TOTAL_QUOTA;
  private _observedMaxQuota = 0;
  private _latestQuotaUpdateDate = new Date();
  #activeRequests = new Set<symbol>();

  constructor() {
    this.#axiosService = getAxiosService();
  }

  public configureCredential(url: string, accessToken: string) {
    this._remainingQuota = CanvasService.DEFAULT_TOTAL_QUOTA;
    this._observedMaxQuota = 0;
    this._latestQuotaUpdateDate = new Date();
    this.#url = url;
    this.#accessToken = accessToken;
  }

  public clearCredential() {
    this._remainingQuota = CanvasService.DEFAULT_TOTAL_QUOTA;
    this._observedMaxQuota = 0;
    this._latestQuotaUpdateDate = new Date();
    this.#url = undefined;
    this.#accessToken = undefined;
  }

  public hasCredential(): boolean {
    return this.#url !== undefined && this.#accessToken !== undefined;
  }

  public get remainingQuota(): number {
    return Math.max(this._observedMaxQuota != 0 ? this._observedMaxQuota : CanvasService.DEFAULT_TOTAL_QUOTA, this._remainingQuota + CanvasService.DEFAULT_QUOTA_RECOVERY_RATE * differenceInSeconds(new Date(), this._latestQuotaUpdateDate));
  }

  #addActiveRequest(requestId: symbol): void {
    this.#activeRequests.add(requestId);
    this._remainingQuota -= CanvasService.PREFLIGHT_COST;
  }

  #removeActiveRequestByData(requestId: symbol, requestCost: string | null | undefined, remainingQuota: string | null | undefined) {
    if (remainingQuota !== undefined && remainingQuota !== null) {
      this.#activeRequests.clear();
      this._remainingQuota = Number.parseFloat(remainingQuota);
      this._observedMaxQuota = Math.max(this._observedMaxQuota, Number.parseFloat(remainingQuota));
      this._latestQuotaUpdateDate = new Date();
      return;
    }
    if (this.#activeRequests.has(requestId)) {
      this._remainingQuota += CanvasService.PREFLIGHT_COST;
      this.#activeRequests.delete(requestId);
      this._latestQuotaUpdateDate = new Date();
    }
    if (requestCost !== undefined && requestCost !== null) {
      this._remainingQuota -= Number.parseFloat(requestCost);
      this._latestQuotaUpdateDate = new Date();
    }
  }

  #removeActiveRequest<T>(requestId: symbol, response: IPCCompatibleAxiosResponse<T>): void {
    const requestCost = response.headers['x-request-cost'];
    const remainingQuota = response.headers['x-rate-limit-remaining'];
    this.#removeActiveRequestByData(requestId, requestCost, remainingQuota);
  }

  #removeActiveRequestUponError(requestId: symbol, error: any): void {
    const requestCost = error?.response?.headers?.['x-request-cost'];
    const remainingQuota = error?.response?.headers?.['x-rate-limit-remaining'];
    this.#removeActiveRequestByData(requestId, requestCost, remainingQuota);
  }

  async #rawAPIRequest<T = any>(
    endpoint: string,
    config?: AxiosRequestConfig,
    url?: string,
    accessToken?: string
  ): Promise<IPCCompatibleAxiosResponse<T>> {
    if (url === undefined) url = this.#url;
    if (accessToken === undefined) accessToken = this.#accessToken;
    return await exponentialBackoffExecute(async () => {
      const requestId = Symbol();
      this.#addActiveRequest(requestId);
      try {
        const result = await this.#axiosService.request<T>({
          ...config,
          url: url + endpoint,
          headers: {
            ...config?.headers,
            Accept: 'application/json+canvas-string-ids',
            Authorization: 'Bearer ' + accessToken
          }
        });
        this.#removeActiveRequest(requestId, result);
        return result;
      } catch(e: any) {
        this.#removeActiveRequestUponError(requestId, e);
        throw e;
      }
    }, async (_, err: any | undefined) => !isNetworkOrServerError(err), CanvasService.RETRY_MSG, 3, 1000);
  }

  async #apiRequest<T = any>(endpoint: string, config?: AxiosRequestConfig | undefined): Promise<T> {
    return (await this.#rawAPIRequest<T>(endpoint, config)).data;
  }

  public async validateCredential(url: string, accessToken: string): Promise<unknown | undefined> {
    try {
      await this.#rawAPIRequest('/api/v1/users/self', {}, url, accessToken);
    } catch (err: unknown) {
      return err;
    }
    return undefined;
  }

  async #paginatedRequestHandler<T>(url: string): Promise<IPCCompatibleAxiosResponse<T>> {
    return await this.#axiosService.request<T>({
      url: url,
      headers: {
        Accept: 'application/json+canvas-string-ids',
        Authorization: 'Bearer ' + this.#accessToken
      }
    });
  }

  public async getCourses(
    enrollmentType: 'teacher' | 'ta' = 'teacher'
  ): Promise<PaginatedResult<Course>> {
    const response = await this.#rawAPIRequest('/api/v1/courses', {
      params: {
        per_page: 100,
        enrollment_type: enrollmentType,
        include: ['term']
      }
    });
    return new PaginatedResult<Course>(
      response,
      async (url: string) => await this.#paginatedRequestHandler(url),
      (data) => {
        let processedData = data;
        if (Object.hasOwn(data, 'meta')) {
          const primaryCollectionKey = data['meta']['primaryCollection'];
          const termInfoMap = new Map<string, unknown>();
          const termCollectionKey = Object.keys(data).filter(
            (key) => !['meta', primaryCollectionKey].includes(key)
          )[0];
          if (termCollectionKey) {
            for (const term of data[termCollectionKey]) {
              if (!term['id']) continue;
              termInfoMap.set(term['id'], term);
            }
          }
          processedData = data[primaryCollectionKey];
          for (const course of processedData) {
            course.term = termInfoMap.get(course['enrollment_term_id']);
          }
        }
        return processedData.map((entry: unknown) => unwrapValidation(CourseDef.decode(entry)));
      }
    );
  }

  public async getCourseStudents(
    courseId: string
  ): Promise<PaginatedResult<User>> {
    return new PaginatedResult<User>(
      await this.#rawAPIRequest(`/api/v1/courses/${courseId}/users`, {
        params: {
          enrollment_type: ['student'],
          enrollment_state: ['active'],
          per_page: 100,
        }
      }),
      async (url: string) => await this.#paginatedRequestHandler(url),
      (data: any) => data.map((entry: any) => unwrapValidation(UserDef.decode(entry)))
    );
  }

  public async getAssignments(courseId: string): Promise<PaginatedResult<Assignment>> {
    return new PaginatedResult<Assignment>(
      await this.#rawAPIRequest(`/api/v1/courses/${courseId}/assignments`, {
        params: {
          per_page: 100
        }
      }),
      async (url: string) => await this.#paginatedRequestHandler(url),
      (data: unknown[]) => data.map((entry) => unwrapValidation(AssignmentDef.decode(entry)))
    );
  }

  // cannot be used since student_ids cannot be too large (HTTP 400 Bad Request: too many students)
  public async getSubmissionsForAssignmentsAndStudents(courseId: string, studentIds: string[], assignmentIds: string[]): Promise<PaginatedResult<Submission>> {
    return new PaginatedResult<Submission>(
      await this.#rawAPIRequest(`/api/v1/courses/${courseId}/students/submissions`, {
        params: {
          per_page: 100,
          student_ids: studentIds,
          assignment_ids: assignmentIds,
          include: ['rubric_assessment']
        }
      }),
      async (url: string) => await this.#paginatedRequestHandler(url),
      (data: unknown[]) => data.map((entry) => unwrapValidation(SubmissionDef.decode(entry)))
    );
  }

  public async getAssignmentSubmissions(courseId: string, assignmentId: string) {
    return new PaginatedResult<Submission>(
      await this.#rawAPIRequest(`/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions`, {
        params: {
          per_page: 100,
          include: ['rubric_assessment']
        }
      }),
      async (url: string) => await this.#paginatedRequestHandler(url),
      (data: unknown[]) => data.map((entry) => unwrapValidation(SubmissionDef.decode(entry)))
    );
  }

  public async getSubmission(courseId: string, assignmentId: string, studentId: string): Promise<Submission> {
    return unwrapValidation(SubmissionDef.decode(this.#apiRequest(`/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/${studentId}`, {
      params: {
        include: ['rubric_assessment']
      }
    })));
  }

  public async gradeMultipleSubmissions(courseId: string, gradeData: Record<string, Record<string, Record<'rubric_assessment', unknown>>>): Promise<Progress> {
    const progressData = unwrapValidation(ProgressDataDef.decode(await this.#apiRequest(`/api/v1/courses/${courseId}/submissions/update_grades`, {
      method: 'post',
      data: {
        grade_data: gradeData
      }
    })));
    const dataFetcher = () => this.#apiRequest(`/api/v1/progress/${progressData.id}`);
    return new Progress(progressData, dataFetcher);
  }

  public async gradeSubmissionWithRubric(courseId: string, assignmentId: string, studentId: string, rubricAssessment: unknown): Promise<void> {
    await this.#apiRequest(`/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/${studentId}`, {
      method: 'put',
      data: {
        'rubric_assessment': rubricAssessment
      }
    });
  }

}

const CanvasServiceContext = createContext(new CanvasService());

export default CanvasServiceContext;
