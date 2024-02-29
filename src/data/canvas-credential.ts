import * as t from 'io-ts';

const CanvasCredentialDef = t.strict({
  url: t.string,
  accessToken: t.string
});

export default CanvasCredentialDef;

export type CanvasCredential = t.TypeOf<typeof CanvasCredentialDef>;
