export default async function asyncIterableToList<T>(it: AsyncIterable<T>) {
  const result = [];
  for await (const v of it) result.push(v);
  return result;
}
