import { useSearchParams } from 'react-router-dom';
import { User, KeyRound, ShieldAlert } from 'lucide-react';
import ProfileTab from '../components/ProfileTab';
import AccountTab from '../components/AccountTab';
import DangerTab from '../components/DangerTab';

type Tab = 'profile' | 'account' | 'danger';

interface NavItem {
  id: Tab;
  label: string;
  icon: React.ElementType;
  danger?: boolean;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const NAV: NavSection[] = [
  {
    label: 'User Settings',
    items: [
      { id: 'profile', label: 'My Profile', icon: User },
      { id: 'account', label: 'Account', icon: KeyRound },
    ],
  },
  {
    label: 'Danger Zone',
    items: [
      { id: 'danger', label: 'Delete Account', icon: ShieldAlert, danger: true },
    ],
  },
];

const TITLES: Record<Tab, string> = {
  profile: 'My Profile',
  account: 'Account',
  danger: 'Delete Account',
};

export default function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get('tab') as Tab) ?? 'profile';

  return (
    <div className="flex h-full">
      {/* Settings sidebar */}
      <aside className="w-56 shrink-0 py-8 px-3 border-r border-warm-gray/60">
        <div className="space-y-6">
          {NAV.map((section) => (
            <div key={section.label}>
              <p className="px-2.5 mb-1.5 text-[10px] font-bold uppercase tracking-widest text-espresso/40 select-none">
                {section.label}
              </p>
              <div className="space-y-0.5">
                {section.items.map(({ id, label, icon: Icon, danger }) => (
                  <button
                    key={id}
                    onClick={() => setSearchParams({ tab: id })}
                    className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-md text-sm font-medium transition-colors text-left ${
                      activeTab === id
                        ? 'bg-espresso/10 text-espresso'
                        : danger
                        ? 'text-red-500/80 hover:bg-red-50 hover:text-red-600'
                        : 'text-espresso/55 hover:bg-espresso/5 hover:text-espresso'
                    }`}
                  >
                    <Icon size={16} className="shrink-0" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl px-10 py-10">
          <h1 className="text-xl font-semibold text-espresso mb-7 pb-5 border-b border-warm-gray">
            {TITLES[activeTab]}
          </h1>
          {activeTab === 'profile' && <ProfileTab />}
          {activeTab === 'account' && <AccountTab />}
          {activeTab === 'danger' && <DangerTab />}
        </div>
      </div>
    </div>
  );
}
