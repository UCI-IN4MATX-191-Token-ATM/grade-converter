// Adopted from https://github.com/UCI-IN4MATX-191-Token-ATM/token-atm-spa/blob/main/src/app/services/exponential-backoff-executor.service.ts

export default async function exponentialBackoffExecute<T>(
  executor: () => Promise<T>,
  resultChecker: (result: T | undefined, err: any | undefined) => Promise<boolean> = async (_, err) =>
    err != undefined ? false : true,
  retryMessage?: string,
  retryCnt = 5,
  startWaitTime = 250,
  growthRate = 2
): Promise<T> {
  let curRetryCnt = 0,
    curWaitTime = startWaitTime;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    let result: T | undefined = undefined,
      error: any | undefined = undefined;
    try {
      result = await executor();
    } catch (err: any) {
      error = err;
    }
    if (await resultChecker(result, error)) {
      if (error != undefined) {
        throw error;
      } else {
        return result as T;
      }
    } else if (curRetryCnt < retryCnt) {
      curRetryCnt++;
      console.log(`Retrying... Message: ${retryMessage}. Wait for ${curWaitTime} ms`);
      await new Promise((resolve) => setTimeout(resolve, curWaitTime));
      curWaitTime *= growthRate;
    } else {
      if (error != undefined) {
        throw error;
      } else {
        throw new Error(`Result of exponential backoff execution does not pass the checker`);
      }
    }
  }
}
