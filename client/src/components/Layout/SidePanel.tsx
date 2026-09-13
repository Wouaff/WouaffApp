import { Lock, Search, Server, ShieldCheck, TrendingUp } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useI18n } from '../../i18n/context';
import { profiles, trends as trendsAPI } from '../../services/api';
import type { TrendItem } from '../../types';

interface Suggestion {
  uid: string;
  pseudo: string;
  avatar: string | null;
  bio: string | null;
  wouaffId: string | null;
}

function toHandle(s: Suggestion): string {
  const id = s.wouaffId?.trim();
  if (id) return id.startsWith('@') ? id : `@${id}`;
  return `@${s.pseudo?.toLowerCase().replace(/\s+/g, '') || 'utilisateur'}`;
}

export default function SidePanel() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [q, setQ] = useState('');
  const [following, setFollowing] = useState<Record<string, boolean>>({});
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [trendList, setTrendList] = useState<TrendItem[]>([]);

  const loadSuggestions = useCallback(async () => {
    try {
      const res = await profiles.suggestions(3);
      setSuggestions(res.results);
    } catch (e) {
      console.error(e);
      setSuggestions([]);
    }
  }, []);

  const loadTrends = useCallback(async () => {
    try {
      setTrendList(await trendsAPI.list(8));
    } catch (e) {
      console.error(e);
      setTrendList([]);
    }
  }, []);

  useEffect(() => {
    loadSuggestions();
  }, [loadSuggestions]);

  useEffect(() => {
    loadTrends();
    const interval = setInterval(loadTrends, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadTrends]);

  const toggleFollow = async (s: Suggestion) => {
    const isFollowing = !!following[s.uid];
    setFollowing((prev) => ({ ...prev, [s.uid]: !isFollowing }));
    try {
      if (isFollowing) {
        await profiles.unfollow(s.uid);
      } else {
        await profiles.follow(s.uid);
      }
    } catch (e) {
      console.error(e);
      setFollowing((prev) => ({ ...prev, [s.uid]: isFollowing }));
    }
  };

  return (
    <aside className="hidden lg:flex flex-col flex-shrink-0 h-full w-[304px] border-r border-[var(--border)] bg-[var(--bg-base)]">
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="relative mb-4">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && q.trim()) {
                navigate(`/search?q=${encodeURIComponent(q.trim())}`);
              }
            }}
            placeholder={t('Rechercher sur Wouaff')}
            aria-label={t('Rechercher sur Wouaff')}
            className="w-full bg-[var(--bg-input)] border border-transparent focus:border-[var(--brand)] outline-none rounded-full py-2.5 pl-11 pr-4 text-[15px] text-[var(--text-primary)] placeholder-[var(--text-muted)] font-sans transition-colors"
          />
        </div>

        <div className="side-card rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 pt-4 pb-2">
            <TrendingUp size={17} className="text-brand" />
            <h2 className="text-base font-extrabold text-[var(--text-primary)] m-0">{t('Tendances en France')}</h2>
          </div>
          {trendList.length === 0 ? (
            <div className="px-4 py-4 text-[13px] text-[var(--text-muted)]">{t('Aucune tendance pour le moment')}</div>
          ) : (
            trendList.map((trend, i) => (
              <Link
                key={trend.tag}
                to={`/hashtag/${encodeURIComponent(trend.tag)}`}
                className="block w-full text-left px-4 py-2.5 border-none bg-transparent no-underline cursor-pointer hover:bg-[var(--bg-hover)] transition-colors"
              >
                <span className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  {i + 1} · {trend.category}
                </span>
                <span className="block text-[15px] font-bold text-[var(--text-primary)]">#{trend.tag}</span>
                <span className="block text-[12px] text-[var(--text-muted)]">
                  {t('{n} publications', { n: trend.posts })}
                </span>
              </Link>
            ))
          )}
        </div>

        <div className="side-card mt-4 rounded-2xl overflow-hidden">
          <h2 className="text-base font-extrabold text-[var(--text-primary)] m-0 px-4 pt-4 pb-2">
            {t('À qui suivre')}
          </h2>
          {suggestions.length === 0 ? (
            <div className="px-4 py-4 text-[13px] text-[var(--text-muted)]">
              {t('Aucune suggestion pour le moment')}
            </div>
          ) : (
            suggestions.map((s) => {
              const isFollowing = following[s.uid];
              const initial = (s.pseudo || '?')[0]?.toUpperCase() || '?';
              return (
                <div
                  key={s.uid}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-hover)] transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center text-[var(--brand-ink)] font-extrabold text-sm overflow-hidden flex-shrink-0">
                    {s.avatar ? (
                      <img
                        src={s.avatar}
                        alt={t('Avatar de {name}', { name: s.pseudo || t("l'utilisateur") })}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <span>{initial}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-bold text-[var(--text-primary)] truncate">{s.pseudo}</div>
                    <div className="text-[12px] text-[var(--text-muted)] truncate">{toHandle(s)}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleFollow(s)}
                    className={`rounded-full px-3.5 py-1.5 text-[13px] font-bold border cursor-pointer transition-colors ${
                      isFollowing
                        ? 'bg-transparent text-[var(--text-primary)] border-[var(--border)] hover:border-[var(--text-muted)]'
                        : 'bg-[var(--brand)] text-[var(--brand-ink)] border-transparent hover:opacity-90'
                    }`}
                  >
                    {isFollowing ? t('Suivi') : t('Suivre')}
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="side-card mt-4 rounded-2xl p-4">
          <h2 className="text-base font-extrabold text-[var(--text-primary)] m-0 mb-3">
            {t('La souveraineté Wouaff')}
          </h2>
          <ul className="list-none p-0 m-0 flex flex-col gap-3">
            <li className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[var(--brand-soft)] flex items-center justify-center flex-shrink-0">
                <Server size={17} className="text-brand" />
              </div>
              <div>
                <div className="text-sm font-bold text-[var(--text-primary)]">{t('Hébergé en France')}</div>
                <div className="text-xs text-[var(--text-muted)]">{t("Aucune donnée à l'étranger")}</div>
              </div>
            </li>
            <li className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[var(--brand-soft)] flex items-center justify-center flex-shrink-0">
                <ShieldCheck size={17} className="text-brand" />
              </div>
              <div>
                <div className="text-sm font-bold text-[var(--text-primary)]">{t('RGPD & lois européennes')}</div>
                <div className="text-xs text-[var(--text-muted)]">{t('Vos données sont protégées')}</div>
              </div>
            </li>
            <li className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[var(--brand-soft)] flex items-center justify-center flex-shrink-0">
                <Lock size={17} className="text-brand" />
              </div>
              <div>
                <div className="text-sm font-bold text-[var(--text-primary)]">{t('Politique zéro log')}</div>
                <div className="text-xs text-[var(--text-muted)]">{t('Nous ne traçons pas vos activités')}</div>
              </div>
            </li>
          </ul>
        </div>

        <nav
          className="mt-4 px-1 flex flex-wrap gap-x-3 gap-y-1.5 text-[13px] text-[var(--text-muted)]"
          aria-label="Liens Wouaff"
        >
          <Link
            to="/mentions-legales"
            className="no-underline text-inherit hover:underline hover:text-[var(--text-primary)] transition-colors"
          >
            {t('Mentions légales')}
          </Link>
          <Link
            to="/contact"
            className="no-underline text-inherit hover:underline hover:text-[var(--text-primary)] transition-colors"
          >
            {t('Contact')}
          </Link>
          <span className="cursor-default">{t('Wouaff · Fait en France 🇫🇷')}</span>
        </nav>
      </div>
    </aside>
  );
}
