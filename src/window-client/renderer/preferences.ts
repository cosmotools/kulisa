// Core-owned preferences consumed by each UI; no shell navigation or task state (../README.md).
import { createStore, useStore } from 'zustand';
import type { LanguageInfo, Shortcut } from '../../shared/types';
import { setTheme } from '../../appearance/renderer';
const query = new URLSearchParams(location.search);
interface Preferences { zoom: number; theme: string; language: LanguageInfo | null; stageFollow: boolean; keys: Shortcut[] }
export const preferences = createStore<Preferences>()(() => ({
  keys: JSON.parse(query.get('keys') || '[]'),
  zoom: 1, theme: query.get('theme') || 'dark', language: null, stageFollow: query.get('stageFollow') === 'true',
}));
const set = preferences.setState;
export const usePreferences = <T>(select: (s: Preferences) => T) => useStore(preferences, select);
kulisa.on('zoom:state', (zoom) => set({ zoom }));
void kulisa.invoke('zoom:get').then((zoom) => set({ zoom }));
kulisa.on('theme:state', (theme) => { set({ theme }); setTheme(theme); });
kulisa.on('stage:follow:state', (stageFollow) => set({ stageFollow }));
kulisa.on('language:state', (language) => set({ language }));
void kulisa.invoke('language:get').then((language) => set({ language }));
kulisa.on('keys:state', (keys) => set({ keys }));
export const useShortcuts = () => usePreferences((s) => s.keys);
export const keyText = (id: string): string => preferences.getState().keys.find((s) => s.id === id)?.keys[0] || '';
export const withKeys = (title: string, id: string): string => (keyText(id) ? `${title} (${keyText(id)})` : title);
