import * as t from 'io-ts';

const SubmissionDef = t.strict({
  id: t.string,
  assignment_id: t.string,
  user_id: t.string,
  rubric_assessment: t.union([t.unknown, t.undefined])
});

export default SubmissionDef;

export type Submission = t.TypeOf<typeof SubmissionDef>;
