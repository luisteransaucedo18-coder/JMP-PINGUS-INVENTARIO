import { useLayoutEffect, useRef, type TextareaHTMLAttributes } from 'react';

type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & { maxAutoHeight?: number };
export default function AutoSizeTextarea({ value, maxAutoHeight = Infinity, ...props }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const element = ref.current!;
    const fit = () => {
      element.style.height = '0px';
      const border = element.offsetHeight - element.clientHeight;
      element.style.height = `${Math.min(element.scrollHeight + border, maxAutoHeight)}px`;
      element.style.overflowY = element.scrollHeight > maxAutoHeight ? 'auto' : 'hidden';
    };
    fit();
    let previousWidth = element.clientWidth;
    const observer = new ResizeObserver(() => {
      if (element.clientWidth !== previousWidth) { previousWidth = element.clientWidth; fit(); }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [value, maxAutoHeight]);
  return <textarea {...props} value={value} ref={ref} rows={1} style={{ ...props.style, resize: 'none' }} />;
}
