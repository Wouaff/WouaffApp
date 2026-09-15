import { ArrowLeft, Palette, Shield, User } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import ComposeModal from '../components/ComposeModal';
import RightSidebar from '../components/RightSidebar';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../hooks/useAuth';
import { api } from '../services/api';

const SETTINGS_TABS = [
  {
    id: 'account',
    label: 'Your account',
    icon: User,
    description: 'See account information like your username and date of birth.',
  },
  { id: 'profile', label: 'Profile', icon: User, description: 'Manage your public profile, photo, ...' },
  { id: 'security', label: 'Security', icon: Shield, description: 'Manage two-factor authentication a...' },
  { id: 'display', label: 'Display', icon: Palette, description: 'Manage your theme and appearance.' },
] as const;

export default function SettingsPage() {
  const { user, refresh } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('account');
  const [showCompose, setShowCompose] = useState(false);

  return (
    <div className="flex min-h-screen justify-center">
      <Sidebar onCompose={() => setShowCompose(true)} />

      <main className="flex-1 min-w-0 border-r border-[var(--border-color)] max-w-[600px] bg-[var(--bg-secondary)]">
        <div className="sticky top-0 z-40 bg-[var(--bg-secondary)]/80 backdrop-blur-md border-b border-[var(--border-color)]">
          <div className="flex items-center gap-6 px-4 py-3">
            <Link to="/" className="p-2 rounded-full hover:bg-[var(--bg-tertiary)] transition-colors">
              <ArrowLeft className="w-5 h-5 text-[var(--text-primary)]" />
            </Link>
            <h1 className="font-bold text-xl">Settings</h1>
          </div>
        </div>

        <div className="flex">
          <div className="w-[200px] xl:w-[250px] flex-shrink-0 border-r border-[var(--border-color)] py-2">
            {SETTINGS_TABS.map(({ id, label, icon: Icon, description }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`w-full text-left px-4 py-4 transition-colors ${
                  activeTab === id
                    ? 'bg-[var(--accent)]/10 border-r-2 border-[var(--accent)]'
                    : 'hover:bg-[var(--bg-tertiary)]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-5 h-5 text-[var(--text-secondary)]" />
                  <div>
                    <div
                      className={`font-bold text-[15px] ${activeTab === id ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'}`}
                    >
                      {label}
                    </div>
                    <div className="text-xs text-[var(--text-secondary)] hidden xl:block">{description}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="flex-1 min-w-0 p-6">
            {activeTab === 'account' && <AccountTab />}
            {activeTab === 'profile' && <ProfileTab user={user} refresh={refresh} />}
            {activeTab === 'security' && <SecurityTab />}
            {activeTab === 'display' && <DisplayTab />}
          </div>
        </div>
      </main>

      <RightSidebar />

      {showCompose && <ComposeModal onClose={() => setShowCompose(false)} onPosted={() => {}} />}
    </div>
  );
}

function AccountTab() {
  const { user } = useAuth();
  return (
    <div>
      <h2 className="font-extrabold text-xl mb-2">Account information</h2>
      <p className="text-sm text-[var(--text-secondary)] mb-6">
        See your account information like your username and date of birth.
      </p>

      <div className="border border-[var(--border-color)] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border-color)]">
          <div className="text-sm text-[var(--text-secondary)]">USERNAME</div>
          <div className="font-bold text-[var(--text-primary)] mt-1">@{user?.pseudo}</div>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            Your username was set when you created your account and cannot be changed here.
          </p>
        </div>
        <div className="px-4 py-3">
          <div className="text-sm text-[var(--text-secondary)]">EMAIL</div>
          <div className="font-bold text-[var(--text-primary)] mt-1">{user?.email}</div>
        </div>
      </div>
    </div>
  );
}

function ProfileTab({ user, refresh }: { user: any; refresh: () => Promise<unknown> }) {
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [location, setLocation] = useState(user?.location || '');
  const [website, setWebsite] = useState(user?.website || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/profiles/me', { displayName, bio, location, website });
      await refresh();
    } catch {}
    setSaving(false);
  };

  return (
    <div>
      <div className="h-[160px] bg-[var(--bg-tertiary)] rounded-xl relative overflow-hidden">
        {user?.banner && <img src={user.banner} alt="" className="w-full h-full object-cover" />}
        <button className="absolute bottom-3 right-3 p-2 bg-[var(--bg-primary)]/80 rounded-full text-[var(--text-primary)]">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 3a2.828 2.828 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
          </svg>
        </button>
      </div>

      {/* L'avatar chevauche la moitié de la bannière, le nom reste sous l'avatar
          (sinon l'avatar posé à -64px recouvre la bannière et le nom). */}
      <div className="relative z-10 w-20 h-20 -mt-10 ml-4 rounded-full bg-[var(--bg-tertiary)] ring-4 ring-[var(--bg-secondary)] flex items-center justify-center text-2xl font-bold overflow-hidden">
        {user?.avatar ? (
          <img src={user.avatar} alt="" className="w-full h-full object-cover" />
        ) : (
          user?.pseudo?.[0]?.toUpperCase() || '?'
        )}
      </div>

      <div className="mt-3 mb-6">
        <div className="font-bold truncate">{user?.displayName || user?.pseudo}</div>
        <div className="text-sm text-[var(--text-secondary)] truncate">@{user?.pseudo}</div>
      </div>

      <h3 className="font-extrabold text-xl mb-2">Edit profile</h3>
      <p className="text-sm text-[var(--text-secondary)] mb-4">
        Update your public profile. To change your username or email, go to Your account.
      </p>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Display name</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full bg-transparent border border-[var(--border-color)] rounded-lg px-4 py-3 text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none transition-colors"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={160}
            className="w-full bg-transparent border border-[var(--border-color)] rounded-lg px-4 py-3 text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none transition-colors resize-none min-h-[100px]"
          />
          <div className="text-right text-sm text-[var(--text-secondary)]">{bio.length}/160</div>
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Location</label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full bg-transparent border border-[var(--border-color)] rounded-lg px-4 py-3 text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none transition-colors"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Website</label>
          <input
            type="url"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            className="w-full bg-transparent border border-[var(--border-color)] rounded-lg px-4 py-3 text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none transition-colors"
          />
        </div>
      </div>

      <div className="flex justify-end mt-6">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white font-bold rounded-full px-8 py-2.5 transition-colors"
        >
          {saving ? '...' : 'Save'}
        </button>
      </div>
    </div>
  );
}

function SecurityTab() {
  return (
    <div>
      <h2 className="font-extrabold text-xl mb-2">Two-factor authentication</h2>
      <p className="text-sm text-[var(--text-secondary)] mb-6">
        Help protect your account from unauthorized access by requiring a second authentication method in addition to
        your password.
      </p>

      <div className="border border-[var(--border-color)] rounded-xl overflow-hidden">
        <div className="px-4 py-4 flex items-center justify-between border-b border-[var(--border-color)]">
          <div>
            <div className="font-bold text-[var(--text-primary)]">AUTHENTICATION APP</div>
            <div className="text-sm text-[var(--text-secondary)]">Off</div>
          </div>
          <button className="px-4 py-1.5 rounded-full border border-[var(--border-color)] text-[var(--text-primary)] font-bold text-sm hover:bg-[var(--bg-tertiary)] transition-colors">
            Set up
          </button>
        </div>
        <div className="px-4 py-4 flex items-center justify-between">
          <div>
            <div className="font-bold text-[var(--text-primary)]">TEXT MESSAGE</div>
            <div className="text-sm text-[var(--text-secondary)]">Off</div>
          </div>
          <button className="px-4 py-1.5 rounded-full border border-[var(--border-color)] text-[var(--text-primary)] font-bold text-sm hover:bg-[var(--bg-tertiary)] transition-colors">
            Set up
          </button>
        </div>
      </div>
    </div>
  );
}

function DisplayTab() {
  return (
    <div>
      <h2 className="font-extrabold text-xl mb-2">Display</h2>
      <p className="text-sm text-[var(--text-secondary)] mb-6">Manage your theme and appearance.</p>

      <div className="border border-[var(--border-color)] rounded-xl p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-[var(--text-secondary)]">APPEARANCE</span>
          <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-[var(--border-color)]">
            <svg
              className="w-4 h-4 text-[var(--text-secondary)]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="5" />
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
            </svg>
            <span className="text-sm text-[var(--text-primary)]">Dark</span>
          </div>
        </div>
      </div>
    </div>
  );
}
