import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { fetchAgents } from '../api/agents';
import {
  fetchDemandes,
  createDemande,
  setDemandeStatut,
  deleteDemande,
  fetchResponsablesHabillement,
  addResponsableHabillement,
  removeResponsableHabillement,
} from '../api/habillement';
import type { Agent, DemandeHabillement, StatutDemandeHabillement, TypeVetement } from '../lib/types';
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, PageHeader, Spinner } from '../components/ui/Primitives';
import { AgentLink } from '../components/ui/AgentLink';
import { CodeScanner } from '../components/ui/CodeScanner';
import { useToast } from '../components/ui/Toast';
import { confirmAction } from '../lib/confirm';

const TYPES: { value: TypeVetement; label: string }[] = [
  { value: 'polo', label: 'Polo' },
  { value: 'veste_tsi', label: 'Veste TSI' },
  { value: 'pantalon', label: 'Pantalon' },
  { value: 'surpantalon', label: 'Surpantalon' },
  { value: 'veste_f1', label: 'Veste F1' },
  { value: 'rangers', label: 'Rangers' },
  { value: 'autre', label: 'Autre (à préciser)' },
];

const STATUTS: Record<StatutDemandeHabillement, { label: string; tone: 'amber' | 'green' | 'red' | 'neutral' }> = {
  en_attente: { label: 'en attente', tone: 'amber' },
  acceptee: { label: 'acceptée', tone: 'green' },
  refusee: { label: 'refusée', tone: 'red' },
  livree: { label: 'livrée', tone: 'neutral' },
};

