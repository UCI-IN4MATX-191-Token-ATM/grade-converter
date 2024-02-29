// Adopted from https://github.com/UCI-IN4MATX-191-Token-ATM/token-atm-spa/blob/main/src/app/services/axios.service.ts
import axios, { Axios, AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';

type AxiosServiceHeader = Pick<Axios, 'head' | 'options' | 'put' | 'post' | 'patch' | 'delete' | 'get' | 'request'>;
const AXIOS_METHODS = ['head', 'options', 'put', 'post', 'patch', 'delete', 'get', 'request'];

export type IPCCompatibleAxiosResponse<T = any, D = any> = Pick<
  AxiosResponse<T, D>,
  'data' | 'status' | 'statusText' | 'headers'
>;

export type IPCCompatibleAxiosErrorWithoutResponse<T = unknown, D = any> = Pick<
  AxiosError<T, D>,
  'code' | 'isAxiosError' | 'status'
>;

export type IPCCompatibleAxiosError<T = unknown, D = any> = IPCCompatibleAxiosErrorWithoutResponse<T, D> & {
  response?: IPCCompatibleAxiosResponse<T, D>;
};

export function isNetworkOrServerError(err: any) {
  if (err == undefined) return false;
  if (typeof err.isAxiosError == 'boolean' && err.isAxiosError) {
    const axiosError = err as IPCCompatibleAxiosError;
    if (!axiosError.response) return true;
    const status = axiosError.response.status;
    if (status == undefined || status < 400 || status >= 500) return true;
    return false;
  } else {
    return true;
  }
}

export abstract class AxiosService implements AxiosServiceHeader {
  abstract head<T = any, R = IPCCompatibleAxiosResponse<T, any>, D = any>(
    url: string,
    config?: AxiosRequestConfig<D> | undefined
  ): Promise<R>;
  abstract options<T = any, R = IPCCompatibleAxiosResponse<T, any>, D = any>(
    url: string,
    config?: AxiosRequestConfig<D> | undefined
  ): Promise<R>;
  abstract put<T = any, R = IPCCompatibleAxiosResponse<T, any>, D = any>(
    url: string,
    data?: D | undefined,
    config?: AxiosRequestConfig<D> | undefined
  ): Promise<R>;
  abstract post<T = any, R = IPCCompatibleAxiosResponse<T, any>, D = any>(
    url: string,
    data?: D | undefined,
    config?: AxiosRequestConfig<D> | undefined
  ): Promise<R>;
  abstract patch<T = any, R = IPCCompatibleAxiosResponse<T, any>, D = any>(
    url: string,
    data?: D | undefined,
    config?: AxiosRequestConfig<D> | undefined
  ): Promise<R>;
  abstract delete<T = any, R = IPCCompatibleAxiosResponse<T, any>, D = any>(
    url: string,
    config?: AxiosRequestConfig<D> | undefined
  ): Promise<R>;
  abstract get<T = any, R = IPCCompatibleAxiosResponse<T, any>, D = any>(
    url: string,
    config?: AxiosRequestConfig<D> | undefined
  ): Promise<R>;
  abstract request<T = any, R = IPCCompatibleAxiosResponse<T, any>, D = any>(
    config: AxiosRequestConfig<D>
  ): Promise<R>;
}

export default function getAxiosService() {
  const proxy = (window as any).axiosProxy;
  if (!proxy) {
    return axios;
  }
  return new Proxy(
    {},
    {
      get(_, prop) {
        if (typeof prop == 'symbol' || !AXIOS_METHODS.includes(prop)) return undefined;
        return (...args: unknown[]) => {
          return proxy(prop, ...args);
        };
      }
    }
  ) as AxiosService;
}
