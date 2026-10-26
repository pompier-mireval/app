import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { fetchDisponibilites, setDisponibilite, deleteDisponibilite } from '../api/disponibilites';
import { fetchCreneauxTypes } from '../api/creneaux';
import { fetchAffectationsForAgent } from '../api/affectations';
import { fetchAllPostes, fetchVehicules } from '../api/vehicules';
import type { CreneauType, Disponibilite, Affectation, PosteVehicule, Vehicule } from '../lib/types';
import { formatHoraire, isHoraireNuit, buildPosteVehiculeLookup } from '../lib/format';
import { todayIso, daysAgo, inDays, addDays, mondayOf, weekDaysFrom, dayLabel, dayLabelLong, dateLabelFr } from '../lib/dates';
import { Card, ErrorBanner, Spinner, Button, PageHeader, Field, EmptyState, Modal, Choice } from '../components/ui/Primitives';
import { useToast } from '../components/ui/Toast';
import { confirmAction } from '../lib/confirm';
import { IconChevronLeft, IconChevronRight } from '../components/ui/Icons';

const PERSO = 'perso';

export function DisposPage() {
  const { agent } = useAuth();
  const { showToast } = useToast();
  const [dispos, setDispos] = useState<Disponibilite[]>([]);
  const [creneaux, setCreneaux] = useState<CreneauType[]>([]);
  const [mesGardes, setMesGardes] = useState<Affectation[]>([]);
  const [postes, setPostes] = useState<PosteVehicule[]>([]);
  const [vehicules, setVehicules] = useState<Vehicule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [weekAnchor, setWeekAnchor] = useState(todayIso());
  const weekStart = useMemo(() => mondayOf(weekAnchor), [weekAnchor]);
  const weekDays = useMemo(() => weekDaysFrom(weekStart), [weekStart]);

  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  // '' = rien de choisi, PERSO = heures saisies, sinon id du créneau type.
  const [formCreneau, setFormCreneau] = useState('');
  const [showAutre, setShowAutre] = useState(false);
  const [formDebut, setFormDebut] = useState('07:00');
  const [formFin, setFormFin] = useState('19:00');

  function load() {
    if (!agent) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([
      fetchDisponibilites(agent.id, daysAgo(90), inDays(180)),
      fetchCreneauxTypes(),
      fetchAffectationsForAgent(agent.id, todayIso(), inDays(60)),
      fetchAllPostes(),
      fetchVehicules(),
    ])
      .then(([d, c, gardes, p, v]) => {
        setDispos(d);
        setCreneaux(c);
        setMesGardes(gardes);
        setPostes(p);
        setVehicules(v);
      })
      .catch(() => setError('Impossible de charger tes disponibilités.'))
      .finally(() => setLoading(false));
  }

  useEffect(load, [agent]);

  const { vehiculeNomForPoste, posteNom } = buildPosteVehiculeLookup(postes, vehicules);

  // Plusieurs dispos possibles le même jour (jour, nuit, créneaux…).
  function disposOn(day: string): Disponibilite[] {
    return dispos
      .filter((d) => d.date === day)
      .sort((a, b) => (formatHoraire(a, creneaux) < formatHoraire(b, creneaux) ? -1 : 1));
  }

  function openDay(day: string) {
    setSelectedDay(day);
    setError(null);
    setFormCreneau('');
    setShowAutre(false);
    setFormDebut('07:00');
    setFormFin('19:00');
  }

  // Créneau type du côté demandé (nom "jour"/"nuit" en priorité), sinon
  // horaire personnalisé 07:00–19:00 / 19:00–07:00.
  function payloadFor(cote: 'jour' | 'nuit') {
    const duCote = creneaux.filter((c) => (c.heure_debut > c.heure_fin) === (cote === 'nuit'));
    const c = duCote.find((x) => x.nom.toLowerCase().startsWith(cote === 'jour' ? 'jour' : 'nuit')) ?? duCote[0];
    if (c) return { creneauTypeId: c.id };
    return cote === 'jour' ? { heureDebutPerso: '07:00', heureFinPerso: '19:00' } : { heureDebutPerso: '19:00', heureFinPerso: '07:00' };
  }

  async function addDispos(payloads: { creneauTypeId?: string; heureDebutPerso?: string; heureFinPerso?: string }[], msg: string) {
    if (!agent || !selectedDay || payloads.length === 0) return;
    setError(null);
    setSaving(true);
    try {
      for (const payload of payloads) {
        await setDisponibilite({ agentId: agent.id, date: selectedDay, statut: 'disponible', ...payload });
      }
      setDispos(await fetchDisponibilites(agent.id, daysAgo(90), inDays(180)));
      showToast(msg);
    } catch (err) {
      console.error(err);
      setError("Impossible d'enregistrer cette disponibilité.");
    } finally {
      setSaving(false);
    }
  }

  const aCote = (day: string, cote: 'jour' | 'nuit') => disposOn(day).some((d) => isHoraireNuit(d, creneaux) === (cote === 'nuit'));

  function handleQuick(cote: 'jour' | 'nuit' | '24h') {
    if (!selectedDay) return;
    const cotes = cote === '24h' ? (['jour', 'nuit'] as const) : [cote];
    // Pas de doublon : on ne complète que les côtés encore vides.
    const manquants = cotes.filter((c) => !aCote(selectedDay, c));
    addDispos(manquants.map(payloadFor), cote === '24h' ? 'Disponible 24h.' : `Disponibilité ${cote} enregistrée.`);
  }

  function handleAddCustom() {
    addDispos(
      [formCreneau === PERSO ? { heureDebutPerso: formDebut, heureFinPerso: formFin } : { creneauTypeId: formCreneau }],
      'Disponibilité enregistrée.'
    );
  }

  async function handleDelete(id: string) {
    if (!agent) return;
    if (!confirmAction('Retirer cette disponibilité ?')) return;
    setError(null);
    setDeleting(true);
    try {
      await deleteDisponibilite(id);
      setDispos(await fetchDisponibilites(agent.id, daysAgo(90), inDays(180)));
      showToast('Disponibilité retirée.');
    } catch (err) {
      console.error(err);
      setError('Impossible de supprimer cette disponibilité.');
    } finally {
      setDeleting(false);
    }
  }

  if (loading) return <Spinner />;

  if (!agent) {
    return (
      <div className="stack">
        <PageHeader title="Mes disponibilités" />
        <ErrorBanner message="Ton compte n'est pas encore relié à une fiche agent. Contacte un administrateur pour qu'il vérifie ta fiche dans Supabase." />
      </div>
    );
  }

  return (
    <div className="stack">
      <PageHeader title="Mes disponibilités" sub="Clique sur un jour pour te déclarer disponible : 24h, jour, nuit ou plusieurs créneaux." />
      {error && <ErrorBanner message={error} />}

      <Card>
        <strong style={{ fontSize: 13 }}>Mes gardes à venir</strong>
        <div style={{ marginTop: 10 }}>
          {mesGardes.length === 0 ? (
            <EmptyState>Aucune garde planifiée pour l'instant.</EmptyState>
          ) : (
            mesGardes
              .slice()
              .sort((a, b) => a.date.localeCompare(b.date))
              .map((g) => (
                <div key={g.id} className="list-row">
                  <span>
                    <time className="mono">{g.date}</time> — {vehiculeNomForPoste(g.poste_vehicule_id)} · {posteNom(g.poste_vehicule_id)}
                  </span>
                  <span className="mono" style={{ color: 'var(--text-3)', fontSize: 12 }}>
                    {formatHoraire(g, creneaux)}
                  </span>
                </div>
              ))
          )}
        </div>
      </Card>

      <Card>
        <div className="field-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <strong style={{ fontSize: 13 }}>Semaine du {dateLabelFr(weekStart)}</strong>
          <div className="btn-row">
            <Button variant="secondary" onClick={() => setWeekAnchor(addDays(weekStart, -7))}>
              <IconChevronLeft /> Précédente
            </Button>
            <Button variant="secondary" onClick={() => setWeekAnchor(todayIso())}>Aujourd'hui</Button>
            <Button variant="secondary" onClick={() => setWeekAnchor(addDays(weekStart, 7))}>
              Suivante <IconChevronRight />
            </Button>
          </div>
        </div>

        <div className="dispo-agenda">
          {weekDays.map((day) => {
            const ds = disposOn(day);
            return (
              <button key={day} className={`dispo-agenda-cell ${ds.length > 0 ? 'tone-green' : 'tone-empty'}`} onClick={() => openDay(day)}>
                <span className="dispo-agenda-day">{dayLabel(day)}</span>
                {ds.length > 0 ? (
                  ds.map((d) => <span key={d.id} className="dispo-agenda-hours mono">{formatHoraire(d, creneaux)}</span>)
                ) : (
                  <span className="dispo-agenda-add">+ ajouter</span>
                )}
              </button>
            );
          })}
        </div>
      </Card>

      {selectedDay && (
        <Modal title={dayLabelLong(selectedDay)} onClose={() => setSelectedDay(null)}>
          <div className="stack-sm">
            <div>
              {disposOn(selectedDay).length === 0 && <EmptyState>Aucune disponibilité ce jour-là.</EmptyState>}
              {disposOn(selectedDay).map((d) => (
                <div key={d.id} className="list-row">
                  <span className="mono">{formatHoraire(d, creneaux)}</span>
                  <button className="link-delete" onClick={() => handleDelete(d.id)} disabled={saving || deleting}>retirer</button>
                </div>
              ))}
            </div>

            <div className="btn-row">
              <Button variant="secondary" onClick={() => handleQuick('24h')} disabled={saving || deleting || (aCote(selectedDay, 'jour') && aCote(selectedDay, 'nuit'))}>24h</Button>
              <Button variant="secondary" onClick={() => handleQuick('jour')} disabled={saving || deleting || aCote(selectedDay, 'jour')}>Jour</Button>
              <Button variant="secondary" onClick={() => handleQuick('nuit')} disabled={saving || deleting || aCote(selectedDay, 'nuit')}>Nuit</Button>
              <Button variant="secondary" onClick={() => setShowAutre((v) => !v)} aria-expanded={showAutre} disabled={saving || deleting}>
                Autre horaire…
              </Button>
            </div>

            {showAutre && (
              <div className="stack-sm" style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                <Field label="Choisis un créneau ou saisis tes heures">
                  <Choice
                    ariaLabel="Créneau"
                    value={formCreneau}
                    onChange={setFormCreneau}
                    options={[
                      ...creneaux.map((c) => ({ value: c.id, label: c.nom, hint: `${c.heure_debut.slice(0, 5)}–${c.heure_fin.slice(0, 5)}` })),
                      { value: PERSO, label: 'Horaire personnalisé' },
                    ]}
                  />
                </Field>
                {formCreneau === PERSO && (
                  <div className="field-row">
                    <Field label="Début">
                      <input type="time" className="input" value={formDebut} onChange={(e) => setFormDebut(e.target.value)} />
                    </Field>
                    <Field label="Fin">
                      <input type="time" className="input" value={formFin} onChange={(e) => setFormFin(e.target.value)} />
                    </Field>
                  </div>
                )}
                <div>
                  <Button onClick={handleAddCustom} disabled={!formCreneau || saving || deleting}>Ajouter cette disponibilité</Button>
                </div>
              </div>
            )}

            <div className="field-row">
              <Button variant="secondary" onClick={() => setSelectedDay(null)}>Terminer</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
