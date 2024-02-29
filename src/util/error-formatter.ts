import { stringify } from 'flatted';

export default function formatError(e: any) {
  return stringify(e);
}
