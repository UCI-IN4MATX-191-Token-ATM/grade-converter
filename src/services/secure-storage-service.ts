import { Base64 } from "js-base64";
import CryptoHelper from "../util/crypto-helper";
import { CanvasCredential } from "../data/canvas-credential";
import { createContext } from "react";

export class SecureStorageService {

  private getStoredItem(key: string, isRequired = true): string {
    const result = localStorage.getItem(key);
    if (!isRequired) return result ?? '';
    if (result == null) throw new Error(`${key} not found in localStorage`);
    return result;
  }

  public async storeCredentials(credentials: CanvasCredential, password: string): Promise<void> {
    const salt = window.crypto.getRandomValues(new Uint8Array(32));
    const key = await CryptoHelper.deriveAESKey(password, salt);
    const [iv, data] = await CryptoHelper.encryptAES(key, JSON.stringify(credentials));
    localStorage.setItem('salt', Base64.fromUint8Array(salt));
    localStorage.setItem('iv', Base64.fromUint8Array(iv));
    localStorage.setItem('data', Base64.fromUint8Array(data));
  }

  public async retrieveCredentials(password: string): Promise<CanvasCredential> {
    const salt = new Uint8Array(Base64.toUint8Array(this.getStoredItem('salt')));
    const key = await CryptoHelper.deriveAESKey(password, salt);
    const iv = new Uint8Array(Base64.toUint8Array(this.getStoredItem('iv')));
    const encryptedData = new Uint8Array(Base64.toUint8Array(this.getStoredItem('data')));
    const data = await CryptoHelper.decryptAES(key, encryptedData, iv);
    return JSON.parse(data);
  }

  public hasCredentials(): boolean {
    return (
      localStorage.getItem('salt') != null &&
      localStorage.getItem('iv') != null &&
      localStorage.getItem('data') != null
    );
  }

  public clearCredentials(): void {
    localStorage.removeItem('salt');
    localStorage.removeItem('iv');
    localStorage.removeItem('data');
  }
}

const SecureStorageServiceContext = createContext(new SecureStorageService());

export default SecureStorageServiceContext;
