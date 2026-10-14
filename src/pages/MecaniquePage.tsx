import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { fetchVehicules } from '../api/vehicules';
import { fetchAgents } from '../api/agents';
import {
  fetchSignalements,
  createSignalement,
  setSignalementStatut,
  deleteSignalement,
  fetchResponsablesMecanique,
  addResponsableMecanique,
  removeResponsableMecanique,
} from '../api/mecanique';
import type { Vehicule, Agent, SignalementMecanique } from '../lib/types';
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, PageHeader, Spinner, Choice } from '../components/ui/Primitives';
import { AgentLink } from '../components/ui/AgentLink';
import { useToast } from '../components/ui/Toast';
import { confirmAction } from '../lib/confirm';

export function MecaniquePage() {
  const { agent } = useAuth();
  const { showToast } = useToast();
  const isSuperadmin = agent?.niveau_acces === 'superadmin';
  const [vehicules, setVehicules] = useState<Vehicule[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [signalements, setSignalements] = useState<SignalementMecanique[]>([]);
  const [responsables, setResponsables] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [vehiculeId, setVehiculeId] = useState('');
  const [description, setDescription] = useState('');
  const [urgence, setUrgence] = useState<'normale' | 'urgente'>('normale');
  const [newResp, setNewResp] = useState('');

  const canManage = isSuperadmin || (!!agent && responsables.includes(agent.id));

  async function reload() {
    const [s, r] = await Promise.all([fetchSignalements(), fetchResponsablesMecanique()]);
    setSignalements(s);
    setResponsables(r);
  }

  useEffect(() => {
    Promise.all([fetchVehicules(), fetchAgents(), reload()])
      .then(([v, a]) => {
        setVehicules(v);
        setAgents(a.filter((x) => x.actif));
      })
      .catch(() => setError('Impossible de charger la page Mécanique.'))
      .finally(() => setLoading(false));
  }, []);

  const vehiculeNom = (id: string) => vehicules.find((v) => v.id === id)?.nom ?? 'Véhicule inconnu';
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
    if (!agent || !vehiculeId || !description.trim()) {
      setError('Choisis un véhicule et décris le souci.');
      return;
    }
    setSending(true);
    await run(async () => {
      await createSignalement({ vehiculeId, agentId: agent.id, description: description.trim(), urgence });
      setVehiculeId('');
      setDescription('');
      setUrgence('normale');
      showToast('Signalement enregistré.');
    }, "Impossible d'enregistrer le signalement.");
    setSending(false);
  }

  if (loading) return <Spinner />;

  return (
    <div className="stack">
      <PageHeader title="Mécanique" sub="Signale un souci sur un véhicule : il apparaît dans la liste ci-dessous pour les responsables mécanique." />
      {error && <ErrorBanner message={error} />}

      <Card accent="brand">
        <form className="stack-sm" onSubmit={handleSubmit}>
          <strong>Signaler un souci</strong>
          <Field label="Véhicule">
            <Choice
              ariaLabel="Véhicule"
              value={vehiculeId}
              onChange={setVehiculeId}
              options={vehicules.map((v) => ({ value: v.id, label: v.nom, hint: v.immatriculation ?? undefined }))}
            />
          </Field>
          <Field label="Le souci">
            <textarea
              className="input"
              rows={4}
              maxLength={2000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex : voyant moteur allumé, bruit au freinage…"
            />
          </Field>
          <Field label="Urgence">
            <Choice ariaLabel="Urgence" value={urgence} onChange={(v) => setUrgence(v as 'normale' | 'urgente')} options={[{ value: 'normale', label: 'Normale' }, { value: 'urgente', label: "Urgente (véhicule à l'arrêt)" }]} />
          </Field>
          <div>
            <Button type="submit" disabled={sending}>{sending ? 'Enregistrement…' : 'Enregistrer le signalement'}</Button>
          </div>
        </form>
      </Card>

      {isSuperadmin && (
        <Card>
          <strong>Responsables mécanique (suivi et clôture des signalements)</strong>
          <div className="stack-sm" style={{ marginTop: 10 }}>
            {responsables.length === 0 && <EmptyState>Aucun responsable défini.</EmptyState>}
            {responsables.map((id) => (
              <div key={id} className="list-row">
                <span>{agentNom(id)}</span>
                <button className="link-delete" onClick={() => run(() => removeResponsableMecanique(id), 'Impossible de retirer ce responsable.')}>retirer</button>
              </div>
            ))}
            <div className="field-row">
              <Field label="Ajouter un responsable">
                <Choice ariaLabel="Agent" value={newResp} onChange={setNewResp} options={agents.filter((a) => !responsables.includes(a.id)).map((a) => ({ value: a.id, label: `${a.prenom} ${a.nom}` }))} />
              </Field>
              <Button
                variant="secondary"
                disabled={!newResp}
                onClick={() => run(async () => { await addResponsableMecanique(newResp); setNewResp(''); }, "Impossible d'ajouter ce responsable.")}
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
                  <strong>{vehiculeNom(s.vehicule_id)}</strong>{' '}
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
