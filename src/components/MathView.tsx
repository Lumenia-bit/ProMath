import { useMemo } from 'react';
import katex from 'katex';

export default function MathView({ latex, className = '', label }: { latex: string; className?: string; label?: string }) {
  const markup = useMemo(() => katex.renderToString(latex, {
    throwOnError: false, trust: false, strict: 'ignore', output: 'htmlAndMathml', maxExpand: 100,
  }), [latex]);
  return <div className={`math-view ${className}`} aria-label={label} dangerouslySetInnerHTML={{ __html: markup }} />;
}
