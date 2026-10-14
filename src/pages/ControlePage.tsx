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
  fetchMateriels,
  createMateriel,
  deleteMateriel,
  setManqueStatut,
  fetchResponsablesControle,
  addResponsableControle,
  removeResponsableControle,
  type ProblemeInput,
} from '../api/inventaire';
import type { PetitMateriel, Agent, FamilleControle, InventaireControle, InventaireItem, InventaireManque, Vehicule } from '../lib/types';
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, PageHeader, Spinner, Choice } from '../components/ui/Primitives';
import { useToast } from '../components/ui/Toast';
import { confirmAction } from '../lib/confirm';

type Etat = 'ok' | 'manquant' | 'defectueux' | 'anomalie';

// Libellés selon la famille : inventaire du matériel, ou vérification de points de contrôle.
const CONFIG = {
  inventaire: {
    titre: 'Inventaire',
    sub: "Contrôle le matériel d'un véhicule : pointe ce qui manque ou ne fonctionne pas.",
    zone: 'Zone / coffre',
    zoneEx: 'Ex : Coffre gauche',
    objet: 'Matériel',
    objetEx: 'Ex : Sac de premiers secours',
    suivi: 'Suivi du matériel manquant ou défectueux',
    quantites: true,
    etats: [
      { v: 'ok', l: '✅ OK' },
      { v: 'manquant', l: '❌ Manquant' },
      { v: 'defectueux', l: '⚠️ Défectueux' },
    ],
  },
  verification: {
    titre: 'Vérification',
    sub: "Vérifie l'état d'un véhicule point par point : signale toute anomalie.",
    zone: 'Catégorie',
    zoneEx: 'Ex : Pneus, Niveaux, Éclairage',
    objet: 'Point de contrôle',
    objetEx: 'Ex : Pression des pneus',
    suivi: 'Suivi des anomalies relevées',
    quantites: false,
    etats: [
      { v: 'ok', l: '✅ OK' },
      { v: 'anomalie', l: '⚠️ Anomalie' },
    ],
  },
  materiel: {
    titre: 'Petit matériel',
    sub: "Contrôle un matériel : chaque matériel a ses propres points à valider.",
    zone: 'Rubrique',
    zoneEx: 'Ex : Électrique, Mécanique',
    objet: 'Contrôle à valider',
    objetEx: 'Ex : État du câble',
    suivi: 'Suivi des anomalies relevées',
    quantites: false,
    etats: [
      { v: 'ok', l: '✅ OK' },
      { v: 'anomalie', l: '⚠️ Anomalie' },
    ],
  },
} as const;
interface Saisie { etat: Etat; quantite: number; commentaire: string }

