import { LegalLayout } from '../../components/legal/LegalLayout';

// RGPD — construite à partir des traitements réellement présents dans le
// code (schema_v2.sql, security_rls.sql, src/lib/types.ts, src/api/*).
// Particularité de ce cas : l'éditeur est un particulier (pas l'association
// ni le SDIS), et l'inscription se fait sur la base d'une invitation par
// email suivie d'une acceptation individuelle — le responsable de
// traitement est donc l'éditeur lui-même, et la base légale est le
// consentement de chaque agent, pas l'intérêt légitime d'une structure.
export function ConfidentialitePage() {
  return (
    <LegalLayout title="Politique de confidentialité">
      <p className="legal-updated">Dernière mise à jour : 20/09/2026</p>

      <p>
        Cette application est un outil personnel, gratuit et non officiel, créé par un pompier du
        centre pour aider à la gestion des gardes. Elle n'est éditée ni par le SDIS ni par une
        association : le responsable du traitement des données ci-dessous est donc son éditeur, à
        titre individuel — voir la <a href="#/mentions-legales">page mentions légales</a> pour le
        contacter.
      </p>
      <p>
        L'accès se fait uniquement sur invitation : un administrateur ajoute ton email, puis tu
        acceptes ces conditions au moment de ta première connexion. Il ne s'agit donc pas d'un
        traitement imposé par ton employeur ou l'association, mais d'un service auquel tu choisis
        librement de participer.
      </p>

      <h2>Données traitées et finalités</h2>
      <table>
        <thead>
          <tr><th>Donnée</th><th>Finalité</th><th>Base légale</th><th>Durée de conservation</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>Nom, prénom, email, téléphone, grade</td>
            <td>Identification, contact entre agents pour l'organisation des gardes</td>
            <td>Consentement (tu choisis de t'inscrire)</td>
            <td>Jusqu'à la suppression de ton compte ou ton départ du centre</td>
          </tr>
          <tr>
            <td>Compétences et dates d'obtention</td>
            <td>Affectation aux gardes/véhicules selon les qualifications</td>
            <td>Consentement</td>
            <td>Jusqu'à la suppression de ton compte</td>
          </tr>
          <tr>
            <td>Disponibilités et notes de disponibilité</td>
            <td>Construction du planning de garde</td>
            <td>Consentement</td>
            <td>Historique conservé pour les statistiques d'activité</td>
          </tr>
          <tr>
            <td>Affectations aux gardes et véhicules</td>
            <td>Suivi opérationnel, statistiques d'activité</td>
            <td>Consentement</td>
            <td>Historique conservé pour les statistiques d'activité</td>
          </tr>
          <tr>
            <td>Email + mot de passe ou lien de connexion</td>
            <td>Authentification au compte</td>
            <td>Exécution du service demandé (connexion)</td>
            <td>Durée du compte</td>
          </tr>
        </tbody>
      </table>

      <h2>Qui a accès à ces données</h2>
      <ul>
        <li>Toi-même, pour tes propres données.</li>
        <li>Les autres agents ayant un compte sur l'outil, pour les informations nécessaires à la coordination des gardes (nom, grade, disponibilités, affectations).</li>
        <li>Les administrateurs de l'outil, pour la gestion du planning et des comptes.</li>
        <li>Supabase Inc., en tant que sous-traitant technique (hébergement de la base de données et service d'authentification). Les serveurs utilisés sont situés dans l'Union européenne : aucun transfert de données hors UE.</li>
        <li>GitHub (hébergement de l'interface web statique) — ne reçoit pas les données personnelles de l'application, qui transitent directement entre le navigateur et Supabase.</li>
      </ul>
      <p style={{ fontSize: 12 }}>
        <mark className="todo">
          Accès : seul un administrateur peut créer une invitation (ajout d'un email). Un agent
          normal ne peut pas s'inscrire de lui-même — demande l'ajout de ton email à un
          administrateur si tu n'as pas encore de compte.
        </mark>
      </p>

      <h2>Cookies et stockage local</h2>
      <p>
        L'application n'utilise aucun cookie ni traceur publicitaire ou de mesure d'audience.
        Le stockage local du navigateur (<code>localStorage</code>) est utilisé uniquement pour :
      </p>
      <ul>
        <li>conserver la session de connexion (strictement nécessaire au fonctionnement) ;</li>
        <li>mémoriser la préférence d'affichage clair/sombre (strictement nécessaire, pas de profilage).</li>
      </ul>
      <p>Aucun consentement n'est requis pour ces éléments, et aucun bandeau cookies n'est donc affiché.</p>

      <h2>Retrait du consentement</h2>
      <p>
        Tu peux à tout moment demander la suppression de ton compte et de tes données à{' '}
        tbastien6@gmail.com. Les données liées à l'historique des gardes
        déjà effectuées peuvent être conservées sous forme anonymisée à des fins statistiques.
      </p>

      <h2>Vos droits</h2>
      <p>
        Conformément au RGPD, tu disposes d'un droit d'accès, de rectification, d'effacement,
        d'opposition, de limitation et de portabilité de tes données. Pour les exercer, contacte
        tbastien6@gmail.com. Tu peux également introduire une
        réclamation auprès de la CNIL (<a href="https://www.cnil.fr" target="_blank" rel="noreferrer">www.cnil.fr</a>).
      </p>
    </LegalLayout>
  );
}
