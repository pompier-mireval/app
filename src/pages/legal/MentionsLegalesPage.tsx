import { LegalLayout } from '../../components/legal/LegalLayout';

// Obligatoire (LCEN, art. 6-III) pour tout site édité depuis la France,
// même à accès restreint : l'écran de connexion, lui, est public.
// Éditeur = un particulier qui souhaite rester anonyme : dans ce cas, la
// loi permet de ne publier que les coordonnées de l'hébergeur, à condition
// que celui-ci détienne les informations d'identification de l'éditeur.
export function MentionsLegalesPage() {
  return (
    <LegalLayout title="Mentions légales">
      <p className="legal-updated">Dernière mise à jour : 20/09/2026</p>

      <h2>Éditeur du site</h2>
      <p>
        Ce site est édité, à titre personnel et non professionnel, par un membre du centre
        d'incendie et de secours concerné. Conformément à l'article 6-III de la loi n° 2004-575 du
        21 juin 2004 pour la confiance dans l'économie numérique, l'éditeur d'un site non
        professionnel peut ne pas rendre publique son identité, à condition d'avoir communiqué ses
        données personnelles à son hébergeur. C'est le cas ici : seules les coordonnées de
        l'hébergeur sont donc publiées ci-dessous.
      </p>
      <p style={{ fontSize: 12 }}>
        <mark className="todo">
          À vérifier : ton compte GitHub doit être associé à ta véritable identité (nom, adresse)
          pour que cette anonymisation soit valable — un simple pseudonyme ne suffit pas si GitHub
          ne peut pas t'identifier en cas de demande légale.
        </mark>
      </p>

      <h2>Hébergement</h2>
      <p>Ce site (interface web) est hébergé par GitHub Pages :</p>
      <ul>
        <li>GitHub, Inc. — 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, États-Unis</li>
        <li>Pour les utilisateurs de l'Union européenne : GitHub B.V. — Prins Bernhardplein 200, 1097 JB Amsterdam, Pays-Bas</li>
      </ul>
      <p style={{ fontSize: 12 }}>
        (Coordonnées publiques de GitHub à vérifier périodiquement sur github.com, susceptibles de changer.)
      </p>
      <p>
        Les données de l'application (comptes, plannings, disponibilités) sont hébergées séparément
        par Supabase, sur des serveurs situés dans l'Union européenne — voir la{' '}
        <a href="#/confidentialite">politique de confidentialité</a>.
      </p>

      <h2>Nature du site</h2>
      <p>
        Ce site est un outil personnel, gratuit et non officiel, mis à disposition des pompiers du
        centre pour faciliter la gestion des plannings de garde. Il n'est édité ni par le SDIS, ni
        par une association, et n'engage que son éditeur.
      </p>

      <h2>Contact</h2>
      <p>
        Pour toute question relative à ce site, utiliser le contact indiqué dans la{' '}
        <a href="#/confidentialite">politique de confidentialité</a>.
      </p>
    </LegalLayout>
  );
}
