import * as t from 'io-ts';

const ProgressDataDef = t.strict({
  id: t.string,
  completion: t.union([t.number, t.null]),
  workflow_state: t.string,
  message: t.union([t.string, t.null, t.undefined]),
  results: t.union([t.unknown, t.null, t.undefined])
});

export default ProgressDataDef;

export type ProgressData = t.TypeOf<typeof ProgressDataDef>;
