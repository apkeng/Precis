import { TOPICS_BY_ID } from '../topics';

/** Topic chips: short labels, or full names with `full`. */
export function Tags({ topics, large, full }: { topics: string[]; large?: boolean; full?: boolean }) {
  return (
    <>
      {topics.map((id) => (
        <span key={id} className={'tag' + (large ? ' lg' : '')}>
          {full ? (TOPICS_BY_ID[id]?.name ?? id) : (TOPICS_BY_ID[id]?.short ?? id)}
        </span>
      ))}
    </>
  );
}
