import { useAuth } from '../../hooks/useAuth';
import type { NiveauAcces } from '../../lib/types';

const OPTIONS: { value: NiveauAcces; label: string }[] = [
  { value: 'utilisateur', label: 'Utilisateur' },
  { value: 'admin', label: 'Admin' },
  { value: 'superadmin', label: 'Superadmin' },
];

// Réservé à un vrai superadmin : lui permet de vérifier ce que voient les
// autres rôles sans avoir besoin de trois comptes de test. Purement
// visuel — voir le commentaire sur `rolePreview` dans useAuth.tsx, les
// données restées filtrées par les policies RLS selon le vrai rôle.
export function RolePreviewSwitch() {
  const { realNiveauAcces, rolePreview, setRolePreview } = useAuth();

  if (realNiveauAcces !== 'superadmin') return null;

  return (
    <select
      className="input role-preview-select"
      aria-label="Aperçu de l'application en tant que"
      value={rolePreview ?? 'superadmin'}
      onChange={(e) => {
        const value = e.target.value as NiveauAcces;
        setRolePreview(value === 'superadmin' ? null : value);
      }}
    >
      {OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          Aperçu : {o.label}
        </option>
      ))}
    </select>
  );
}
