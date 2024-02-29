import { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import SecureStorageServiceContext from "../../services/secure-storage-service";
import { useForm } from "react-hook-form";
import CanvasServiceContext from "../../services/canvas-service";
import RedErrorMessage from "../../components/red-error-message";
import formatError from "../../util/error-formatter";

export default function LoginPage() {
  const secureStorageService = useContext(SecureStorageServiceContext);
  const canvasService = useContext(CanvasServiceContext);
  const hasSavedCredential = secureStorageService.hasCredentials();
  const navigate = useNavigate();
  const { handleSubmit, register, formState: { errors } } = useForm();
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  useEffect(() => {
    if (!hasSavedCredential) navigate('/register');
  }, [hasSavedCredential, navigate]);

  const onSubmit = async (data: Record<string, string>) => {
    setIsProcessing(true);
    const password = data['password'];
    try {
      const { url, accessToken } = await secureStorageService.retrieveCredentials(password);
      const validationResult = await canvasService.validateCredential(url, accessToken);
      if (validationResult !== undefined) {
        setErrorMessage(formatError(validationResult));
        setIsProcessing(false);
        return;
      }
      canvasService.configureCredential(url, accessToken);
      navigate('/');
      setIsProcessing(false);
    } catch (e: any) {
      setErrorMessage('Fail to unlocking credential with provided password.');
      setIsProcessing(false);
    }
  };

  return <>
    <p className="mb-4">You've saved credential for Grade Converter. Please unlock it to log in by providing the password.</p>
    <form onSubmit={handleSubmit(onSubmit)}>
      <fieldset disabled={isProcessing} className="space-y-4">
        <div>
          <label className="font-bold mr-4">Password:</label>
          <input {...register("password", { required: true })} type="password" className="my-input"></input>
          <RedErrorMessage errors={errors} name="accessToken" message="This field is required" />
        </div>
        {errorMessage !== undefined && <p className="text-red-500">Credential is invalid. Error: {errorMessage}</p>}
        <button type="submit" className="btn-primary-outline">Unlock Credential & Login</button>
      </fieldset>
    </form>
    <button onClick={() => navigate('/register')} disabled={isProcessing} className="btn-dark-outline mt-4">Provide new credential instead</button>
  </>;
}
