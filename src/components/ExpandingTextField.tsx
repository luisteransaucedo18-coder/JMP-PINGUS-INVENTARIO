import { useLayoutEffect, useRef, type TextareaHTMLAttributes } from 'react';

// Keep long values and placeholders readable as the form changes width.
export default function ExpandingTextField(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const field = ref.current!;
    const resize = () => {
      field.style.height = 'auto';
      field.style.height = `${field.scrollHeight + 3}px`;
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(field);
    return () => observer.disconnect();
  }, [props.value, props.placeholder]);
  return <textarea {...props} ref={ref} rows={1} className={`${props.className ?? 'input-field'} expanding-text-field`} />;
}
