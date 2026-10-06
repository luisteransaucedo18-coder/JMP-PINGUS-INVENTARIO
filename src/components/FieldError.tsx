export default function FieldError({ message, id }: { message?: string; id?: string }) {
  return message ? <small id={id} className="field-validation-message" role="status">{message}</small> : null;
}
export class InlineValidationError extends Error {}
