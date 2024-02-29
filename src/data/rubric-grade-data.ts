import * as t from 'io-ts';

const RubricGradeDataDef = t.strict({
  user_id: t.string,
  assignment_id: t.string,
  rubricAssessment: t.unknown
});

export default RubricGradeDataDef;

export const RubricGradeDataWithErrorDef = t.intersection([RubricGradeDataDef, t.strict({
  error: t.string
})]);

export type RubricGradeData = t.TypeOf<typeof RubricGradeDataDef>;

export type RubricGradeDataWithError = t.TypeOf<typeof RubricGradeDataWithErrorDef>;
