import { useForm } from "react-hook-form";
import RedErrorMessage from "../../components/red-error-message";
import { useContext, useState } from "react";
import SecureStorageServiceContext from "../../services/secure-storage-service";
import { useNavigate } from "react-router-dom";
import CanvasServiceContext from "../../services/canvas-service";
import formatError from "../../util/error-formatter";

export default function RegisterPage() {
  const secureStorageService = useContext(SecureStorageServiceContext);
  const canvasService = useContext(CanvasServiceContext);
  const hasSavedCredential = secureStorageService.hasCredentials();
  const navigate = useNavigate();
  const { handleSubmit, register, formState: { errors } } = useForm();
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();


  const onSubmit = async (data: Record<string, string>) => {
    setIsProcessing(true);
    const url = data['url'];
    const accessToken = data['accessToken'];
    const password = data['password'];
    const validationResult = await canvasService.validateCredential(url, accessToken);
    if (validationResult !== undefined) {
      setErrorMessage(formatError(validationResult));
      setIsProcessing(false);
      return;
    }
    if (password !== undefined && password.trim().length != 0) {
      await secureStorageService.storeCredentials({
        url,
        accessToken
      }, password);
    }
    canvasService.configureCredential(url, accessToken);
    navigate('/');
    setIsProcessing(false);
  };

  return <>
    <p className="mb-4">Please provide your Canvas credential to use Grade Converter.</p>
    <form onSubmit={handleSubmit(onSubmit)}>
      <fieldset disabled={isProcessing} className="space-y-2">
        <div>
          <label className="font-bold mr-4">Canvas URL:</label>
          <input {...register("url", { required: true })} type="string" className="my-input"></input>
          <RedErrorMessage errors={errors} name="url" message="This field is required" />
        </div>
        <div>
          <label className="font-bold mr-4">Canvas Access Token:</label>
          <input {...register("accessToken", { required: true })} type="password" className="my-input"></input>
          <RedErrorMessage errors={errors} name="accessToken" message="This field is required" />
        </div>
        <div>
          <label className="font-bold mr-4">Password:</label>
          <input {...register("password")} type="password" className="my-input"></input>
          <p>Note: if you leave the password blank, your credential won't be saved.</p>
        </div>
        {errorMessage !== undefined && <p style={{ color: 'red' }}>Credential is invalid. Error: {errorMessage}</p>}
        <button type="submit" className="btn-primary-outline">Save & Login</button>
      </fieldset>
    </form>
    {hasSavedCredential &&
      <button onClick={() => navigate('/login')} disabled={isProcessing} className="btn-dark-outline mt-4">Use saved credential instead</button>}
  </>;
}
