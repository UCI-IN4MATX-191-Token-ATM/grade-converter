// Copied from https://github.com/UCI-IN4MATX-191-Token-ATM/token-atm-spa/blob/main/src/app/utils/crypto-helper.ts
import TypedArrayHelper from './typed-array-helper';

export default class CryptoHelper {
  public static AES_IV_LENGTH = 12;

  public static async generateRSAOAEPKeyPair(): Promise<CryptoKeyPair> {
    return await window.crypto.subtle.generateKey(
      {
        name: 'RSA-OAEP',
        modulusLength: 4096,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256'
      },
      true,
      ['encrypt', 'decrypt']
    );
  }

  public static async deriveAESKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const PBKDF2Key = await window.crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );
    return await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        hash: 'SHA-512',
        salt: salt,
        iterations: 100000
      },
      PBKDF2Key,
      {
        name: 'AES-GCM',
        length: 256
      },
      false,
      ['encrypt', 'decrypt']
    );
  }

  public static async generateAESKey(extractable = false): Promise<CryptoKey> {
    return await window.crypto.subtle.generateKey(
      {
        name: 'AES-GCM',
        length: 256
      },
      extractable,
      ['encrypt', 'decrypt']
    );
  }

  public static encryptAES(key: CryptoKey, content: string, iv?: Uint8Array): Promise<[Uint8Array, Uint8Array]> {
    return this.encryptAESRaw(key, new TextEncoder().encode(content), iv);
  }

  public static encryptAESWithIV(key: CryptoKey, content: string): Promise<Uint8Array> {
    return this.encryptAESRawWithIV(key, new TextEncoder().encode(content));
  }

  public static async encryptAESRawWithIV(key: CryptoKey, content: Uint8Array): Promise<Uint8Array> {
    const [iv, encryptedData] = await this.encryptAESRaw(key, content);
    return TypedArrayHelper.contactUint8Array(iv, encryptedData);
  }

  public static async encryptAESRaw(
    key: CryptoKey,
    content: Uint8Array,
    iv?: Uint8Array
  ): Promise<[Uint8Array, Uint8Array]> {
    if (iv == undefined) iv = window.crypto.getRandomValues(new Uint8Array(CryptoHelper.AES_IV_LENGTH));
    const encryptedData = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      key,
      content
    );
    return [iv, new Uint8Array(encryptedData)];
  }

  public static async decryptAES(key: CryptoKey, encryptedData: Uint8Array, iv: Uint8Array): Promise<string> {
    return new TextDecoder().decode(await this.decryptAESRaw(key, encryptedData, iv));
  }

  public static async decryptAESWithIV(key: CryptoKey, encryptedDataWithIV: Uint8Array): Promise<string> {
    return new TextDecoder().decode(await this.decryptAESRawWithIV(key, encryptedDataWithIV));
  }

  public static async decryptAESRawWithIV(key: CryptoKey, encryptedDataWithIV: Uint8Array): Promise<Uint8Array> {
    const [iv, encryptedData] = TypedArrayHelper.splitUint8Array(encryptedDataWithIV, CryptoHelper.AES_IV_LENGTH);
    return this.decryptAESRaw(key, encryptedData, iv);
  }

  public static async decryptAESRaw(key: CryptoKey, encryptedData: Uint8Array, iv: Uint8Array): Promise<Uint8Array> {
    return new Uint8Array(
      await window.crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv
        },
        key,
        encryptedData
      )
    );
  }

  public static encryptRSA(key: CryptoKey, data: string): Promise<Uint8Array> {
    return this.encryptRSARaw(key, new TextEncoder().encode(data));
  }

  public static async encryptRSARaw(key: CryptoKey, data: Uint8Array): Promise<Uint8Array> {
    return new Uint8Array(
      await window.crypto.subtle.encrypt(
        {
          name: 'RSA-OAEP'
        },
        key,
        data
      )
    );
  }

  public static async decryptRSA(key: CryptoKey, encryptedData: Uint8Array): Promise<string> {
    return new TextDecoder().decode(await this.decryptRSARaw(key, encryptedData));
  }

  public static async decryptRSARaw(key: CryptoKey, encryptedData: Uint8Array): Promise<Uint8Array> {
    return new Uint8Array(
      await window.crypto.subtle.decrypt(
        {
          name: 'RSA-OAEP'
        },
        key,
        encryptedData
      )
    );
  }
}