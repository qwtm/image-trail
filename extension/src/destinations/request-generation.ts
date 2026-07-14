import { useCallback, useEffect, useMemo, useRef } from 'react';

export interface RequestGeneration {
  readonly begin: () => number;
  readonly isCurrent: (request: number) => boolean;
}

export function useRequestGeneration(): RequestGeneration {
  const generation = useRef(0);
  useEffect(
    () => () => {
      generation.current += 1;
    },
    [],
  );
  const begin = useCallback(() => {
    generation.current += 1;
    return generation.current;
  }, []);
  const isCurrent = useCallback((request: number) => generation.current === request, []);
  return useMemo(() => ({ begin, isCurrent }), [begin, isCurrent]);
}
