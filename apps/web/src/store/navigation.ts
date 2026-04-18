import { create } from 'zustand';

export type Section = 'mail' | 'calendar' | 'contacts' | 'filters' | 'settings';

interface NavigationState {
  section: Section;
  setSection: (section: Section) => void;
}

export const useNavigationStore = create<NavigationState>((set) => ({
  section: 'mail',
  setSection: (section) => set({ section }),
}));
