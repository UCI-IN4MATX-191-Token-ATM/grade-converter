import { BehaviorSubject } from "rxjs";

export default class ParallelTaskController<T> {
  private results: T[] = [];
  private errors: any[] = [];
  private taskIndex = 0;
  private completedTaskCnt = 0;
  private curTaskCnt = 0;
  private retryTaskStack: ([() => Promise<T>, number])[] = [];
  private _progress$ = new BehaviorSubject<[number, number]>([0, 0]);

  #completePromiseResolve?: () => void;

  constructor(private tasks: (() => Promise<T>)[], private shouldHaveMoreTask: (curTaskCnt: number) => boolean, private shouldRetryOnError?: (task: () => Promise<T>, err: any, retriedCnt: number) => boolean) { }

  private hasNextTask(): boolean {
    return this.retryTaskStack.length != 0 || this.taskIndex < this.tasks.length;
  }

  private startNextTask(): void {
    if (this.retryTaskStack.length != 0) {
      const [task, retryCnt] = this.retryTaskStack.pop()!;
      this.runTask(task, retryCnt);
      return;
    }
    if (this.taskIndex >= this.tasks.length) return;
    this.runTask(this.tasks[this.taskIndex++]);
  }

  public async execute(): Promise<[T[], any[]]> {
    if (this.tasks.length == 0) return [[], []];
    this.results = [];
    this.errors = [];
    this.taskIndex = 0;
    this.completedTaskCnt = 0;
    this.curTaskCnt = 0;
    this.retryTaskStack = [];
    this._progress$ = new BehaviorSubject<[number, number]>([0, 0]);
    const completePromise = new Promise<void>(resolve => this.#completePromiseResolve = resolve);

    this.startNextTask();
    while (this.shouldHaveMoreTask(this.curTaskCnt) && this.hasNextTask()) {
      this.startNextTask();
    }

    await completePromise;
    return [this.results, this.errors];
  }

  private async runTask(curTask: () => Promise<T>, retryCnt = 0): Promise<void> {
    this.curTaskCnt++;
    try {
      const result = await curTask();
      this.results.push(result);
      this.completedTaskCnt++;
    } catch (e: any) {
      if (this.shouldRetryOnError && this.shouldRetryOnError(curTask, e, retryCnt + 1)) {
        this.retryTaskStack.push([curTask, retryCnt + 1]);
      } else {
        this.errors.push([curTask, e]);
      }
    }
    this.curTaskCnt--;
    this._progress$.next([this.completedTaskCnt, this.errors.length]);
    if (this.completedTaskCnt + this.errors.length == this.tasks.length) {
      this.#completePromiseResolve?.();
      this._progress$.complete();
      return;
    }
    if (this.curTaskCnt == 0 && this.hasNextTask()) {
      while (!this.shouldHaveMoreTask(this.curTaskCnt)) {
        console.log('No task is running, but the metric prohibits the start of a new task. Waiting for the allowance of new task.');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
      this.startNextTask();
    }
    while (this.shouldHaveMoreTask(this.curTaskCnt) && this.hasNextTask()) {
      this.startNextTask();
    }
  }

  public get progress$(): BehaviorSubject<[number, number]> {
    return this._progress$;
  }
}
