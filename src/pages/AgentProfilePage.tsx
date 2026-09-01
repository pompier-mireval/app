import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { fetchAgentById, updateAgentTelephone } from '../api/agents';
import { fetchCompetences, fetchAgentCompetences } from '../api/competences';
import { fetchGrades } from '../api/grades';
import { fetchGardesForAgent } from '../api/gardes';
import type { Agent, Competence, Grade, Garde } from '../lib/types';
import { Card, ErrorBanner, SuccessBanner, Spinner, Button, PageHeader, Field, Badge, EmptyState } from '../components/ui/Primitives';

interface Props {
  own?: boolean;
}

export function AgentProfilePage({ own = false }: Props) {
  const { agent: moi, updatePassword } = useAuth();
  const params = useParams<{ id: string }>();
  const targetId = own ? moi?.id : params.id;

  const [target, setTarget] = useState<Agent | null>(null);
  const [competences, setCompetences] = useState<Competence[]>([]);
  const [mesCompetenceIds, setMesCompetenceIds] = useState<string[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [gardes, setGardes] = useState<Garde[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [telephone, setTelephone] = useState('');
  const [editingTelephone, setEditingTelephone] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    if (!targetId) return;
    setLoading(true);
    setError(null);
    Promise.all([
      fetchAgentById(targetId),
      fetchCompetences(),
      fetchAgentCompetences(targetId),
      fetchGrades(),
      fetchGardesForAgent(targetId),
    ])
      .then(([a, c, ac, g, gd]) => {
        setTarget(a);
        setCompetences(c);
        setMesCompetenceIds(ac.map((x) => x.competence_id));
        setGrades(g);
        setGardes(gd);
        setTelephone(a?.telephone ?? '');
      })
      .catch(() => setError('Impossible de charger cette fiche.'))
      .finally(() => setLoading(false));
  }, [targetId]);

  async function handleSaveTelephone() {
    if (!target) return;
    setError(null);
    try {
      await updateAgentTelephone(target.id, telephone.trim());
      setTarget({ ...target, telephone: telephone.trim() });
      setEditingTelephone(false);
    } catch {
      setError("Impossible d'enregistrer ce numéro.");
    }
  }

  async function handleChangePassword() {
    setError(null);
    setSuccess(null);
    if (newPassword.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }
    try {
      await updatePassword(newPassword);
      setNewPassword('');
      setConfirmPassword('');
      setSuccess('Mot de passe mis à jour.');
    } catch {
      setError('Impossible de changer le mot de passe.');
    }
  }

  if (loading) return <Spinner />;
  if (!target) return <ErrorBanner message="Agent introuvable." />;

  const gradeNom = grades.find((g) => g.id === target.grade_id)?.nom;
  const mesCompetences = competences.filter((c) => mesCompetenceIds.includes(c.id));

  return (
    <div className="stack">
      <PageHeader title={`${target.prenom} ${target.nom}`} sub={gradeNom ?? 'Aucun grade renseigné'} />
      {error && <ErrorBanner message={error} />}
      {success && <SuccessBanner message={success} />}

      <Card>
        <div className="stack-sm">
          <div className="list-row">
            <span>Email</span>
            <span className="mono">{target.email}</span>
          </div>
          <div className="list-row">
            <span>Téléphone</span>
            {editingTelephone ? (
              <div className="field-row" style={{ margin: 0 }}>
                <input className="input" value={telephone} onChange={(e) => setTelephone(e.target.value)} placeholder="06 12 34 56 78" />
                <Button onClick={handleSaveTelephone}>Enregistrer</Button>
                <Button variant="secondary" onClick={() => setEditingTelephone(false)}>Annuler</Button>
              </div>
            ) : (
              <span className="mono" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {target.telephone || '—'}
                {own && <button className="link-edit" onClick={() => setEditingTelephone(true)}>modifier</button>}
              </span>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <strong style={{ fontSize: 13 }}>Compétences</strong>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
          {mesCompetences.length === 0 && <EmptyState>Aucune compétence attribuée.</EmptyState>}
          {mesCompetences.map((c) => (
            <Badge key={c.id}>{c.nom}</Badge>
          ))}
        </div>
      </Card>

      <Card>
        <strong style={{ fontSize: 13 }}>Gardes</strong>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
          {gardes.length === 0 && <EmptyState>N'appartient à aucune garde.</EmptyState>}
          {gardes.map((g) => (
            <Badge key={g.id}>{g.nom}</Badge>
          ))}
        </div>
      </Card>

      {own && (
        <Card>
          <strong style={{ fontSize: 13 }}>Changer le mot de passe</strong>
          <div className="stack-sm" style={{ marginTop: 10, maxWidth: 320 }}>
            <Field label="Nouveau mot de passe">
              <input type="password" className="input" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </Field>
            <Field label="Confirmer">
              <input type="password" className="input" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </Field>
            <Button onClick={handleChangePassword}>Mettre à jour</Button>
          </div>
        </Card>
      )}
    </div>
  );
}
