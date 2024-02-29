import * as t from 'io-ts';

const RawGradeItemDef = t.strict({
  sis_id: t.union([t.string, t.undefined]),
  email: t.union([t.string, t.undefined]),
  assignment: t.string,
  rubric_item: t.string,
  grade: t.number
});

export default RawGradeItemDef;

export const RawGradeItemWithErrorDef = t.intersection([RawGradeItemDef, t.strict({
  error: t.string
})]);

export type RawGradeItem = t.TypeOf<typeof RawGradeItemDef>;

export type RawGradeItemWithError = t.TypeOf<typeof RawGradeItemWithErrorDef>;
