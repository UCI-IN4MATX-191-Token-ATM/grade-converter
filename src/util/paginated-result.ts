// Copied from https://github.com/UCI-IN4MATX-191-Token-ATM/token-atm-spa/blob/main/src/app/utils/paginated-result.ts
import { IPCCompatibleAxiosResponse } from "../services/axios-service";

export class PaginatedResult<T> implements AsyncIterable<T> {
  private data: T[];
  private nextURL: string | undefined;
  private requestHandler: (url: string) => Promise<IPCCompatibleAxiosResponse>;
  private dataProcessor: (data: any) => T[];

  constructor(
    response: IPCCompatibleAxiosResponse,
    requestHandler: (url: string) => Promise<IPCCompatibleAxiosResponse>,
    dataProcessor: (data: any) => T[]
  ) {
    this.data = dataProcessor(response.data);
    this.nextURL = this.extractNextURL(response);
    this.requestHandler = requestHandler;
    this.dataProcessor = dataProcessor;
  }

  private extractNextURL(response: IPCCompatibleAxiosResponse): string | undefined {
    const linkHeader = response.headers['link'];
    if (!linkHeader) return undefined;
    for (const link of (linkHeader as string).split(',')) {
      if (link.endsWith('rel="next"')) {
        const rawNextLink = link.split(';')[0];
        return rawNextLink?.substring(1, rawNextLink.length - 1);
      }
    }
    return undefined;
  }

  private hasNextPage() {
    return this.nextURL != undefined;
  }

  private async fetchNextPage() {
    if (!this.nextURL) return;
    const response = await this.requestHandler(this.nextURL);
    this.data.push(...this.dataProcessor(response.data));
    this.nextURL = this.extractNextURL(response);
  }

  private async *generator(): AsyncIterator<T> {
    let index = 0;
    while (this.hasNextPage() || index != this.data.length) {
      if (index == this.data.length) await this.fetchNextPage();
      if (index == this.data.length) return;
      const result = this.data[index++];
      if (result === undefined) throw new Error('Index out of bounds');
      yield result;
    }
  }

  public [Symbol.asyncIterator]() {
    return this.generator();
  }
}
