import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { fetchVehicules } from '../api/vehicules';
import { fetchAgents } from '../api/agents';
import {
  fetchItems,
  createItem,
  updateItem,
  deleteItem,
  createControle,
  fetchControles,
  fetchManques,
  setManqueStatut,
  type ProblemeInput,
} from '../api/inventaire';
import type { Agent, InventaireControle, InventaireItem, InventaireManque, Vehicule } from '../lib/types';
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, PageHeader, Spinner } from '../components/ui/Primitives';
import { useToast } from '../components/ui/Toast';
import { confirmAction } from '../lib/confirm';

type Etat = 'ok' | 'manquant' | 'defectueux';
interface Saisie { etat: Etat; quantite: number; commentaire: string }

export function InventairePage() {
  const { agent } = useAuth();
  const { showToast } = useToast();
  const isSuperadmin = agent?.niveau_acces === 'superadmin';
  const isAdmin = isSuperadmin || agent?.niveau_acces === 'admin';
  const [vehicules, setVehicules] = useState<Vehicule[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [vehiculeId, setVehiculeId] = useState('');
  const [items, setItems] = useState<InventaireItem[]>([]);
  const [controles, setControles] = useState<InventaireControle[]>([]);
  const [manques, setManques] = useState<InventaireManque[]>([]);
  const [saisies, setSaisies] = useState<Record<string, Saisie>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  // édition (superadmin)
  const [zone, setZone] = useState('');
  const [nom, setNom] = useState('');
  const [quantite, setQuantite] = useState(1);
  const [editId, setEditId] = useState<string | null>(null);
  const [edit, setEdit] = useState({ zone: '', nom: '', quantite: 1 });

  async function reloadSuivi() {
    const [c, m] = await Promise.all([fetchControles(), fetchManques()]);
    setControles(c);
    setManques(m);
  }
  async function reloadItems(id = vehiculeId) {
    setItems(id ? await fetchItems(id) : []);
  }

  useEffect(() => {
    Promise.all([fetchVehicules(), fetchAgents(), reloadSuivi()])
      .then(([v, a]) => {
        setVehicules(v);
        setAgents(a);
      })
      .catch(() => setError("Impossible de charger la page Inventaire."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setSaisies({});
    reloadItems().catch(() => setError("Impossible de charger l'inventaire de ce véhicule."));
  }, [vehiculeId]);

  const agentNom = (id: string) => {
    const a = agents.find((x) => x.id === id);
    return a ? `${a.prenom} ${a.nom}` : 'Agent inconnu';
  };
  const vehiculeNom = (id: string) => vehicules.find((v) => v.id === id)?.nom ?? 'Véhicule inconnu';

  async function run(action: () => Promise<void>, errMsg: string, rechargeItems = false) {
    setError(null);
    try {
      await action();
      if (rechargeItems) await reloadItems();
      await reloadSuivi();
    } catch (err) {
      console.error(err);
      setError(errMsg);
    }
  }

  const parZone = useMemo(() => {
    const groupes = new Map<string, InventaireItem[]>();
    for (const it of items) groupes.set(it.zone, [...(groupes.get(it.zone) ?? []), it]);
    return [...groupes.entries()];
  }, [items]);

  const dernier = controles.find((c) => c.vehicule_id === vehiculeId);
  const saisie = (it: InventaireItem): Saisie => saisies[it.id] ?? { etat: 'ok', quantite: 0, commentaire: '' };
  const setSaisie = (it: InventaireItem, patch: Partial<Saisie>) =>
    setSaisies((prev) => ({ ...prev, [it.id]: { ...saisie(it), ...patch } }));

  async function handleControle() {
    if (!agent || !vehiculeId || items.length === 0) return;
    const problemes: ProblemeInput[] = items
      .filter((it) => saisie(it).etat !== 'ok')
      .map((it) => {
        const s = saisie(it);
        return {
          item: it,
          probleme: s.etat as 'manquant' | 'defectueux',
          quantiteConstatee: Math.min(s.quantite, it.quantite),
          commentaire: s.commentaire.trim() || null,
        };
      });
    setSending(true);
    await run(async () => {
      await createControle({ vehiculeId, agentId: agent.id, nbItems: items.length, problemes });
      setSaisies({});
      showToast(problemes.length ? `Contrôle enregistré, ${problemes.length} point(s) à traiter.` : 'Contrôle enregistré : tout est conforme.');
    }, "Impossible d'enregistrer le contrôle.");
    setSending(false);
  }

  async function handleAddItem() {
    if (!vehiculeId || !nom.trim()) {
      setError("Choisis un véhicule et donne un nom au matériel.");
      return;
    }
    await run(async () => {
      await createItem({ vehiculeId, zone: zone.trim() || 'Général', nom: nom.trim(), quantite: Math.max(1, quantite), ordre: items.length });
      setNom('');
      setQuantite(1);
    }, "Impossible d'ajouter ce matériel.", true);
  }

  if (loading) return <Spinner />;

  const aTraiter = manques.filter((m) => m.statut === 'a_traiter');
  const traites = manques.filter((m) => m.statut === 'regle').slice(0, 20);

  return (
    <div className="stack">
      <PageHeader title="Inventaire" sub="Contrôle le matériel d'un véhicule : pointe ce qui manque ou ne fonctionne pas." />
      {error && <ErrorBanner message={error} />}

      <Card accent="brand">
        <Field label="Véhicule">
          <select className="input" value={vehiculeId} onChange={(e) => setVehiculeId(e.target.value)}>
            <option value="">— choisir —</option>
            {vehicules.map((v) => <option key={v.id} value={v.id}>{v.nom}</option>)}
          </select>
        </Field>
        {vehiculeId && (
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6 }}>
            {dernier ? `Dernier contrôle : ${new Date(dernier.created_at).toLocaleString('fr-FR')} par ${agentNom(dernier.agent_id)}` : 'Aucun contrôle enregistré.'}
          </div>
        )}
      </Card>

      {vehiculeId && (
        <Card>
          <strong>Contrôle</strong>
          <div className="stack-sm" style={{ marginTop: 10 }}>
            {items.length === 0 && <EmptyState>Aucun matériel défini pour ce véhicule{isSuperadmin ? ' : ajoute-le plus bas.' : '.'}</EmptyState>}
            {parZone.map(([nomZone, liste]) => (
              <div key={nomZone}>
                <div style={{ fontWeight: 700, margin: '8px 0 4px' }}>{nomZone}</div>
                {liste.map((it) => {
                  const s = saisie(it);
                  return (
                    <div key={it.id} style={{ borderTop: '1px solid var(--border)', padding: '6px 0' }}>
                      <div className="list-row" style={{ border: 'none' }}>
                        <span style={{ fontSize: 14 }}>{it.nom}{it.quantite > 1 && <span style={{ color: 'var(--text-3)' }}> × {it.quantite}</span>}</span>
                        <select className="input" style={{ maxWidth: 140 }} value={s.etat} onChange={(e) => setSaisie(it, { etat: e.target.value as Etat })}>
                          <option value="ok">✅ OK</option>
                          <option value="manquant">❌ Manquant</option>
                          <option value="defectueux">⚠️ Défectueux</option>
                        </select>
                      </div>
                      {s.etat !== 'ok' && (
                        <div className="field-row" style={{ marginTop: 4 }}>
                          {s.etat === 'manquant' && it.quantite > 1 && (
                            <input
                              className="input"
                              style={{ maxWidth: 110 }}
                              type="number"
                              min={0}
                              max={it.quantite}
                              value={s.quantite}
                              onChange={(e) => setSaisie(it, { quantite: Math.max(0, Number(e.target.value) || 0) })}
                              aria-label="Quantité présente"
                              title="Quantité présente"
                            />
                          )}
                          <input className="input" style={{ flex: 1 }} maxLength={1000} placeholder="Commentaire (facultatif)" value={s.commentaire} onChange={(e) => setSaisie(it, { commentaire: e.target.value })} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
            {items.length > 0 && (
              <div>
                <Button onClick={handleControle} disabled={sending}>{sending ? 'Enregistrement…' : 'Valider le contrôle'}</Button>
              </div>
            )}
          </div>
        </Card>
      )}

      {isAdmin && (
        <Card>
          <strong>Suivi du matériel manquant ou défectueux</strong>
          <div className="stack-sm" style={{ marginTop: 10 }}>
            {aTraiter.length === 0 && <EmptyState>Rien à traiter.</EmptyState>}
            {[...aTraiter, ...traites].map((m) => (
              <div key={m.id} style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                <div className="list-row" style={{ border: 'none' }}>
                  <span>
                    <strong>{m.item_nom}</strong>{' '}
                    <Badge tone={m.probleme === 'manquant' ? 'red' : 'amber'}>{m.probleme === 'manquant' ? 'manquant' : 'défectueux'}</Badge>{' '}
                    <Badge tone={m.statut === 'regle' ? 'green' : 'amber'}>{m.statut === 'regle' ? 'réglé' : 'à traiter'}</Badge>
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{new Date(m.created_at).toLocaleString('fr-FR')}</span>
                </div>
                <div style={{ fontSize: 13 }}>
                  {vehiculeNom(m.vehicule_id)} · {m.zone}
                  {m.probleme === 'manquant' && m.quantite_attendue > 1 && ` · ${m.quantite_constatee}/${m.quantite_attendue} présent(s)`}
                </div>
                {m.commentaire && <p style={{ fontSize: 13, whiteSpace: 'pre-wrap', margin: '4px 0' }}>{m.commentaire}</p>}
                <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                  Signalé par {agentNom(m.agent_id)}
                  {' · '}
                  <button className="link-edit" onClick={() => run(() => setManqueStatut(m.id, m.statut === 'a_traiter' ? 'regle' : 'a_traiter'), 'Impossible de mettre à jour le statut.')}>
                    {m.statut === 'a_traiter' ? 'marquer réglé' : 'rouvrir'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {isSuperadmin && vehiculeId && (
        <Card>
          <strong>Définir l'inventaire de {vehiculeNom(vehiculeId)}</strong>
          <div className="stack-sm" style={{ marginTop: 10 }}>
            {items.map((it) => (
              <div key={it.id} className="list-row">
                {editId === it.id ? (
                  <div className="field-row" style={{ flex: 1 }}>
                    <input className="input" style={{ maxWidth: 140 }} value={edit.zone} onChange={(e) => setEdit({ ...edit, zone: e.target.value })} placeholder="Zone" />
                    <input className="input" style={{ flex: 1 }} value={edit.nom} onChange={(e) => setEdit({ ...edit, nom: e.target.value })} placeholder="Matériel" />
                    <input className="input" style={{ maxWidth: 70 }} type="number" min={1} value={edit.quantite} onChange={(e) => setEdit({ ...edit, quantite: Math.max(1, Number(e.target.value) || 1) })} />
                    <Button onClick={() => run(async () => { await updateItem(it.id, { zone: edit.zone.trim() || 'Général', nom: edit.nom.trim(), quantite: edit.quantite }); setEditId(null); }, 'Impossible de modifier ce matériel.', true)}>OK</Button>
                    <Button variant="secondary" onClick={() => setEditId(null)}>Annuler</Button>
                  </div>
                ) : (
                  <>
                    <span style={{ fontSize: 13 }}>
                      <span style={{ color: 'var(--text-3)' }}>{it.zone} · </span>{it.nom}{it.quantite > 1 && ` × ${it.quantite}`}
                    </span>
                    <span style={{ display: 'flex', gap: 10 }}>
                      <button className="link-edit" onClick={() => { setEditId(it.id); setEdit({ zone: it.zone, nom: it.nom, quantite: it.quantite }); }}>modifier</button>
                      <button className="link-delete" onClick={() => confirmAction(`Supprimer « ${it.nom} » ?`) && run(() => deleteItem(it.id), 'Impossible de supprimer ce matériel.', true)}>supprimer</button>
                    </span>
                  </>
                )}
              </div>
            ))}
            <div className="field-row">
              <Field label="Zone / coffre">
                <input className="input" list="zones-inventaire" value={zone} onChange={(e) => setZone(e.target.value)} placeholder="Ex : Coffre gauche" />
                <datalist id="zones-inventaire">{[...new Set(items.map((i) => i.zone))].map((z) => <option key={z} value={z} />)}</datalist>
              </Field>
              <Field label="Matériel">
                <input className="input" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex : Sac de premiers secours" />
              </Field>
              <Field label="Quantité">
                <input className="input" style={{ maxWidth: 80 }} type="number" min={1} value={quantite} onChange={(e) => setQuantite(Math.max(1, Number(e.target.value) || 1))} />
              </Field>
              <Button onClick={handleAddItem}>Ajouter</Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
