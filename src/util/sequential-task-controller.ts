export default class SequentialTaskController<T> {

  private curTask?: () => Promise<T>;

  constructor(private onTaskFinish: (v: T) => void) { }

  public async runTask(task: () => Promise<T>) {
    this.curTask = task;
    let result: T | undefined = undefined;
    try {
      result = await task();
    } finally {
      if (this.curTask == task) {
        if (result !== undefined) this.onTaskFinish(result);
        this.curTask = undefined;
      }
    }
    
  }

}