export function HabillementPage() {
  const { agent } = useAuth();
  const { showToast } = useToast();
  const isSuperadmin = agent?.niveau_acces === 'superadmin';
  const [agents, setAgents] = useState<Agent[]>([]);
  const [demandes, setDemandes] = useState<DemandeHabillement[]>([]);
  const [responsables, setResponsables] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [type, setType] = useState<TypeVetement | ''>('');
  const [typeAutre, setTypeAutre] = useState('');
  const [code, setCode] = useState('');
  const [scanning, setScanning] = useState(false);
  const [motif, setMotif] = useState('');
  const [newResp, setNewResp] = useState('');

  const estReferent = !!agent && responsables.includes(agent.id);

  async function reload() {
    const [d, r] = await Promise.all([fetchDemandes(), fetchResponsablesHabillement()]);
    setDemandes(d);
    setResponsables(r);
  }

  useEffect(() => {
    Promise.all([fetchAgents(), reload()])
      .then(([a]) => setAgents(a.filter((x) => x.actif)))
      .catch(() => setError('Impossible de charger la page Habillement.'))
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

  const handleScanned = useCallback((texte: string) => {
    setCode(texte.slice(0, 200));
    setScanning(false);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!agent || !type || !motif.trim()) {
      setError('Choisis le type de vêtement et indique le motif du changement.');
      return;
    }
    if (type === 'autre' && !typeAutre.trim()) {
      setError('Précise le vêtement concerné.');
      return;
    }
    setSending(true);
    await run(async () => {
      await createDemande({ agentId: agent.id, type, typeAutre: typeAutre.trim() || null, code: code.trim() || null, motif: motif.trim() });
      setType('');
      setTypeAutre('');
      setCode('');
      setMotif('');
      showToast('Demande enregistrée.');
    }, "Impossible d'enregistrer la demande.");
    setSending(false);
  }

  if (loading) return <Spinner />;

  const libelle = (d: DemandeHabillement) =>
    d.type === 'autre' ? `Autre : ${d.type_autre ?? '?'}` : TYPES.find((t) => t.value === d.type)?.label ?? d.type;

  return (
    <div className="stack">
      <PageHeader
        title="Habillement"
        sub="Demande le changement d'un vêtement. Seuls toi et les référents habillement voient ta demande."
      />
      {error && <ErrorBanner message={error} />}

      <Card accent="brand">
        <form className="stack-sm" onSubmit={handleSubmit}>
          <strong>Nouvelle demande</strong>
          <Field label="Type de vêtement">
            <select className="input" value={type} onChange={(e) => setType(e.target.value as TypeVetement | '')}>
              <option value="">— choisir —</option>
              {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>
          {type === 'autre' && (
            <Field label="Précise le vêtement">
              <input className="input" maxLength={100} value={typeAutre} onChange={(e) => setTypeAutre(e.target.value)} placeholder="Ex : ceinturon, gants…" />
            </Field>
          )}
          <Field label="Code (facultatif)">
            <div className="field-row">
              <input className="input" style={{ flex: 1 }} maxLength={200} value={code} onChange={(e) => setCode(e.target.value)} placeholder="Code de l'article" />
              {!scanning && <Button type="button" variant="secondary" onClick={() => setScanning(true)}>Scanner</Button>}
            </div>
          </Field>
          {scanning && <CodeScanner onCode={handleScanned} onClose={() => setScanning(false)} />}
          <Field label="Motif du changement">
            <textarea className="input" rows={3} maxLength={2000} value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Ex : usure, taille inadaptée, déchirure…" />
          </Field>
          <div>
            <Button type="submit" disabled={sending}>{sending ? 'Enregistrement…' : 'Envoyer la demande'}</Button>
          </div>
        </form>
      </Card>

      {isSuperadmin && (
        <Card>
          <strong>Référents habillement (traitent les demandes et les voient toutes)</strong>
          <div className="stack-sm" style={{ marginTop: 10 }}>
            {responsables.length === 0 && <EmptyState>Aucun référent défini.</EmptyState>}
            {responsables.map((id) => (
              <div key={id} className="list-row">
                <span>{agentNom(id)}</span>
                <button className="link-delete" onClick={() => run(() => removeResponsableHabillement(id), 'Impossible de retirer ce référent.')}>retirer</button>
              </div>
            ))}
            <div className="field-row">
              <Field label="Ajouter un référent">
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
                onClick={() => run(async () => { await addResponsableHabillement(newResp); setNewResp(''); }, "Impossible d'ajouter ce référent.")}
              >
                Ajouter
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <strong>{estReferent ? 'Toutes les demandes' : 'Mes demandes'}</strong>
        <div className="stack-sm" style={{ marginTop: 10 }}>
          {demandes.length === 0 && <EmptyState>Aucune demande pour l'instant.</EmptyState>}
          {demandes.map((d) => (
            <div key={d.id} style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
              <div className="list-row" style={{ border: 'none' }}>
                <span>
                  <strong>{libelle(d)}</strong> <Badge tone={STATUTS[d.statut].tone}>{STATUTS[d.statut].label}</Badge>
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{new Date(d.created_at).toLocaleString('fr-FR')}</span>
              </div>
              {d.code && <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Code : {d.code}</div>}
              <p style={{ fontSize: 13, whiteSpace: 'pre-wrap', margin: '4px 0' }}>{d.motif}</p>
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                {estReferent ? <>Par <AgentLink agentId={d.agent_id}>{agentNom(d.agent_id)}</AgentLink></> : null}
                {estReferent && (
                  <>
                    {' · '}
                    {(['en_attente', 'acceptee', 'refusee', 'livree'] as StatutDemandeHabillement[])
                      .filter((s) => s !== d.statut)
                      .map((s) => (
                        <button key={s} className="link-edit" style={{ marginRight: 8 }} onClick={() => run(() => setDemandeStatut(d.id, s), 'Impossible de mettre à jour le statut.')}>
                          {STATUTS[s].label}
                        </button>
                      ))}
                  </>
                )}
                {(estReferent || (d.agent_id === agent?.id && d.statut === 'en_attente')) && (
                  <>
                    {' · '}
                    <button className="link-delete" onClick={() => confirmAction('Supprimer cette demande ?') && run(() => deleteDemande(d.id), 'Impossible de supprimer.')}>supprimer</button>
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
