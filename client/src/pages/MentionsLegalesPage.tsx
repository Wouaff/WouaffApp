import { Link } from 'react-router-dom';
import DmcaBadge from '../components/Common/DmcaBadge';

const GITHUB_URL = 'https://github.com/youtsuhodev/WouaffApp';

export default function MentionsLegalesPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-dvh bg-[var(--bg-page)] p-4">
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-lg p-8 max-w-2xl w-full">
        <div className="text-center mb-2">
          <img src="/assets/logo/logo.png" alt="Logo Wouaff" className="w-12 h-12 mb-2 inline-block" />
          <h1 className="text-xl font-bold m-0">Wouaff</h1>
        </div>
        <div className="text-center text-text-secondary text-sm mb-6">Mentions légales</div>

        <div className="space-y-6 text-sm leading-relaxed text-text-secondary">
          <section id="editeur">
            <h2 className="text-base font-bold text-[var(--text-primary)] mb-2">Éditeur du service</h2>
            <p>
              Le service Wouaff est édité par l'équipe Wouaff, en France. Wouaff est un réseau social en ligne, libre et
              open source, dont le code est publié sur{' '}
              <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="text-brand underline">
                GitHub
              </a>
              .
            </p>
            <p className="mt-2">
              Les coordonnées légales complètes de la structure éditrice (dénomination, siège, immatriculation) sont
              disponibles sur demande via la{' '}
              <Link to="/contact" className="text-brand underline">
                page de contact
              </Link>
              .
            </p>
          </section>

          <section id="contact">
            <h2 className="text-base font-bold text-[var(--text-primary)] mb-2">Contact</h2>
            <p>
              Pour toute question, réclamation ou demande concernant le service, écrivez-nous via la{' '}
              <Link to="/contact" className="text-brand underline">
                page de contact
              </Link>
              .
            </p>
          </section>

          <section id="hebergement">
            <h2 className="text-base font-bold text-[var(--text-primary)] mb-2">Hébergement</h2>
            <p>
              Les données de comptes, posts et médias sont hébergés en France, conformément à ce qui est annoncé sur la
              page d'accueil. Les détails techniques de l'hébergeur sont communiqués sur demande.
            </p>
          </section>

          <section id="donnees">
            <h2 className="text-base font-bold text-[var(--text-primary)] mb-2">Données personnelles</h2>
            <p>
              Wouaff collecte les données strictement nécessaires au fonctionnement du service (compte, pseudo, email de
              connexion). Les messages privés sont chiffrés sur votre appareil.
            </p>
            <p className="mt-2">
              Vous disposez des droits d'accès, de rectification, de suppression et de portabilité de vos données,
              exerçables directement dans les paramètres du compte. Aucune donnée n'est revendue, aucun cookie de
              tracking n'est déposé.
            </p>
          </section>

          <section id="cookies">
            <h2 className="text-base font-bold text-[var(--text-primary)] mb-2">Cookies</h2>
            <p>
              Le service dépose uniquement un cookie de session, strictement nécessaire à la connexion. Aucun cookie de
              mesure d'audience n'est déposé sans votre consentement.
            </p>
          </section>

          <section id="propriete">
            <h2 className="text-base font-bold text-[var(--text-primary)] mb-2">Propriété intellectuelle</h2>
            <p>
              Le code source de Wouaff est publié sous licence libre sur GitHub. Les contenus publiés par les
              utilisateurs restent la propriété de leurs auteurs.
            </p>
          </section>

          <section id="responsabilite">
            <h2 className="text-base font-bold text-[var(--text-primary)] mb-2">Responsabilité</h2>
            <p>
              Le service est fourni sans garantie particulière. L'équipe Wouaff ne peut être tenue responsable des
              contenus publiés par les utilisateurs, qui s'engagent à respecter les règles d'usage du service.
            </p>
          </section>

          <section id="cgu">
            <h2 className="text-base font-bold text-[var(--text-primary)] mb-2">Conditions générales d'utilisation</h2>
            <p>
              En créant un compte, vous acceptez d'utiliser le service conformément à son usage prévu : publier des
              contenus, échanger, respecter les autres utilisateurs. Le harcèlement, les contenus illégaux et la revente
              de comptes sont interdits et peuvent mener au bannissement.
            </p>
          </section>

          <section id="confidentialite">
            <h2 className="text-base font-bold text-[var(--text-primary)] mb-2">Confidentialité</h2>
            <p>
              Vos données ne sont pas revendues, pas monétisées, pas utilisées pour de la publicité. La liste des
              données collectées et vos droits sont décrits dans la section données personnelles ci-dessus.
            </p>
          </section>
        </div>

        <div className="mt-8 text-center">
          <Link to="/" className="inline-block text-brand underline text-sm">
            Retour à l'accueil
          </Link>
        </div>
      </div>
      <div className="mt-6 flex justify-center">
        <DmcaBadge />
      </div>
    </div>
  );
}
