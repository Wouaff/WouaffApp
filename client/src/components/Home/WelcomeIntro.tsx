import type { LucideIcon } from 'lucide-react';
import { ArrowRight, ExternalLink, Flag, GitBranch, MessageCircle, Rocket, Rss, Users, Wrench } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

const DISCORD_URL = 'https://dsc.gg/wouaff';
const GITHUB_URL = 'https://github.com/Wouaff/WouaffApp';

interface WelcomeIntroProps {
  onDone: () => void;
}

interface Step {
  title: string;
  body: string;
  icon: LucideIcon;
}

const STEPS: Step[] = [
  {
    icon: Rss,
    title: 'Bienvenue dans Wouaff',
    body: 'Le premier réseau social français et souverain. Conçu en France, hébergé en France, pour les Français.',
  },
  {
    icon: Flag,
    title: 'Un projet souverain',
    body: 'Vos données restent en France. Aucune donnée ne quitte le territoire, politique zéro log, respect total du RGPD et des lois européennes.',
  },
  {
    icon: Wrench,
    title: 'En cours de développement',
    body: 'Wouaff est encore en développement. Certaines fonctionnalités évoluent chaque jour, et chaque retour compte pour construire quelque chose de grand.',
  },
  {
    icon: Users,
    title: 'Rejoins l’aventure',
    body: 'Participe à la construction de Wouaff : rejoins la communauté sur Discord pour échanger, et aide-nous à améliorer le projet sur GitHub.',
  },
];

export default function WelcomeIntro({ onDone }: WelcomeIntroProps) {
  const [step, setStep] = useState(0);

  const finish = useCallback(() => {
    onDone();
  }, [onDone]);

  const next = useCallback(() => {
    setStep((s) => (s < STEPS.length ? s + 1 : s));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [finish]);

  const isIntro = step < STEPS.length;
  const current = isIntro ? STEPS[step] : null;
  const progress = Math.min(100, ((step + (isIntro ? 0 : 1)) / STEPS.length) * 100);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-[var(--bg-deep)]"
      role="dialog"
      aria-modal="true"
      aria-label="Bienvenue dans Wouaff"
    >
      {/* Fond dégradé + halos */}
      <div
        className="absolute inset-0 bg-gradient-to-br from-brand-dark/40 via-[var(--bg-deep)] to-[var(--bg-base)]"
        aria-hidden="true"
      />
      <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-brand/20 blur-[120px]" aria-hidden="true" />
      <div
        className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-brand-dark/30 blur-[120px]"
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-[520px] px-6 flex flex-col items-center text-center">
        {/* Logo */}
        <div className="animate-[scaleIn_0.5s_ease_both]">
          <img
            src="/assets/logo/logo.png"
            alt="Logo Wouaff"
            className="w-24 h-24 rounded-3xl shadow-[0_8px_40px_rgba(0,0,0,0.4)]"
          />
        </div>

        {isIntro ? (
          <div key={step} className="mt-8 animate-[slideUp_0.5s_ease_both]">
            <div className="text-5xl mb-4 animate-[pulse_2s_ease-in-out_infinite] text-brand">
              {current && <current.icon size={52} />}
            </div>
            <h1 className="text-3xl font-black text-[var(--text-primary)] m-0">{current!.title}</h1>
            <p className="mt-4 text-[15px] leading-relaxed text-[var(--text-secondary)] m-0">{current!.body}</p>
          </div>
        ) : (
          <div className="mt-8 w-full animate-[slideUp_0.5s_ease_both]">
            <h1 className="text-3xl font-black text-[var(--text-primary)] m-0">Prêt à commencer ?</h1>
            <p className="mt-3 text-[15px] leading-relaxed text-[var(--text-secondary)] m-0">
              Merci de faire partie de l’aventure Wouaff. Ensemble, construisons le premier réseau social véritablement
              français et souverain.
            </p>

            <div className="mt-8 flex flex-col gap-3">
              <a
                href={DISCORD_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2.5 rounded-full px-6 py-3.5 font-bold text-[15px] text-white bg-[#5865F2] hover:opacity-90 transition-opacity no-underline"
              >
                <MessageCircle size={20} />
                Rejoindre le Discord
              </a>
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2.5 rounded-full px-6 py-3.5 font-bold text-[15px] text-[var(--text-primary)] bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] transition-colors no-underline"
              >
                <GitBranch size={20} />
                Contribuer sur GitHub
                <ExternalLink size={14} className="opacity-60" />
              </a>
              <button
                type="button"
                onClick={finish}
                className="mt-2 flex items-center justify-center gap-2.5 rounded-full px-6 py-3.5 font-bold text-[15px] text-white bg-brand hover:opacity-90 transition-opacity border-none cursor-pointer"
              >
                <Rocket size={20} />
                Commencer l’aventure
              </button>
            </div>
          </div>
        )}

        {/* Contrôles */}
        <div className="mt-10 w-full flex flex-col items-center gap-4">
          <div className="w-full max-w-[280px] h-1.5 rounded-full bg-[var(--bg-input)] overflow-hidden">
            <div
              className="h-full rounded-full bg-brand transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          {isIntro ? (
            <button
              type="button"
              onClick={next}
              className="flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-bold text-white bg-brand hover:opacity-90 transition-opacity border-none cursor-pointer"
            >
              Suivant
              <ArrowRight size={16} />
            </button>
          ) : null}
          <button
            type="button"
            onClick={finish}
            className="text-[12px] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors bg-transparent border-none cursor-pointer"
          >
            Passer (Échap)
          </button>
        </div>
      </div>
    </div>
  );
}
