import * as t from 'io-ts';
import { chain } from 'fp-ts/Either';
import { ISODateDef } from './iso-date';

const RawTermDef = t.strict({
  name: t.string
});

const TermDef = new t.Type<string, { name: string }, unknown>(
  'Term',
  t.string.is,
  (v, ctx) =>
    chain(({ name }: t.TypeOf<typeof RawTermDef>): t.Validation<string> => t.success(name))(RawTermDef.validate(v, ctx)),
  (v) => ({ name: v })
);

const CourseDef = t.strict({
  id: t.string,
  name: t.string,
  term: TermDef,
  created_at: ISODateDef
});

export default CourseDef;

export type Course = t.TypeOf<typeof CourseDef>;
