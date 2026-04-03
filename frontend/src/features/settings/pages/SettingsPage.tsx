import { useSearchParams } from 'react-router-dom';
import ProfileTab from '../components/ProfileTab';
import AccountTab from '../components/AccountTab';
import DangerTab from '../components/DangerTab';

type Tab = 'profile' | 'account' | 'danger';

const TABS: { id: Tab; label: string }[] = [
  { id: 'profile', label: 'Profile' },
  { id: 'account', label: 'Account' },
  { id: 'danger', label: 'Danger' },
];

export default function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get('tab') as Tab) ?? 'profile';

  const switchTab = (tab: Tab) => {
    setSearchParams({ tab });
  };

  return (
    <div className="min-h-screen bg-gray-100 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 pt-6 pb-0">
            <h1 className="text-xl font-semibold text-gray-900 mb-4">Settings</h1>
            <div className="flex gap-1 border-b border-gray-200">
              {TABS.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => switchTab(id)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                    activeTab === id
                      ? 'border-blue-500 text-gray-900'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-6">
            {activeTab === 'profile' && <ProfileTab />}
            {activeTab === 'account' && <AccountTab />}
            {activeTab === 'danger' && <DangerTab />}
          </div>
        </div>
      </div>
    </div>
  );
}
