import { useAuth } from '../../hooks/useAuth';
import type { NiveauAcces } from '../../lib/types';

const OPTIONS: { value: NiveauAcces; label: string; full: string }[] = [
  { value: 'utilisateur', label: 'Util.', full: 'Utilisateur' },
  { value: 'admin', label: 'Admin', full: 'Admin' },
  { value: 'superadmin', label: 'Super', full: 'Superadmin' },
];

// Réservé à un vrai superadmin : lui permet de vérifier ce que voient les
// autres rôles sans avoir besoin de trois comptes de test. Purement
// visuel — voir le commentaire sur `rolePreview` dans useAuth.tsx, les
// données restées filtrées par les policies RLS selon le vrai rôle.
export function RolePreviewSwitch() {
  const { realNiveauAcces, rolePreview, setRolePreview } = useAuth();

  if (realNiveauAcces !== 'superadmin') return null;
  const current = rolePreview ?? 'superadmin';

  return (
    <div className="view-toggle role-preview-toggle" role="radiogroup" aria-label="Aperçu de l'application en tant que">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={current === o.value}
          title={`Aperçu : ${o.full}`}
          className={current === o.value ? 'view-toggle-btn active' : 'view-toggle-btn'}
          onClick={() => setRolePreview(o.value === 'superadmin' ? null : o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
