import { Children, cloneElement, isValidElement, useContext, useId, useRef, useState, type FormHTMLAttributes, type ReactElement, type ReactNode } from 'react';
import { FieldValidationContext } from './FieldValidationContext';

type ControlProps = { id?: string; required?: boolean; type?: string; value?: unknown; style?: React.CSSProperties; 'aria-label'?: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean };
function InlineControl({ element }: { element: ReactElement<ControlProps> }) {
  const generated = useId();
  const id = element.props.id ?? generated;
  const errors = useContext(FieldValidationContext);
  const error = errors[id];
  return <span className="inline-control" style={{ width: element.props.style?.width, maxWidth: element.props.style?.maxWidth, flex: element.props.style?.flex }}>
    {cloneElement(element, { id, 'aria-invalid': error ? true : element.props['aria-invalid'], 'aria-describedby': [element.props['aria-describedby'], error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined })}
    {error && <small id={`${id}-error`} aria-hidden="true" className="field-validation-message">{error}</small>}
  </span>;
}
function wrap(children: ReactNode): ReactNode {
  return Children.map(children, node => {
    if (!isValidElement(node)) return node;
    const element = node as ReactElement<{ children?: ReactNode }>;
    if (typeof node.type === 'string' && ['input','select','textarea'].includes(node.type)) return <InlineControl element={node as ReactElement<ControlProps>} />;
    // Existing shared fields already render their own contextual error.
    if (typeof node.type === 'function' && (node.type as { inlineValidationField?: boolean }).inlineValidationField) return node;
    return element.props.children ? cloneElement(element, {}, wrap(element.props.children)) : node;
  });
}
export default function ValidatedForm({ children, onSubmit, onChangeCapture, ...props }: FormHTMLAttributes<HTMLFormElement>) {
  const ref = useRef<HTMLFormElement>(null);
  const [errors, setErrors] = useState<Record<string,string>>({});
  const attempted = useRef(false);
  const inspect = () => {
    const next: Record<string,string> = {};
    let first: HTMLElement | null = null;
    ref.current?.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input,select,textarea').forEach(control => {
      if (!control.id || control.disabled || !control.willValidate) return;
      let message = '';
      if (control.required && !control.value.trim()) message = control.type === 'file' ? 'Adjunta el archivo requerido.' : control.tagName === 'SELECT' ? 'Selecciona una opción.' : 'Completa este campo.';
      else if (control.type === 'checkbox' && control.required && !(control as HTMLInputElement).checked) message = 'Marca esta confirmación para continuar.';
      else if (control.validity.typeMismatch) message = control.type === 'email' ? 'Ingresa un correo electrónico válido.' : 'Corrige el formato de este campo.';
      else if (control.validity.rangeUnderflow) message = `Ingresa un valor mayor o igual a ${(control as HTMLInputElement).min}.`;
      else if (control.validity.rangeOverflow) message = `Ingresa un valor menor o igual a ${(control as HTMLInputElement).max}.`;
      else if (!control.validity.valid) message = 'Corrige el valor de este campo.';
      else if (control.dataset.min != null && Number(control.value.replace(',','.')) < Number(control.dataset.min)) message = `Ingresa un valor mayor o igual a ${control.dataset.min}.`;
      else if (control.dataset.max != null && Number(control.value.replace(',','.')) > Number(control.dataset.max)) message = `Ingresa un valor menor o igual a ${control.dataset.max}.`;
      if (message) { next[control.id] = message; first ??= control; }
    });
    setErrors(next);
    return { next, first: first as HTMLElement | null };
  };
  return <FieldValidationContext.Provider value={errors}><form {...props} ref={ref} noValidate
    onChangeCapture={event => { onChangeCapture?.(event); if (attempted.current) requestAnimationFrame(inspect); }}
    onSubmit={event => {
      attempted.current = true;
      const { next, first } = inspect();
      if (Object.keys(next).length) { event.preventDefault(); first?.focus(); first?.scrollIntoView({ block:'center' }); return; }
      onSubmit?.(event);
    }}>{wrap(children)}</form></FieldValidationContext.Provider>;
}
