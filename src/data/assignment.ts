import * as t from 'io-ts';

const RubricDef = t.strict({
  id: t.string,
  points: t.number,
  description: t.string
});

export type Rubric = t.TypeOf<typeof RubricDef>;

const AssignmentDef = t.strict({
  id: t.string,
  name: t.string,
  rubric: t.union([t.array(RubricDef), t.undefined])
});

export default AssignmentDef;

export type Assignment = t.TypeOf<typeof AssignmentDef>;
