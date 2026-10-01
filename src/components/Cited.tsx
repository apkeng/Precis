/** Text with inline `[n]` citations rendered as clickable superscripts. */
export function Cited({ text, onCite }: { text: string; onCite: (n: number) => void }) {
  return (
    <>
      {text.split(/(\[\d+\])/).map((part, i) => {
        const m = part.match(/^\[(\d+)\]$/);
        if (!m) return <span key={i}>{part}</span>;
        const n = Number(m[1]);
        return (
          <button key={i} className="cite" onClick={() => onCite(n)} aria-label={`Show source ${n}`}>
            [{n}]
          </button>
        );
      })}
    </>
  );
}
