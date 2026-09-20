import { LegalLayout } from '../../components/legal/LegalLayout';

// Service en ligne avec comptes utilisateurs → CGU applicables.
// Ici l'inscription est réelle (sur invitation par email, puis acceptation
// au premier lien de connexion) : la case d'acceptation est donc portée
// par l'écran de connexion (voir AuthScreen.tsx), pas une hypothèse.
export function CguPage() {
  return (
    <LegalLayout title="Conditions générales d'utilisation">
      <p className="legal-updated">Dernière mise à jour : 20/09/2026</p>

      <h2>Objet</h2>
      <p>
        Cet outil, personnel et gratuit, permet aux agents du centre de consulter et renseigner
        leurs disponibilités, de consulter le planning de garde, et pour les administrateurs, de
        gérer les agents, véhicules et affectations. Il n'est ni un service officiel du SDIS, ni un
        service d'une association : il est mis à disposition librement par son créateur.
      </p>

      <h2>Accès et compte</h2>
      <p>
        L'accès n'est pas ouvert au public : un administrateur ajoute ton email pour t'inviter, puis
        tu te connectes par lien de connexion envoyé par email ou par mot de passe. En te
        connectant pour la première fois, tu acceptes les présentes CGU et la{' '}
        <a href="#/confidentialite">politique de confidentialité</a>.
      </p>
      <p>
        Ta participation est volontaire : tu peux demander à tout moment la suppression de ton
        compte sans avoir à te justifier.
      </p>
      <p>
        Chaque agent est responsable de la confidentialité de ses identifiants et doit signaler
        sans délai toute utilisation non autorisée de son compte.
      </p>

      <h2>Règles d'usage</h2>
      <ul>
        <li>Les informations saisies (disponibilités, notes) doivent être exactes.</li>
        <li>Il est interdit d'accéder ou de tenter d'accéder à des données d'un autre agent en dehors des fonctions prévues par l'application.</li>
        <li>Il est interdit d'utiliser l'application à d'autres fins que la coordination des gardes et activités du centre.</li>
      </ul>

      <h2>Résiliation</h2>
      <p>
        En cas de départ du centre ou sur simple demande, ton compte est désactivé par un
        administrateur. Tes données historiques (gardes passées, statistiques) peuvent être
        conservées à des fins de suivi d'activité, conformément à la{' '}
        <a href="#/confidentialite">politique de confidentialité</a>.
      </p>

      <h2>Propriété intellectuelle</h2>
      <p>
        Les données que tu saisis (disponibilités, notes) restent les tiennes ; en les saisissant,
        tu autorises leur usage pour l'organisation des gardes du centre. Le code et l'interface de
        l'application appartiennent à leur auteur.
      </p>

      <h2>Responsabilité et disponibilité</h2>
      <p>
        L'application est fournie gratuitement et en l'état, par une seule personne bénévole, sans
        garantie de disponibilité continue ni d'exactitude du planning. Elle ne remplace aucune
        procédure officielle du SDIS en matière de gestion des gardes ou du personnel : en cas de
        divergence, la procédure officielle prévaut. Son créateur ne peut être tenu responsable
        d'une indisponibilité, d'une erreur de planning ou d'une perte de données liée à un
        incident technique.
      </p>

      <h2>Modification des CGU</h2>
      <p>
        Ces CGU peuvent être modifiées à tout moment ; la version en vigueur est celle publiée sur
        cette page.
      </p>

      <h2>Droit applicable</h2>
      <p>Les présentes CGU sont soumises au droit français.</p>
    </LegalLayout>
  );
}
