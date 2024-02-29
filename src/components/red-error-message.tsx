import { ErrorMessage } from "@hookform/error-message";
import { FieldErrors, FieldValues } from "react-hook-form";

const RedErrorMessage = ({ errors, name, message }: {
  errors: FieldErrors<FieldValues>;
  name: string;
  message?: string;
}) => {
  return <ErrorMessage
    errors={errors}
    name={name}
    render={({ message: internalMessage }) => (
      <p className="text-red-500">{message !== undefined ? message : internalMessage}</p>
    )}
  />
};

export default RedErrorMessage;
