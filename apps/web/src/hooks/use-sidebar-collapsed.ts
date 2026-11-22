import { useCallback, useState } from 'react';
import { readStorageWithLegacy, writeStorage } from '@/lib/storage';

const KEY = 'jobward-sidebar-collapsed';

export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(
    () => readStorageWithLegacy(KEY, 'mr-sidebar-collapsed') === '1',
  );
  const toggle = useCallback(() => {
    setCollapsed((current) => {
      writeStorage(KEY, current ? '0' : '1');
      return !current;
    });
  }, []);
  return { collapsed, toggle };
}