export function ControlePage({ famille }: { famille: FamilleControle }) {
  const cfg = CONFIG[famille];
  const { agent } = useAuth();
  const { showToast } = useToast();
  const isSuperadmin = agent?.niveau_acces === 'superadmin';
  const isAdmin = isSuperadmin || agent?.niveau_acces === 'admin';
  const [vehicules, setVehicules] = useState<Vehicule[]>([]);
  const [materiels, setMateriels] = useState<PetitMateriel[]>([]);
  const [nouveauMateriel, setNouveauMateriel] = useState('');
  const estMateriel = famille === 'materiel';
  const sujets: { id: string; nom: string }[] = estMateriel ? materiels : vehicules;
  const sujetOf = (r: { vehicule_id: string | null; materiel_id: string | null }) => r.materiel_id ?? r.vehicule_id ?? '';
  const [agents, setAgents] = useState<Agent[]>([]);
  const [vehiculeId, setVehiculeId] = useState('');
  const [items, setItems] = useState<InventaireItem[]>([]);
  const [controles, setControles] = useState<InventaireControle[]>([]);
  const [manques, setManques] = useState<InventaireManque[]>([]);
  const [responsables, setResponsables] = useState<string[]>([]);
  const [newResp, setNewResp] = useState('');
  // Seuls les responsables désignés (et le superadmin qui les désigne) changent les statuts.
  const canManage = isSuperadmin || (!!agent && responsables.includes(agent.id));
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
    const [c, m, r] = await Promise.all([fetchControles(famille), fetchManques(famille), fetchResponsablesControle(famille).catch(() => [] as string[])]);
    setControles(c);
    setManques(m);
    setResponsables(r);
  }
  async function reloadItems(id = vehiculeId) {
    setItems(id ? await fetchItems(id, famille) : []);
  }

  useEffect(() => {
    Promise.all([fetchVehicules(), fetchAgents(), reloadSuivi(), fetchMateriels()])
      .then(([v, a, , m]) => {
        setVehicules(v);
        setMateriels(m);
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
  const vehiculeNom = (id: string) => sujets.find((v) => v.id === id)?.nom ?? (estMateriel ? 'Matériel inconnu' : 'Véhicule inconnu');

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

  const dernier = controles.find((c) => sujetOf(c) === vehiculeId);
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
          probleme: s.etat as 'manquant' | 'defectueux' | 'anomalie',
          quantiteConstatee: Math.min(s.quantite, it.quantite),
          commentaire: s.commentaire.trim() || null,
        };
      });
    setSending(true);
    await run(async () => {
      await createControle({ famille, vehiculeId, agentId: agent.id, nbItems: items.length, problemes });
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
      await createItem({ famille, vehiculeId, zone: zone.trim() || 'Général', nom: nom.trim(), quantite: Math.max(1, quantite), ordre: items.length });
      setNom('');
      setQuantite(1);
    }, "Impossible d'ajouter ce matériel.", true);
  }

  if (loading) return <Spinner />;

  const aTraiter = manques.filter((m) => m.statut === 'a_traiter');
  const traites = manques.filter((m) => m.statut === 'regle').slice(0, 20);

  return (
    <div className="stack">
      <PageHeader title={cfg.titre} sub={cfg.sub} />
      {error && <ErrorBanner message={error} />}

      {estMateriel && isSuperadmin && (
        <Card>
          <strong>Matériels</strong>
          <div className="stack-sm" style={{ marginTop: 10 }}>
            {materiels.map((m) => (
              <div key={m.id} className="list-row">
                <span>{m.nom}</span>
                <button
                  className="link-delete"
                  onClick={() => confirmAction(`Supprimer « ${m.nom} » et tous ses contrôles ?`) && run(async () => { await deleteMateriel(m.id); setMateriels(await fetchMateriels()); if (vehiculeId === m.id) setVehiculeId(''); }, 'Impossible de supprimer ce matériel.')}
                >
                  supprimer
                </button>
              </div>
            ))}
            <div className="field-row">
              <Field label="Ajouter un matériel">
                <input className="input" maxLength={200} value={nouveauMateriel} onChange={(e) => setNouveauMateriel(e.target.value)} placeholder="Ex : Tronçonneuse, Défibrillateur…" />
              </Field>
              <Button
                variant="secondary"
                disabled={!nouveauMateriel.trim()}
                onClick={() => run(async () => { await createMateriel(nouveauMateriel.trim()); setNouveauMateriel(''); setMateriels(await fetchMateriels()); }, "Impossible d'ajouter ce matériel.")}
              >
                Ajouter
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Card accent="brand">
        <Field label={estMateriel ? 'Matériel' : 'Véhicule'}>
          <Choice ariaLabel={estMateriel ? 'Matériel' : 'Véhicule'} value={vehiculeId} onChange={setVehiculeId} options={sujets.map((v) => ({ value: v.id, label: v.nom }))} />
        </Field>
        {vehiculeId && (
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 10 }}>
            {dernier ? `Dernier contrôle : ${new Date(dernier.created_at).toLocaleString('fr-FR')} par ${agentNom(dernier.agent_id)}` : 'Aucun contrôle enregistré.'}
          </div>
        )}
      </Card>

      {vehiculeId && (
        <Card>
          <strong>Contrôle</strong>
          <div className="stack-sm" style={{ marginTop: 10 }}>
            {items.length === 0 && <EmptyState>Aucun point défini pour ce {estMateriel ? 'matériel' : 'véhicule'}{isSuperadmin ? ' : ajoute-le plus bas.' : '.'}</EmptyState>}
            {parZone.map(([nomZone, liste]) => (
              <div key={nomZone}>
                <div style={{ fontWeight: 700, margin: '8px 0 4px' }}>{nomZone}</div>
                {liste.map((it) => {
                  const s = saisie(it);
                  return (
                    <div key={it.id} style={{ borderTop: '1px solid var(--border)', padding: '6px 0' }}>
                      <div className="list-row" style={{ border: 'none' }}>
                        <span style={{ fontSize: 14 }}>{it.nom}{cfg.quantites && it.quantite > 1 && <span style={{ color: 'var(--text-3)' }}> × {it.quantite}</span>}</span>
                        <Choice compact ariaLabel={`État : ${it.nom}`} value={s.etat} onChange={(v) => setSaisie(it, { etat: v as Etat })} options={cfg.etats.map((e) => ({ value: e.v, label: e.l }))} />
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

      {(isAdmin || canManage) && (
        <Card>
          <strong>{cfg.suivi}</strong>
          <div className="stack-sm" style={{ marginTop: 10 }}>
            {aTraiter.length === 0 && <EmptyState>Rien à traiter.</EmptyState>}
            {[...aTraiter, ...traites].map((m) => (
              <div key={m.id} style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                <div className="list-row" style={{ border: 'none' }}>
                  <span>
                    <strong>{m.item_nom}</strong>{' '}
                    <Badge tone={m.probleme === 'manquant' ? 'red' : 'amber'}>{m.probleme === 'defectueux' ? 'défectueux' : m.probleme}</Badge>{' '}
                    <Badge tone={m.statut === 'regle' ? 'green' : 'amber'}>{m.statut === 'regle' ? 'réglé' : 'à traiter'}</Badge>
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{new Date(m.created_at).toLocaleString('fr-FR')}</span>
                </div>
                <div style={{ fontSize: 13 }}>
                  {vehiculeNom(sujetOf(m))} · {m.zone}
                  {cfg.quantites && m.probleme === 'manquant' && m.quantite_attendue > 1 && ` · ${m.quantite_constatee}/${m.quantite_attendue} présent(s)`}
                </div>
                {m.commentaire && <p style={{ fontSize: 13, whiteSpace: 'pre-wrap', margin: '4px 0' }}>{m.commentaire}</p>}
                <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                  Signalé par {agentNom(m.agent_id)}
                  {canManage && (
                    <>
                      {' · '}
                      <button className="link-edit" onClick={() => run(() => setManqueStatut(m.id, m.statut === 'a_traiter' ? 'regle' : 'a_traiter'), 'Impossible de mettre à jour le statut.')}>
                        {m.statut === 'a_traiter' ? 'marquer réglé' : 'rouvrir'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {isSuperadmin && (
        <Card>
          <strong>Responsables (suivi et clôture des anomalies)</strong>
          <div className="stack-sm" style={{ marginTop: 10 }}>
            {responsables.length === 0 && <EmptyState>Aucun responsable défini.</EmptyState>}
            {responsables.map((id) => (
              <div key={id} className="list-row">
                <span>{agentNom(id)}</span>
                <button className="link-delete" onClick={() => run(() => removeResponsableControle(famille, id), 'Impossible de retirer ce responsable.')}>retirer</button>
              </div>
            ))}
            <div className="field-row">
              <Field label="Ajouter un responsable">
                <Choice ariaLabel="Agent" value={newResp} onChange={setNewResp} options={agents.filter((a) => !responsables.includes(a.id)).map((a) => ({ value: a.id, label: `${a.prenom} ${a.nom}` }))} />
              </Field>
              <Button
                variant="secondary"
                disabled={!newResp}
                onClick={() => run(async () => { await addResponsableControle(famille, newResp); setNewResp(''); }, "Impossible d'ajouter ce responsable.")}
              >
                Ajouter
              </Button>
            </div>
          </div>
        </Card>
      )}

      {isSuperadmin && vehiculeId && (
        <Card>
          <strong>Définir {famille === 'inventaire' ? "l'inventaire" : estMateriel ? 'les contrôles' : 'les points de vérification'} de {vehiculeNom(vehiculeId)}</strong>
          <div className="stack-sm" style={{ marginTop: 10 }}>
            {items.map((it) => (
              <div key={it.id} className="list-row">
                {editId === it.id ? (
                  <div className="field-row" style={{ flex: 1 }}>
                    <input className="input" style={{ maxWidth: 140 }} value={edit.zone} onChange={(e) => setEdit({ ...edit, zone: e.target.value })} placeholder={cfg.zone} />
                    <input className="input" style={{ flex: 1 }} value={edit.nom} onChange={(e) => setEdit({ ...edit, nom: e.target.value })} placeholder={cfg.objet} />
                    {cfg.quantites && <input className="input" style={{ maxWidth: 70 }} type="number" min={1} value={edit.quantite} onChange={(e) => setEdit({ ...edit, quantite: Math.max(1, Number(e.target.value) || 1) })} />}
                    <Button onClick={() => run(async () => { await updateItem(it.id, { zone: edit.zone.trim() || 'Général', nom: edit.nom.trim(), quantite: edit.quantite }); setEditId(null); }, 'Impossible de modifier ce matériel.', true)}>OK</Button>
                    <Button variant="secondary" onClick={() => setEditId(null)}>Annuler</Button>
                  </div>
                ) : (
                  <>
                    <span style={{ fontSize: 13 }}>
                      <span style={{ color: 'var(--text-3)' }}>{it.zone} · </span>{it.nom}{cfg.quantites && it.quantite > 1 && ` × ${it.quantite}`}
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
              <Field label={cfg.zone}>
                <input className="input" list="zones-controle" value={zone} onChange={(e) => setZone(e.target.value)} placeholder={cfg.zoneEx} />
                <datalist id="zones-controle">{[...new Set(items.map((i) => i.zone))].map((z) => <option key={z} value={z} />)}</datalist>
              </Field>
              <Field label={cfg.objet}>
                <input className="input" value={nom} onChange={(e) => setNom(e.target.value)} placeholder={cfg.objetEx} />
              </Field>
              {cfg.quantites && (
                <Field label="Quantité">
                  <input className="input" style={{ maxWidth: 80 }} type="number" min={1} value={quantite} onChange={(e) => setQuantite(Math.max(1, Number(e.target.value) || 1))} />
                </Field>
              )}
              <Button onClick={handleAddItem}>Ajouter</Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
