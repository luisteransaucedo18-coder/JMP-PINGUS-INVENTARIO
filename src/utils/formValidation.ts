export type FieldIssue = { id: string; label: string; message: string; step: number };
export function collectFieldIssues(form: HTMLFormElement, currentStep?: number): FieldIssue[] {
  return Array.from(form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input,select,textarea')).flatMap(control => {
    const section = control.closest<HTMLElement>('[data-form-step]');
    if (!section || (currentStep != null && Number(section.dataset.formStep) !== currentStep) || control.type === 'checkbox') return [];
    const wrapper = control.closest<HTMLElement>('[data-field-label]');
    const label = wrapper?.dataset.fieldLabel;
    if (!label || !control.id || ('readOnly' in control && control.readOnly)) return [];
    let message = '';
    if (control.required && !control.value.trim()) message = control.tagName === 'SELECT' ? 'Selecciona una opción.' : 'Completa este campo.';
    else if (control.dataset.min != null && Number(control.value.replace(',', '.')) < Number(control.dataset.min)) message = `Ingresa un valor mayor o igual a ${control.dataset.min}.`;
    else if (control.dataset.max != null && Number(control.value.replace(',', '.')) > Number(control.dataset.max)) message = `Ingresa un valor menor o igual a ${control.dataset.max}.`;
    else if (control.dataset.integer === 'true' && !Number.isInteger(Number(control.value))) message = 'Ingresa un número entero.';
    else if (!control.disabled && !control.validity.valid) message = control.validity.tooLong && 'maxLength' in control ? `Usa como máximo ${control.maxLength} caracteres.` : 'Corrige el valor de este campo.';
    return message ? [{ id: control.id, label, message, step: Number(section.dataset.formStep) }] : [];
  });
}
