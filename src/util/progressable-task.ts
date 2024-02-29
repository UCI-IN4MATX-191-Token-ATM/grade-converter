import { FC } from "react";
import { BehaviorSubject } from "rxjs";

class OnTaskExitError extends Error {}

export default class ProgressableTask<T = void, Args extends any[] = [], > {
  
  private _cnt = 0;
  private _total = 0;
  private _percentage$ = new BehaviorSubject<number>(0);
  private _message?: string;
  private _message$ = new BehaviorSubject<string | undefined>(undefined);

  constructor(private func: (progress: ProgressableTask<T, Args>, ...args: Args) => Promise<T>, private warningFunc: (comp: FC) => Promise<boolean>) {}

  public async execute(...args: Args): Promise<T | undefined> {
    try {
      return await this.func(this, ...args);
    } catch (e: any) {
      if (e instanceof OnTaskExitError) return; 
      else throw e;
    }
  }

  public async onWarning(comp: FC): Promise<boolean> {
    return await this.warningFunc(comp);
  }

  public setTotal(total: number) {
    this._total = total;
    this._percentage$.next(this.percentage);
  }

  public onProgressUpdate(cnt: number, message?: string) {
    this._cnt = cnt;
    this._message = message;
    this._percentage$.next(this.percentage);
    this._message$.next(this.message);
  }

  public get percentage(): number {
    return this._total == 0 ? 0 : this._cnt / this._total;
  }

  public get percentage$(): BehaviorSubject<number> {
    return this._percentage$;
  }

  public get message(): string | undefined {
    return this._message;
  }

  public get message$(): BehaviorSubject<string | undefined> {
    return this._message$;
  }

  public onExit() {
    throw new OnTaskExitError();
  }

  public onError(e: any) {
    throw e;
  }

}
