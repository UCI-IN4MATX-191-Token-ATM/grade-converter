// Copied from https://github.com/UCI-IN4MATX-191-Token-ATM/token-atm-spa/blob/main/src/app/utils/typed-array-helper.ts
export default class TypedArrayHelper {
  public static contactUint8Array(a: Uint8Array, b: Uint8Array): Uint8Array {
    const result = new Uint8Array(a.length + b.length);
    result.set(a);
    result.set(b, a.length);
    return result;
  }

  public static splitUint8Array(src: Uint8Array, ind: number): [Uint8Array, Uint8Array] {
    return [src.subarray(0, ind), src.subarray(ind)];
  }
}
