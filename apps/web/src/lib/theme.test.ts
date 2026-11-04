import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { getStoredTheme, useTheme } from './theme';

describe('tema', () => {
  it('usa "system" quando non c’è nulla di salvato o il valore è invalido', () => {
    expect(getStoredTheme()).toBe('system');
    window.localStorage.setItem('mr-theme', 'neon');
    expect(getStoredTheme()).toBe('system');
  });

  it('applica la classe dark, la salva e la rilegge', () => {
    const { result } = renderHook(() => useTheme());
    act(() => result.current.setPreference('dark'));
    expect(document.documentElement).toHaveClass('dark');
    expect(window.localStorage.getItem('mr-theme')).toBe('dark');
    expect(getStoredTheme()).toBe('dark');

    act(() => result.current.setPreference('light'));
    expect(document.documentElement).not.toHaveClass('dark');
  });

  it('segue il sistema operativo quando la preferenza è "system"', () => {
    window.matchMedia = ((q: string) => ({
      matches: true,
      media: q,
      addEventListener() {},
      removeEventListener() {},
    })) as never;
    const { result } = renderHook(() => useTheme());
    act(() => result.current.setPreference('system'));
    expect(document.documentElement).toHaveClass('dark');
  });

  it('non si rompe se localStorage lancia eccezioni', () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error('bloccato');
    };
    try {
      const { result } = renderHook(() => useTheme());
      expect(() => act(() => result.current.setPreference('dark'))).not.toThrow();
      expect(document.documentElement).toHaveClass('dark');
    } finally {
      Storage.prototype.setItem = original;
    }
  });
});
