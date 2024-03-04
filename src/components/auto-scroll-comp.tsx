import { FC, useEffect, useRef } from "react";

const AutoScroll: FC<{
  comp: FC;
}> = ( { comp } : { comp: FC }) => {

  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!wrapRef.current) return;
    wrapRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [wrapRef]);

  return <div ref={wrapRef}>{comp({})}</div>;
};

export default AutoScroll;
