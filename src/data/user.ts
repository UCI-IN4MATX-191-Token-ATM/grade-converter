import * as t from 'io-ts';

const UserDef = t.strict({
  id: t.string,
  name: t.string,
  sis_user_id: t.union([t.string, t.undefined, t.null]),
  email: t.union([t.string, t.undefined, t.null])
});

export default UserDef;

export type User = t.TypeOf<typeof UserDef>;
