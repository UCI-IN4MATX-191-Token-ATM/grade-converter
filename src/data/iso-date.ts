import * as t from 'io-ts';
import { chain } from 'fp-ts/Either';
import { formatISO, parseISO } from 'date-fns';

export const ISODateDef = new t.Type<Date, string, unknown>(
  'ISODate',
  (v): v is Date => v instanceof Date,
  (v, ctx) =>
      chain((time: string): t.Validation<Date> => {
          const res = parseISO(time);
          return isNaN(res.getTime()) ? t.failure(v, ctx) : t.success(res);
      })(t.string.validate(v, ctx)),
  (v) => formatISO(v)
);
