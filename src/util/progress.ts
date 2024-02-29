import { BehaviorSubject } from "rxjs";
import { ProgressData } from "../data/progress-data";

export default class Progress {
  private _data: ProgressData;
  private _data$: BehaviorSubject<ProgressData>;
  private _cancel = false;

  constructor(initialData: ProgressData, dataFetcher: () => Promise<ProgressData>, updateDuration = 5000) {
    this._data = initialData;
    this._data$ = new BehaviorSubject<ProgressData>(initialData);
    const updater = async () => {
      this.data = await dataFetcher();
      if (this._cancel || this.data.workflow_state == 'completed' || this.data.workflow_state == 'failed') {
        this._data$.complete();
        return;
      }
      setTimeout(updater, updateDuration);
    }
    setTimeout(updater, updateDuration);
  }

  private set data(data: ProgressData) {
    this._data = data;
    this._data$.next(data);
  }

  public get data(): ProgressData {
    return this._data;
  }

  public get data$(): BehaviorSubject<ProgressData> {
    return this._data$;
  }

  public cancel(): void {
    this._cancel = true;
  }
}
