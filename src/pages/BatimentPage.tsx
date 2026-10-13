import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { fetchAgents } from '../api/agents';
import {
  fetchSignalements,
  createSignalement,
  setSignalementStatut,
  deleteSignalement,
  fetchResponsablesBatiment,
  addResponsableBatiment,
  removeResponsableBatiment,
} from '../api/batiment';
import type { Agent, SignalementBatiment } from '../lib/types';
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, PageHeader, Spinner } from '../components/ui/Primitives';
import { AgentLink } from '../components/ui/AgentLink';
import { useToast } from '../components/ui/Toast';
import { confirmAction } from '../lib/confirm';

export function BatimentPage() {
  const { agent } = useAuth();
  const { showToast } = useToast();
  const isSuperadmin = agent?.niveau_acces === 'superadmin';
  const [agents, setAgents] = useState<Agent[]>([]);
  const [signalements, setSignalements] = useState<SignalementBatiment[]>([]);
  const [responsables, setResponsables] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [lieu, setLieu] = useState('');
  const [description, setDescription] = useState('');
  const [urgence, setUrgence] = useState<'normale' | 'urgente'>('normale');
  const [newResp, setNewResp] = useState('');

  const canManage = isSuperadmin || (!!agent && responsables.includes(agent.id));

  async function reload() {
    const [s, r] = await Promise.all([fetchSignalements(), fetchResponsablesBatiment()]);
    setSignalements(s);
    setResponsables(r);
  }

  useEffect(() => {
    Promise.all([fetchAgents(), reload()])
      .then(([a]) => {
        setAgents(a.filter((x) => x.actif));
      })
      .catch(() => setError('Impossible de charger la page Bâtiment.'))
      .finally(() => setLoading(false));
  }, []);

  const agentNom = (id: string) => {
    const a = agents.find((x) => x.id === id);
    return a ? `${a.prenom} ${a.nom}` : 'Agent inconnu';
  };

  async function run(action: () => Promise<void>, errMsg: string) {
    setError(null);
    try {
      await action();
      await reload();
    } catch (err) {
      console.error(err);
      setError(errMsg);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!agent || !lieu.trim() || !description.trim()) {
      setError('Indique le lieu et décris le problème.');
      return;
    }
    setSending(true);
    await run(async () => {
      await createSignalement({ lieu: lieu.trim(), agentId: agent.id, description: description.trim(), urgence });
      setLieu('');
      setDescription('');
      setUrgence('normale');
      showToast('Signalement enregistré.');
    }, "Impossible d'enregistrer le signalement.");
    setSending(false);
  }

  if (loading) return <Spinner />;

  return (
    <div className="stack">
      <PageHeader title="Bâtiment" sub="Signale un problème dans ou sur le bâtiment : il apparaît dans la liste ci-dessous pour les responsables bâtiment." />
      {error && <ErrorBanner message={error} />}

      <Card accent="brand">
        <form className="stack-sm" onSubmit={handleSubmit}>
          <strong>Signaler un problème</strong>
          <Field label="Lieu">
            <input className="input" maxLength={200} value={lieu} onChange={(e) => setLieu(e.target.value)} placeholder="Ex : vestiaires, remise, toiture, parking…" />
          </Field>
          <Field label="Le problème">
            <textarea
              className="input"
              rows={4}
              maxLength={2000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex : fuite au plafond, porte qui ne ferme plus, lumière HS…"
            />
          </Field>
          <Field label="Urgence">
            <select className="input" value={urgence} onChange={(e) => setUrgence(e.target.value as 'normale' | 'urgente')}>
              <option value="normale">Normale</option>
              <option value="urgente">Urgente (danger ou local inutilisable)</option>
            </select>
          </Field>
          <div>
            <Button type="submit" disabled={sending}>{sending ? 'Enregistrement…' : 'Enregistrer le signalement'}</Button>
          </div>
        </form>
      </Card>

      {isSuperadmin && (
        <Card>
          <strong>Responsables bâtiment (suivi et clôture des signalements)</strong>
          <div className="stack-sm" style={{ marginTop: 10 }}>
            {responsables.length === 0 && <EmptyState>Aucun responsable défini.</EmptyState>}
            {responsables.map((id) => (
              <div key={id} className="list-row">
                <span>{agentNom(id)}</span>
                <button className="link-delete" onClick={() => run(() => removeResponsableBatiment(id), 'Impossible de retirer ce responsable.')}>retirer</button>
              </div>
            ))}
            <div className="field-row">
              <Field label="Ajouter un responsable">
                <select className="input" value={newResp} onChange={(e) => setNewResp(e.target.value)}>
                  <option value="">— choisir un agent —</option>
                  {agents.filter((a) => !responsables.includes(a.id)).map((a) => (
                    <option key={a.id} value={a.id}>{a.prenom} {a.nom}</option>
                  ))}
                </select>
              </Field>
              <Button
                variant="secondary"
                disabled={!newResp}
                onClick={() => run(async () => { await addResponsableBatiment(newResp); setNewResp(''); }, "Impossible d'ajouter ce responsable.")}
              >
                Ajouter
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <strong>Signalements</strong>
        <div className="stack-sm" style={{ marginTop: 10 }}>
          {signalements.length === 0 && <EmptyState>Aucun signalement pour l'instant.</EmptyState>}
          {signalements.map((s) => (
            <div key={s.id} style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
              <div className="list-row" style={{ border: 'none' }}>
                <span>
                  <strong>{s.lieu}</strong>{' '}
                  {s.urgence === 'urgente' && <Badge tone="red">urgent</Badge>}{' '}
                  <Badge tone={s.statut === 'resolu' ? 'green' : 'amber'}>{s.statut === 'resolu' ? 'résolu' : 'ouvert'}</Badge>
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{new Date(s.created_at).toLocaleString('fr-FR')}</span>
              </div>
              <p style={{ fontSize: 13, whiteSpace: 'pre-wrap', margin: '4px 0' }}>{s.description}</p>
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                Par <AgentLink agentId={s.agent_id}>{agentNom(s.agent_id)}</AgentLink>
                {canManage && (
                  <>
                    {' · '}
                    <button className="link-delete" onClick={() => run(() => setSignalementStatut(s.id, s.statut === 'ouvert' ? 'resolu' : 'ouvert'), 'Impossible de mettre à jour le statut.')}>
                      {s.statut === 'ouvert' ? 'marquer résolu' : 'rouvrir'}
                    </button>
                  </>
                )}
                {isSuperadmin && (
                  <>
                    {' · '}
                    <button className="link-delete" onClick={() => confirmAction('Supprimer ce signalement ?') && run(() => deleteSignalement(s.id), 'Impossible de supprimer.')}>supprimer</button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
