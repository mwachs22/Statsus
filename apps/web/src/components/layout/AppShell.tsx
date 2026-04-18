import { useState } from 'react';
import { useNavigationStore, type Section } from '../../store/navigation';
import { useMailStore } from '../../store/mail';
import { useAccounts } from '../../hooks/useAccounts';
import { useShortcuts } from '../../hooks/useShortcuts';
import { CommandPalette } from '../search/CommandPalette';
import { AccountSwitcher } from './AccountSwitcher';
import { ShortcutsModal } from '../shortcuts/ShortcutsModal';
import { TodoOverlay } from '../todos/TodoOverlay';
import { MailPage } from '../../pages/MailPage';
import { CalendarPage } from '../../pages/CalendarPage';
import { ContactsPage } from '../../pages/ContactsPage';
import { FiltersPage } from '../../pages/FiltersPage';
import { SettingsPage } from '../../pages/SettingsPage';

function MailIcon({ active }: { active: boolean }) {
  return (
    <svg className={`w-5 h-5 ${active ? 'text-blue-600' : 'text-slate-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 2.2 : 1.8}
        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}

function CalendarIcon({ active }: { active: boolean }) {
  return (
    <svg className={`w-5 h-5 ${active ? 'text-blue-600' : 'text-slate-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 2.2 : 1.8}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function ContactsIcon({ active }: { active: boolean }) {
  return (
    <svg className={`w-5 h-5 ${active ? 'text-blue-600' : 'text-slate-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 2.2 : 1.8}
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function FiltersIcon({ active }: { active: boolean }) {
  return (
    <svg className={`w-5 h-5 ${active ? 'text-blue-600' : 'text-slate-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 2.2 : 1.8}
        d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
    </svg>
  );
}

function SettingsIcon({ active }: { active: boolean }) {
  return (
    <svg className={`w-5 h-5 ${active ? 'text-blue-600' : 'text-slate-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 2.2 : 1.8}
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 2.2 : 1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

const NAV_ITEMS: { id: Section; label: string }[] = [
  { id: 'mail',      label: 'Mail' },
  { id: 'calendar',  label: 'Calendar' },
  { id: 'contacts',  label: 'Contacts' },
  { id: 'filters',   label: 'Filters' },
  { id: 'settings',  label: 'Settings' },
];

function NavButton({ id, active, onClick }: { id: Section; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={id.charAt(0).toUpperCase() + id.slice(1)}
      className={`w-10 h-10 flex items-center justify-center rounded-xl transition
        ${active ? 'bg-blue-50' : 'hover:bg-slate-100'}`}
    >
      {id === 'mail'      && <MailIcon active={active} />}
      {id === 'calendar'  && <CalendarIcon active={active} />}
      {id === 'contacts'  && <ContactsIcon active={active} />}
      {id === 'filters'   && <FiltersIcon active={active} />}
      {id === 'settings'  && <SettingsIcon active={active} />}
    </button>
  );
}

export function AppShell() {
  const { section, setSection } = useNavigationStore();
  const { selectedAccountId, setSelectedThread, openCompose } = useMailStore();
  useAccounts();

  const [paletteOpen, setPaletteOpen]     = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [todosOpen, setTodosOpen]         = useState(false);

  useShortcuts({
    compose:       () => openCompose(),
    search:        () => setPaletteOpen(true),
    shortcuts:     () => setShortcutsOpen((v) => !v),
    toggle_todos:  () => setTodosOpen((v) => !v),
    go_mail:       () => setSection('mail'),
    go_calendar:   () => setSection('calendar'),
    go_contacts:   () => setSection('contacts'),
    go_filters:    () => setSection('filters'),
    go_settings:   () => setSection('settings'),
  });

  return (
    <div className="h-screen flex overflow-hidden bg-white">
      {/* NavRail */}
      <nav className="w-14 flex-shrink-0 flex flex-col items-center py-3 gap-1 border-r border-slate-200 bg-white">
        <div className="w-10 h-10 flex items-center justify-center mb-1">
          <span className="text-[10px] font-black tracking-tight text-slate-800 leading-none text-center">
            STAT<br />SUS
          </span>
        </div>

        <AccountSwitcher />
        <div className="w-8 border-t border-slate-200 my-1" />

        {NAV_ITEMS.map((item) => (
          <NavButton
            key={item.id}
            id={item.id}
            active={section === item.id}
            onClick={() => setSection(item.id)}
          />
        ))}

        <div className="flex-1" />

        <button
          onClick={() => setPaletteOpen(true)}
          title="Search (⌘K)"
          className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-slate-100 transition mb-1"
        >
          <SearchIcon />
        </button>
      </nav>

      {/* Section content */}
      <div className="flex-1 overflow-hidden">
        {section === 'mail'      && <MailPage />}
        {section === 'calendar'  && <CalendarPage accountId={selectedAccountId} />}
        {section === 'contacts'  && <ContactsPage accountId={selectedAccountId} />}
        {section === 'filters'   && <FiltersPage />}
        {section === 'settings'  && <SettingsPage />}
      </div>

      {/* Overlays */}
      {paletteOpen && (
        <CommandPalette
          onClose={() => setPaletteOpen(false)}
          onSelectThread={(threadId) => { setSelectedThread(threadId); setSection('mail'); }}
        />
      )}
      {shortcutsOpen && (
        <ShortcutsModal onClose={() => setShortcutsOpen(false)} />
      )}
      {todosOpen && (
        <TodoOverlay onClose={() => setTodosOpen(false)} />
      )}
    </div>
  );
}
