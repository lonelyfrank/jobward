import { describe, expect, it } from 'vitest';
import { readStorageWithLegacy } from './storage';
import { getStoredTheme } from './theme';

describe('compatibilità delle preferenze browser', () => {
  it('copia il vecchio tema senza eliminare il valore originale', () => {
    localStorage.setItem('mr-theme', 'dark');
    expect(getStoredTheme()).toBe('dark');
    expect(localStorage.getItem('jobward-theme')).toBe('dark');
    expect(localStorage.getItem('mr-theme')).toBe('dark');
  });
  it('la nuova preferenza ha precedenza su quella precedente', () => {
    localStorage.setItem('mr-theme', 'dark');
    localStorage.setItem('jobward-theme', 'light');
    expect(getStoredTheme()).toBe('light');
    expect(localStorage.getItem('mr-theme')).toBe('dark');
  });
  it('preserva lo stato della barra laterale', () => {
    localStorage.setItem('mr-sidebar-collapsed', '1');
    expect(readStorageWithLegacy('jobward-sidebar-collapsed', 'mr-sidebar-collapsed')).toBe('1');
    expect(localStorage.getItem('jobward-sidebar-collapsed')).toBe('1');
  });
});
