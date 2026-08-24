import {
  ArrowRight,
  Ban,
  Check,
  ChevronDown,
  Lock,
  MapPin,
  Menu,
  MessageCircle,
  MessageSquare,
  PenSquare,
  RefreshCcw,
  Rss,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DmcaBadge from '../components/Common/DmcaBadge';

const DISCORD_URL = 'https://dsc.gg/wouaff';
const GITHUB_URL = 'https://github.com/Wouaff/WouaffApp';

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function GithubIcon({ size = 17 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path d="M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58v-2.03c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.74.08-.73.08-.73 1.21.09 1.85 1.24 1.85 1.24 1.07 1.83 2.81 1.3 3.5 1 .11-.78.42-1.31.76-1.61-2.66-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.11-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6.01 0c2.29-1.55 3.3-1.23 3.3-1.23.65 1.66.24 2.88.12 3.18.77.84 1.23 1.91 1.23 3.22 0 4.61-2.81 5.63-5.49 5.92.43.37.82 1.11.82 2.24v3.32c0 .32.21.7.82.58A12.02 12.02 0 0 0 24 12.5C24 5.87 18.63.5 12 .5z" />
    </svg>
  );
}

const NAV_LINKS = [
  { label: 'Produit', id: 'produit' },
  { label: 'Pourquoi Wouaff', id: 'pourquoi' },
  { label: 'Sécurité', id: 'securite' },
  { label: 'Open', id: 'open' },
  { label: 'Discord', href: DISCORD_URL },
] as const;

const PROOF = [
  { icon: Rss, title: 'Fil sans pub', desc: 'ce que tu vois, c’est ce que tu suis' },
  { icon: Lock, title: 'MP chiffrés de bout en bout', desc: 'même nous on lit pas' },
  { icon: MapPin, title: 'Données en France', desc: 'pas chez un cloud US' },
  { icon: Ban, title: 'Zéro revente', desc: 'le produit, c’est l’app, pas toi' },
];

const IS_IT = [
  'Un fil d’actu. Posts, réponses, médias, vidéos.',
  'Des communautés, pour parler d’un truc sans le crier à toute la France.',
  'Des MP vraiment privés.',
  'Des tendances France, pas un For You californien.',
  'Un compte, un pseudo, et c’est tout.',
];

const IS_NOT = [
  'Discord avec un autre nom.',
  'Un Twitter « souverain » en communiqué de presse.',
  'Un endroit pour te faire découvrir par 80 millions d’inconnus dès J1.',
  'De la pub, du Premium, du bleu payant.',
];

const PRODUCT_BLOCKS = [
  {
    icon: Rss,
    id: 'fil',
    h3: 'Tu suis des gens. Tu vois leurs posts. Point.',
    body: 'Chronologie de ce que tu as choisi. Pas de pub entre deux tweets. Pas de « tu pourrais aimer » qui te sort une polémique pour te garder en ligne. Tu scrolles. Tu t’arrêtes. Tu sors. C’est toi qui décides.',
    fine: 'L’algo, c’est tes abonnements. Pas notre compte en banque.',
  },
  {
    icon: PenSquare,
    id: 'posts',
    h3: 'Texte, image, vidéo. La réponse en dessous, pas dans une cave.',
    body: 'Tu postes. Les gens répondent. Tu peux citer, republier, mettre en avant un truc dans une communauté. Les vidéos sont dans le fil, pas exilées dans une app à part.',
    fine: 'Le geste que t’as déjà. Sans le cirque autour.',
  },
  {
    icon: Users,
    id: 'communautes',
    h3: 'Un sujet. Les gens qui en parlent. Pas un haut-parleur mondial.',
    body: 'Foot, code, musique, ta ville, ton école. Tu rejoins une communauté, tu postes là, ça reste là. Moins de ratio random. Plus de convos qui tiennent.',
    fine: 'Le public, quand tu le veux. Le cercle, quand tu le veux.',
  },
  {
    icon: MessageSquare,
    id: 'mp',
    h3: 'Les DMs, chiffrés. Vraiment.',
    body: 'Messages privés de bout en bout (ECDH + AES-256-GCM). Pas de scan pub. Pas de « on améliore le modèle avec tes convos ». Un DM, c’est un DM.',
    fine: 'Sur les autres réseaux, tes MP sont un produit. Ici, non.',
  },
];

const WHY_BETTER = [
  'Pas de pub. Nulle part dans le fil.',
  'Pas de compte payant pour être visible.',
  'Pas de tracking pour te revendre.',
  'MP chiffrés, pas « privés » en petit et lus en gros.',
  'Hébergé en France, RGPD pour de vrai, mentions légales en bas, pas dans un PDF de 40 pages.',
  'Tendances France, communauté France, langue France. T’es pas un fuseau de plus sur un datacenter US.',
  'On a 19 ans, on construit ici, le changelog est public. Pas un type qui rachète le réseau un mardi.',
];

const STEPS = [
  { n: '1', title: 'Crée ton compte', desc: 'un pseudo, un mail, c’est plié' },
  {
    n: '2',
    title: 'Suis 10 comptes',
    desc: 'potes, créateurs, communautés. Ton fil démarre là',
  },
  { n: '3', title: 'Poste', desc: 'texte, image, vidéo. Ou réponds. Ou DM.' },
];

const WHO = [
  'T’ouvres X et tu fermes 30 secondes plus tard.',
  'T’en as marre de payer pour exister, ou de scroller de la pub.',
  'Tu veux un fil en français, avec des gens d’ici.',
  'Tu veux que tes DM restent tes DM.',
  'T’as 16 à 30 ans, t’as un avis, t’as pas besoin d’un discours DSI pour poster.',
];

const WHO_NOT = ['monter une agence d’influence', '« remplacer les GAFAM »', 'scroller des inconnus 4h par jour'];

const SECURITY = [
  {
    icon: MapPin,
    title: 'Hébergement',
    body: 'Les données de comptes, posts, médias : en France. Si on utilise un CDN, on le dit. Pas de « 100 % français » en petit et un cloud US en gros.',
  },
  {
    icon: Lock,
    title: 'Chiffrement',
    body: 'Tes MP sont chiffrés sur ton appareil. Les clés, c’est chez toi. Les posts publics, eux, sont publics : c’est le principe d’un fil.',
  },
  {
    icon: Ban,
    title: 'Zéro pub',
    body: 'Pas aujourd’hui, pas demain en cachette. Si un jour un truc est payant (custom, stockage, boost de communauté), ce sera écrit, et ça ne sera pas tes données.',
  },
  {
    icon: ShieldCheck,
    title: 'Pas de revente',
    body: 'On ne vend pas tes posts, tes graphiques d’abonnements, tes DM, tes clics.',
  },
  {
    icon: Users,
    title: 'RGPD',
    body: 'Droit d’accès, de suppression, d’export. Confidentialité et mentions légales en bas de page.',
  },
  {
    icon: RefreshCcw,
    title: 'Ce qu’on ne promet pas',
    body: 'D’être « le premier », d’être parfait, d’avoir déjà le pays entier. On a 19 ans. On construit. Le changelog est public.',
  },
];

const FAQ = [
  {
    q: 'C’est un Twitter français ?',
    a: 'C’est le même geste : fil, posts, réponses, vidéos, communautés, DM. C’est mieux sur ce qui compte pour nous : pas de pub, pas de boost payant, MP chiffrés, données en France. C’est pas un clone pixel-perfect et c’est pas le but.',
  },
  {
    q: 'C’est un Discord ?',
    a: 'Non. Pas de serveurs, pas de salons vocaux. C’est un réseau social. Tes potes, tu les suis, tu leur parles en DM, tu les retrouves dans une communauté.',
  },
  {
    q: 'Mes potes doivent tous s’inscrire ?',
    a: 'Pour voir tes posts privés / te répondre depuis Wouaff, oui. Pour un post public, le web suffit. Invite-les. Un réseau, ça commence à 10 personnes qui se parlent, pas à 10 millions de lurkers.',
  },
  {
    q: 'C’est vraiment chiffré ?',
    a: 'Les MP, oui, de bout en bout. Les posts, les réponses, les communautés : c’est du public (ou du semi-public). On le stocke pour que les gens le voient. On ne le revend pas.',
  },
  {
    q: 'Il y a un algo ?',
    a: 'Tes abonnements, d’abord. Des tendances France, des suggestions de comptes, pas un For You calibré pour te rendre dingue, pas de pub, pas de visibilité à vendre.',
  },
  {
    q: 'C’est vraiment hébergé en France ?',
    a: 'Les données applicatives, oui. Le détail (hébergeur, CDN, sous-traitants) est dans la politique de confidentialité. Si ça bouge, on le dit.',
  },
  {
    q: 'C’est gratuit ?',
    a: 'Oui. Pas de carte, pas d’essai, pas de bleu à 12 €. Si un jour il y a une offre payante, ce sera un plus, jamais un péage pour poster.',
  },
  {
    q: 'Le nom… c’est pour les chiens ?',
    a: 'Non. Wouaff, c’est le cri. Le loup, c’est la meute. Ton labrador a déjà Instagram.',
  },
  {
    q: 'Vous êtes open source ?',
    a: 'Le code est sur GitHub. La licence, c’est la nôtre : le code est visible, mais pas libre au sens classique. On ne joue pas sur les mots.',
  },
  {
    q: 'Il y a déjà du monde ?',
    a: 'On démarre. C’est le moment où un post se voit encore. Si tu viens avec tes potes, ton fil est vivant dès ce soir.',
  },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const goRegister = () => navigate('/auth?mode=register');
  const goLogin = () => navigate('/auth');

  const CTA = (
    <button
      type="button"
      onClick={goRegister}
      className="inline-flex items-center gap-2 rounded-full bg-brand-dark px-6 py-3 text-[15px] font-black text-white border-none cursor-pointer font-sans hover:bg-brand transition-colors"
    >
      Rejoindre Wouaff
      <ArrowRight size={16} />
    </button>
  );

  return (
    <div className="h-full overflow-y-auto bg-[var(--bg-deep)] text-[var(--text-primary)]">
      {/* ── Nav ── */}
      <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--bg-deep)]/85 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <button
            type="button"
            onClick={() => scrollToId('top')}
            className="flex items-center gap-2.5 border-none bg-transparent p-0 cursor-pointer"
          >
            <img src="/assets/logo/logo.png" alt="Logo Wouaff" className="h-9 w-9 rounded-xl" />
            <span className="text-xl font-black tracking-tight text-white">Wouaff</span>
          </button>

          <nav className="hidden lg:flex items-center gap-1">
            {NAV_LINKS.map((l) =>
              'href' in l ? (
                <a
                  key={l.label}
                  href={l.href}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full px-4 py-2 text-[14px] font-bold text-[var(--text-muted)] no-underline hover:text-white transition-colors"
                >
                  {l.label}
                </a>
              ) : (
                <button
                  key={l.label}
                  type="button"
                  onClick={() => scrollToId(l.id)}
                  className="rounded-full px-4 py-2 text-[14px] font-bold text-[var(--text-muted)] border-none bg-transparent cursor-pointer hover:text-white transition-colors"
                >
                  {l.label}
                </button>
              ),
            )}
          </nav>

          <div className="hidden lg:flex items-center gap-3">
            <button
              type="button"
              onClick={goLogin}
              className="border-none bg-transparent p-0 text-[14px] font-bold text-[var(--text-muted)] cursor-pointer hover:text-white transition-colors"
            >
              Se connecter
            </button>
            {CTA}
          </div>

          <button
            type="button"
            className="lg:hidden border-none bg-transparent p-2 text-white cursor-pointer"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
          >
            {menuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {menuOpen && (
          <div className="lg:hidden border-t border-[var(--border)] bg-[var(--bg-deep)] px-4 py-4 flex flex-col gap-1">
            {NAV_LINKS.map((l) =>
              'href' in l ? (
                <a
                  key={l.label}
                  href={l.href}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg px-3 py-2.5 text-[15px] font-bold text-[var(--text-muted)] no-underline hover:text-white"
                >
                  {l.label}
                </a>
              ) : (
                <button
                  key={l.label}
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    scrollToId(l.id);
                  }}
                  className="rounded-lg px-3 py-2.5 text-left text-[15px] font-bold text-[var(--text-muted)] border-none bg-transparent cursor-pointer hover:text-white"
                >
                  {l.label}
                </button>
              ),
            )}
            <div className="mt-2 flex flex-col gap-2 border-t border-[var(--border)] pt-4">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  goLogin();
                }}
                className="rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-6 py-3 text-[15px] font-bold text-white cursor-pointer"
              >
                Se connecter
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  goRegister();
                }}
                className="rounded-full bg-brand-dark px-6 py-3 text-[15px] font-black text-white border-none cursor-pointer"
              >
                Rejoindre Wouaff
              </button>
            </div>
          </div>
        )}
      </header>

      <main id="top" className="overflow-hidden">
        {/* ── Hero ── */}
        <section className="relative">
          <div
            className="pointer-events-none absolute inset-0"
            aria-hidden="true"
            style={{
              background: 'radial-gradient(60% 50% at 50% 0%, rgba(249,123,59,0.16) 0%, rgba(249,123,59,0) 70%)',
            }}
          />
          <div className="relative mx-auto max-w-4xl px-4 pt-20 pb-16 text-center sm:px-6 sm:pt-28 sm:pb-20">
            <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-4 py-1.5 text-[13px] font-bold text-[var(--text-muted)]">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" />
              Réseau social · Fait en France
            </div>

            <h1 className="mt-8 text-3xl font-black leading-[1.05] tracking-tight text-white sm:text-6xl mobile:text-[30px]">
              Ton fil.{' '}
              <span className="bg-gradient-to-r from-brand to-brand-light bg-clip-text text-transparent">
                Pas leur algo.
              </span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-[16px] leading-relaxed text-[var(--text-muted)] sm:text-lg">
              Wouaff, c’est un vrai réseau social : tu postes, tu scrolles, tu réponds, tu DMs. Sans pub. Sans boost
              payant. Sans un milliardaire qui décide ce que tu vois. Tes données restent en France. Tes MP sont
              chiffrés.
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={goRegister}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-dark px-8 py-4 text-[16px] font-black text-white border-none cursor-pointer font-sans hover:bg-brand transition-colors sm:w-auto"
              >
                Rejoindre Wouaff, c’est gratuit
                <ArrowRight size={17} />
              </button>
              <button
                type="button"
                onClick={() => scrollToId('produit')}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-8 py-4 text-[16px] font-bold text-white cursor-pointer hover:border-[var(--border-light)] transition-colors sm:w-auto"
              >
                Voir comment ça marche
              </button>
            </div>

            <p className="mt-5 text-[13px] text-[var(--text-muted)]">
              Aucune carte bancaire. Aucune pub. On ne revend pas tes posts.
            </p>

            <div className="mt-12 text-[15px] font-black tracking-[0.35em] text-brand/80">T’AS CAPTÉ</div>
          </div>
        </section>

        {/* ── Bandeau preuve ── */}
        <section className="border-y border-[var(--border)] bg-[var(--bg-base)]">
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
            {PROOF.map((p) => {
              const Icon = p.icon;
              return (
                <div key={p.title} className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-glow">
                    <Icon size={19} className="text-brand" />
                  </div>
                  <div>
                    <div className="text-[15px] font-bold text-white">{p.title}</div>
                    <div className="text-[13px] text-[var(--text-muted)]">{p.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Le problème ── */}
        <section id="pourquoi" className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 sm:py-24">
          <h2 className="text-3xl font-black leading-tight tracking-tight text-white sm:text-[40px]">
            Le fil que t’ouvres tous les jours <span className="text-brand-light">n’est plus à toi.</span>
          </h2>
          <p className="mt-6 text-[15px] leading-relaxed text-[var(--text-muted)] sm:text-[17px]">
            Tu voulais des posts. T’as eu de la pub, un algo qui t’énerve, des comptes payants pour exister, et tes DM
            qui servent à entraîner je-sais-pas-quoi.
          </p>
          <p className="mt-4 text-[15px] leading-relaxed text-[var(--text-muted)] sm:text-[17px]">
            Changer de réseau, c’est chiant. On le sait. Rester sur un truc qui te prend pour un inventaire, c’est pire.
          </p>
          <p className="mt-8 text-lg font-black text-white">
            Wouaff, c’est le même geste, poster, scroller, répondre, sans que tu sois le produit.
          </p>
        </section>

        {/* ── Ce que c'est / pas ── */}
        <section className="border-y border-[var(--border)] bg-[var(--bg-base)] py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-center text-3xl font-black tracking-tight text-white sm:text-[40px]">
              Un réseau social. <span className="text-brand-light">Pas un substitut. Un meilleur fil.</span>
            </h2>

            <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-deep)] p-7">
                <div className="text-[15px] font-black uppercase tracking-wider text-brand">Wouaff, c’est :</div>
                <ul className="mt-5 flex flex-col gap-3.5">
                  {IS_IT.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-[15px] text-white">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#173c2a]">
                        <Check size={12} className="text-[#5fd38d]" strokeWidth={3} />
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-deep)] p-7">
                <div className="text-[15px] font-black uppercase tracking-wider text-[var(--text-muted)]">
                  Wouaff, c’est pas :
                </div>
                <ul className="mt-5 flex flex-col gap-3.5">
                  {IS_NOT.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-[15px] text-[var(--text-muted)]">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-500/10">
                        <X size={12} className="text-red-400" strokeWidth={3} />
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-10 text-center text-[16px] leading-relaxed text-[var(--text-muted)]">
              <p>
                Si tu veux un salon vocal à 21h, c’est pas ici.
                <br />
                Si tu veux poster et que tes potes voient le post, <span className="font-black text-white">ici.</span>
              </p>
            </div>
          </div>
        </section>

        {/* ── Produit, 4 blocs ── */}
        <section id="produit" className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
          <h2 className="text-center text-3xl font-black tracking-tight text-white sm:text-[40px]">
            Le produit. <span className="text-brand-light">Un réseau, en vrai.</span>
          </h2>
          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2">
            {PRODUCT_BLOCKS.map((b) => {
              const Icon = b.icon;
              return (
                <div
                  key={b.id}
                  className="flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-7"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-glow">
                    <Icon size={20} className="text-brand" />
                  </div>
                  <h3 className="mt-5 text-xl font-black text-white">{b.h3}</h3>
                  <p className="mt-3 flex-1 text-[15px] leading-relaxed text-[var(--text-muted)]">{b.body}</p>
                  <p className="mt-5 border-t border-[var(--border)] pt-4 text-[13px] font-bold italic text-brand-light">
                    {b.fine}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Pourquoi c'est mieux ── */}
        <section className="border-y border-[var(--border)] bg-[var(--bg-base)] py-20 sm:py-24">
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <h2 className="text-center text-3xl font-black tracking-tight text-white sm:text-[40px]">
              Pas « mieux » en slide. <span className="text-brand-light">Mieux en vrai.</span>
            </h2>
            <ul className="mx-auto mt-10 flex max-w-2xl flex-col gap-4">
              {WHY_BETTER.map((w) => (
                <li
                  key={w}
                  className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-deep)] p-4 text-[15px] text-white"
                >
                  <Check size={18} className="mt-0.5 shrink-0 text-brand" strokeWidth={3} />
                  {w}
                </li>
              ))}
            </ul>
            <p className="mx-auto mt-10 max-w-2xl text-center text-[15px] leading-relaxed text-[var(--text-muted)]">
              Ce qu’on ne promet pas : d’avoir déjà tout le monde. Un réseau, ça se remplit. On préfère un fil vivant
              entre vous qu’un désert à 2 millions de comptes morts.
            </p>
          </div>
        </section>

        {/* ── Comment ça marche ── */}
        <section className="mx-auto max-w-5xl px-4 py-20 text-center sm:px-6 sm:py-24">
          <h2 className="text-3xl font-black tracking-tight text-white sm:text-[40px]">
            Comme t’imagines. <span className="text-brand-light">Sauf la pub.</span>
          </h2>
          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-3">
            {STEPS.map((s) => (
              <div
                key={s.n}
                className="flex flex-col items-center rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-7"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-dark text-lg font-black text-white">
                  {s.n}
                </div>
                <div className="mt-4 text-[17px] font-black text-white">{s.title}</div>
                <div className="mt-2 text-[14px] leading-relaxed text-[var(--text-muted)]">{s.desc}</div>
              </div>
            ))}
          </div>
          <div className="mt-10 flex flex-col items-center gap-3">
            {CTA}
            <p className="text-[13px] text-[var(--text-muted)]">
              On est encore petit. C’est le moment où tes posts se voient. Plus tard, ça sera plus bruyant. Maintenant,
              c’est à vous.
            </p>
          </div>
        </section>

        {/* ── Pour qui ── */}
        <section className="border-y border-[var(--border)] bg-[var(--bg-base)] py-20 sm:py-24">
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <h2 className="text-center text-3xl font-black tracking-tight text-white sm:text-[40px]">
              Si t’es là, <span className="text-brand-light">t’es probablement ça.</span>
            </h2>
            <ul className="mx-auto mt-10 flex max-w-2xl flex-col gap-4">
              {WHO.map((w) => (
                <li
                  key={w}
                  className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 text-[15px] text-white"
                >
                  <Check size={18} className="mt-0.5 shrink-0 text-brand" strokeWidth={3} />
                  {w}
                </li>
              ))}
            </ul>
            <div className="mx-auto mt-10 max-w-2xl rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-center text-[14px] text-[var(--text-muted)]">
              Pas pour : {WHO_NOT.join(' · ')}.
            </div>
          </div>
        </section>

        {/* ── Sécurité ── */}
        <section id="securite" className="py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-center text-3xl font-black tracking-tight text-white sm:text-[40px]">
              Ce qu’on promet, <span className="text-brand-light">concrètement.</span>
            </h2>
            <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {SECURITY.map((s) => {
                const Icon = s.icon;
                return (
                  <div key={s.title} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-glow">
                      <Icon size={18} className="text-brand" />
                    </div>
                    <div className="mt-4 text-[16px] font-black text-white">{s.title}</div>
                    <p className="mt-2 text-[14px] leading-relaxed text-[var(--text-muted)]">{s.body}</p>
                  </div>
                );
              })}
            </div>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4 text-[14px] font-bold">
              <button
                type="button"
                onClick={() => scrollToId('securite')}
                className="border-none bg-transparent p-0 text-brand cursor-pointer hover:text-brand-light transition-colors"
              >
                Sécurité &amp; confidentialité
              </button>
              <span className="text-[var(--text-muted)]">·</span>
              <Link to="/mentions-legales" className="text-brand no-underline hover:text-brand-light transition-colors">
                Mentions légales
              </Link>
            </div>
          </div>
        </section>

        {/* ── L'histoire ── */}
        <section id="open" className="relative overflow-hidden border-t border-[var(--border)] bg-[var(--bg-base)]">
          <div
            className="pointer-events-none absolute inset-0"
            aria-hidden="true"
            style={{
              background: 'radial-gradient(50% 60% at 50% 100%, rgba(249,123,59,0.14) 0%, rgba(249,123,59,0) 70%)',
            }}
          />
          <div className="relative mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 sm:py-24">
            <h2 className="text-3xl font-black tracking-tight text-white sm:text-[40px]">
              On a 19 ans. <span className="text-brand-light">On le fait en France.</span>
            </h2>
            <p className="mt-6 text-[15px] leading-relaxed text-[var(--text-muted)] sm:text-[17px]">
              Wouaff, c’est pas un fonds, pas une « alternative européenne » née dans un slide deck. C’est deux mecs, un
              loup, et l’idée qu’un fil social n’a pas à appartenir à un milliardaire ni à servir de régie pub.
            </p>
            <p className="mt-4 text-[15px] leading-relaxed text-[var(--text-muted)] sm:text-[17px]">
              On se trompe, on corrige, on publie le changelog.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-deep)] px-6 py-3 text-[14px] font-bold text-white no-underline hover:border-[var(--border-light)] transition-colors"
              >
                <GithubIcon />
                Voir le code
              </a>
              <a
                href={DISCORD_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-deep)] px-6 py-3 text-[14px] font-bold text-white no-underline hover:border-[var(--border-light)] transition-colors"
              >
                <MessageCircle size={17} />
                Le Discord est ouvert
              </a>
            </div>
            <p className="mt-8 text-[13px] font-bold uppercase tracking-widest text-brand/70">
              Fait avec les mains, en France. Pas avec un communiqué.
            </p>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6 sm:py-24">
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                '@context': 'https://schema.org',
                '@type': 'FAQPage',
                mainEntity: FAQ.map((f) => ({
                  '@type': 'Question',
                  name: f.q,
                  acceptedAnswer: {
                    '@type': 'Answer',
                    text: f.a,
                  },
                })),
              }),
            }}
          />
          <h2 className="text-center text-3xl font-black tracking-tight text-white sm:text-[40px]">
            Les questions <span className="text-brand-light">qu’on se pose.</span>
          </h2>
          <div className="mt-10 flex flex-col gap-3">
            {FAQ.map((f) => (
              <details key={f.q} className="group rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] px-6">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-[15px] font-bold text-white [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <ChevronDown
                    size={18}
                    className="shrink-0 text-[var(--text-muted)] transition-transform group-open:rotate-180"
                  />
                </summary>
                <p className="pb-5 text-[14px] leading-relaxed text-[var(--text-muted)]">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ── CTA final ── */}
        <section className="border-t border-[var(--border)] bg-[var(--bg-base)] py-20 sm:py-24">
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
            <h2 className="text-4xl font-black tracking-tight text-white sm:text-5xl">
              Pose le <span className="text-brand-light">premier post.</span>
            </h2>
            <p className="mt-4 text-[16px] text-[var(--text-muted)]">
              Ton fil est vide tant que t’es pas dessus. Ça, au moins, c’est honnête.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={goRegister}
                className="inline-flex items-center gap-2 rounded-full bg-brand-dark px-8 py-4 text-[16px] font-black text-white border-none cursor-pointer font-sans hover:bg-brand transition-colors"
              >
                Rejoindre Wouaff
                <ArrowRight size={17} />
              </button>
              <a
                href={DISCORD_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-deep)] px-8 py-4 text-[16px] font-bold text-white no-underline hover:border-[var(--border-light)] transition-colors"
              >
                <MessageCircle size={17} />
                Parler aux fondateurs
              </a>
            </div>
            <p className="mt-6 text-[13px] font-bold text-[var(--text-muted)]">
              Gratuit · France · Pas de pub · MP chiffrés
            </p>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-[var(--border)] bg-[var(--bg-deep)]">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <div className="grid grid-cols-2 gap-10 sm:grid-cols-4">
            <div className="col-span-2 sm:col-span-1">
              <div className="flex items-center gap-2.5">
                <img src="/assets/logo/logo.png" alt="Logo Wouaff" className="h-8 w-8 rounded-lg" />
                <span className="text-lg font-black text-white">Wouaff</span>
              </div>
              <p className="mt-4 text-[13px] leading-relaxed text-[var(--text-muted)]">
                Wouaff · ton fil, pas leur algo · Fait en France
              </p>
            </div>

            <div>
              <div className="text-[13px] font-black uppercase tracking-wider text-[var(--text-muted)]">Produit</div>
              <ul className="mt-4 flex flex-col gap-2.5">
                {[
                  ['Fonctionnalités', 'produit'],
                  ['Sécurité', 'securite'],
                  ['Changelog', GITHUB_URL],
                  ['Status', '#'],
                ].map(([label, target]) => (
                  <li key={String(label)}>
                    {target.startsWith('http') ? (
                      <a
                        href={target}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[14px] text-[var(--text-muted)] no-underline hover:text-white transition-colors"
                      >
                        {label}
                      </a>
                    ) : (
                      <button
                        type="button"
                        onClick={() => scrollToId(target as string)}
                        className="border-none bg-transparent p-0 text-[14px] text-[var(--text-muted)] cursor-pointer hover:text-white transition-colors"
                      >
                        {label}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <div className="text-[13px] font-black uppercase tracking-wider text-[var(--text-muted)]">Meute</div>
              <ul className="mt-4 flex flex-col gap-2.5">
                {[
                  ['Discord', DISCORD_URL],
                  ['GitHub', GITHUB_URL],
                  ['X', 'https://x.com/wouaff'],
                  ['Contact', '/contact'],
                ].map(([label, href]) => (
                  <li key={String(label)}>
                    {href.startsWith('http') ? (
                      <a
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[14px] text-[var(--text-muted)] no-underline hover:text-white transition-colors"
                      >
                        {label}
                      </a>
                    ) : (
                      <Link
                        to={href}
                        className="text-[14px] text-[var(--text-muted)] no-underline hover:text-white transition-colors"
                      >
                        {label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <div className="text-[13px] font-black uppercase tracking-wider text-[var(--text-muted)]">Légal</div>
              <ul className="mt-4 flex flex-col gap-2.5">
                <li>
                  <Link
                    to="/mentions-legales"
                    className="text-[14px] text-[var(--text-muted)] no-underline hover:text-white transition-colors"
                  >
                    Mentions légales
                  </Link>
                </li>
                <li>
                  <Link
                    to="/mentions-legales#confidentialite"
                    className="text-[14px] text-[var(--text-muted)] no-underline hover:text-white transition-colors"
                  >
                    Confidentialité
                  </Link>
                </li>
                <li>
                  <Link
                    to="/mentions-legales#cgu"
                    className="text-[14px] text-[var(--text-muted)] no-underline hover:text-white transition-colors"
                  >
                    CGU
                  </Link>
                </li>
                <li className="text-[14px] text-[var(--text-muted)]">Pas de cookies de tracking</li>
              </ul>
            </div>
          </div>

          <div className="mt-12 border-t border-[var(--border)] pt-6 text-center">
            <p className="text-[13px] text-[var(--text-muted)]">
              © 2026 Wouaff. Pas de revente de données. Pas de pub.
            </p>
            <div className="mt-5 flex justify-center">
              <DmcaBadge />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
