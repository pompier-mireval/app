import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { fetchDisponibilites, setDisponibilite, deleteDisponibilite } from '../api/disponibilites';
import { fetchCreneauxTypes } from '../api/creneaux';
import { fetchAffectationsForAgent } from '../api/affectations';
import { fetchAllPostes, fetchVehicules } from '../api/vehicules';
import type { CreneauType, Disponibilite, Affectation, PosteVehicule, Vehicule } from '../lib/types';
import { formatHoraire, buildPosteVehiculeLookup } from '../lib/format';
import { todayIso, daysAgo, inDays, addDays, mondayOf, weekDaysFrom, dayLabel, dayLabelLong } from '../lib/dates';
import { Card, ErrorBanner, Spinner, Button, PageHeader, Field, EmptyState } from '../components/ui/Primitives';

export function DisposPage() {
  const { agent } = useAuth();
  const [dispos, setDispos] = useState<Disponibilite[]>([]);
  const [creneaux, setCreneaux] = useState<CreneauType[]>([]);
  const [mesGardes, setMesGardes] = useState<Affectation[]>([]);
  const [postes, setPostes] = useState<PosteVehicule[]>([]);
  const [vehicules, setVehicules] = useState<Vehicule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [weekAnchor, setWeekAnchor] = useState(todayIso());
  const weekStart = useMemo(() => mondayOf(weekAnchor), [weekAnchor]);
  const weekDays = useMemo(() => weekDaysFrom(weekStart), [weekStart]);

  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [formCreneau, setFormCreneau] = useState('');
  const [formDebut, setFormDebut] = useState('07:00');
  const [formFin, setFormFin] = useState('19:00');

  function load() {
    if (!agent) return;
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
        if (c.length > 0) setFormCreneau(c[0].id);
      })
      .catch(() => setError('Impossible de charger tes disponibilités.'))
      .finally(() => setLoading(false));
  }

  useEffect(load, [agent]);

  const { vehiculeNomForPoste, posteNom } = buildPosteVehiculeLookup(postes, vehicules);

  function dispoOn(day: string): Disponibilite | undefined {
    return dispos.find((d) => d.date === day);
  }

  function openDay(day: string) {
    setSelectedDay(day);
    setError(null);
    const existing = dispoOn(day);
    if (existing?.creneau_type_id) {
      setFormCreneau(existing.creneau_type_id);
    } else if (existing) {
      setFormCreneau('');
      setFormDebut(existing.heure_debut_perso ?? '07:00');
      setFormFin(existing.heure_fin_perso ?? '19:00');
    } else {
      setFormCreneau(creneaux[0]?.id ?? '');
      setFormDebut('07:00');
      setFormFin('19:00');
    }
  }

  async function handleSave() {
    if (!agent || !selectedDay) return;
    setError(null);
    try {
      const existing = dispoOn(selectedDay);
      if (existing) await deleteDisponibilite(existing.id);
      await setDisponibilite({
        agentId: agent.id,
        date: selectedDay,
        statut: 'disponible',
        creneauTypeId: formCreneau || undefined,
        heureDebutPerso: formCreneau ? undefined : formDebut,
        heureFinPerso: formCreneau ? undefined : formFin,
      });
      setDispos(await fetchDisponibilites(agent.id, daysAgo(90), inDays(180)));
      setSelectedDay(null);
    } catch {
      setError("Impossible d'enregistrer cette disponibilité.");
    }
  }

  async function handleDelete() {
    const existing = selectedDay ? dispoOn(selectedDay) : undefined;
    if (!agent || !existing) return;
    setError(null);
    try {
      await deleteDisponibilite(existing.id);
      setDispos(await fetchDisponibilites(agent.id, daysAgo(90), inDays(180)));
      setSelectedDay(null);
    } catch {
      setError('Impossible de supprimer cette disponibilité.');
    }
  }

  if (loading) return <Spinner />;

  return (
    <div className="stack">
      <PageHeader title="Mes disponibilités" sub="Clique sur un jour pour te déclarer disponible (ou retirer ta dispo)." />
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
          <strong style={{ fontSize: 13 }}>Semaine du {weekStart}</strong>
          <div style={{ display: 'flex', gap: 6 }}>
            <Button variant="secondary" onClick={() => setWeekAnchor(addDays(weekStart, -7))}>◀ Précédente</Button>
            <Button variant="secondary" onClick={() => setWeekAnchor(todayIso())}>Aujourd'hui</Button>
            <Button variant="secondary" onClick={() => setWeekAnchor(addDays(weekStart, 7))}>Suivante ▶</Button>
          </div>
        </div>

        <div className="dispo-agenda">
          {weekDays.map((day) => {
            const d = dispoOn(day);
            return (
              <button key={day} className={`dispo-agenda-cell ${d ? 'tone-green' : 'tone-empty'}`} onClick={() => openDay(day)}>
                <span className="dispo-agenda-day">{dayLabel(day)}</span>
                {d ? (
                  <span className="dispo-agenda-hours mono">{formatHoraire(d, creneaux)}</span>
                ) : (
                  <span className="dispo-agenda-add">+ ajouter</span>
                )}
              </button>
            );
          })}
        </div>
      </Card>

      {selectedDay && (
        <Card accent="brand">
          <strong style={{ fontSize: 13 }}>{dayLabelLong(selectedDay)}</strong>
          <div className="stack-sm" style={{ marginTop: 12 }}>
            <Field label="Créneau">
              <select className="input" value={formCreneau} onChange={(e) => setFormCreneau(e.target.value)}>
                <option value="">Personnalisé</option>
                {creneaux.map((c) => (
                  <option key={c.id} value={c.id}>{c.nom} ({c.heure_debut}–{c.heure_fin})</option>
                ))}
              </select>
            </Field>
            {!formCreneau && (
              <div className="field-row">
                <Field label="Début">
                  <input type="time" className="input" value={formDebut} onChange={(e) => setFormDebut(e.target.value)} />
                </Field>
                <Field label="Fin">
                  <input type="time" className="input" value={formFin} onChange={(e) => setFormFin(e.target.value)} />
                </Field>
              </div>
            )}
            <div className="field-row">
              <Button onClick={handleSave}>Enregistrer</Button>
              {dispoOn(selectedDay) && <Button variant="secondary" onClick={handleDelete}>Retirer ma dispo</Button>}
              <Button variant="secondary" onClick={() => setSelectedDay(null)}>Annuler</Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
