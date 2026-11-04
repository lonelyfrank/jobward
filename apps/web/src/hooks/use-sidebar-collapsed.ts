import { useCallback, useState } from 'react';
import { readStorage, writeStorage } from '@/lib/storage';

const KEY = 'mr-sidebar-collapsed';

export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(() => readStorage(KEY) === '1');
  const toggle = useCallback(() => {
    setCollapsed((current) => {
      writeStorage(KEY, current ? '0' : '1');
      return !current;
    });
  }, []);
  return { collapsed, toggle };
}
