import { LegalLayout } from '../../components/legal/LegalLayout';

// Obligatoire (LCEN, art. 6-III) pour tout site édité depuis la France,
// même à accès restreint : l'écran de connexion, lui, est public.
export function MentionsLegalesPage() {
  return (
    <LegalLayout title="Mentions légales">
      <p className="legal-updated">Dernière mise à jour : 20/09/2026</p>

      <h2>Éditeur du site</h2>
      <p>
        Ce site est édité, à titre personnel et non professionnel, par Bastien Tiffy, membre du
        centre d'incendie et de secours concerné.
      </p>
      <ul>
        <li>Email : <a href="mailto:tbastien6@gmail.com">tbastien6@gmail.com</a></li>
        <li>Téléphone : <a href="tel:0651674638">06 51 67 46 38</a></li>
      </ul>

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
        Pour toute question relative à ce site, écrire à{' '}
        <a href="mailto:tbastien6@gmail.com">tbastien6@gmail.com</a>. Pour les données
        personnelles, voir aussi la <a href="#/confidentialite">politique de confidentialité</a>.
      </p>
    </LegalLayout>
  );
}
