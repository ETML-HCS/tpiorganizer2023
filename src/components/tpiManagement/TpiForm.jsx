import React, { useState, useEffect } from "react";
import { format, parseISO } from "date-fns";

const TpiForm = ({ onSave, tpiToLoad }) => {
  const [cancelled, setCancelled] = useState(false);
  const [saved, setSaved] = useState(false);

  const [refTpi, setRefTpi] = useState("");
  const [candidat, setCandidat] = useState("");

  const [expert1, setExpert1] = useState("");
  const [expert2, setExpert2] = useState("");
  const [boss, setBoss] = useState("");

  const [sujet, setSujet] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [lieu, setLieu] = useState("");

  const [dateSoutenance, setDateSoutenance] = useState("");
  const [dateDepart, setDateDepart] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [date1ereVisite, setDate1ereVisite] = useState("");
  const [date2emeVisite, setDate2emeVisite] = useState("");
  const [dateRenduFinal, setDateRenduFinal] = useState("");

  const [lienDepot, setLienDepot] = useState("");
  const [noteEvaluation, setNoteEvaluation] = useState("");
  const [lienEvaluation, setLienEvaluation] = useState("");

  // Utiliser useEffect pour rafraîchir la page lorsque 'saved' devient true
  useEffect(() => {
    if (saved || cancelled) {
      window.location.reload();
    }
  }, [saved, cancelled]);

  useEffect(() => {
    // Si tpiToLoad est fourni, chargez les détails du TPI depuis tpiToLoad
    console.log(tpiToLoad.dateDepart);
    if (tpiToLoad) {
      const {
        refTpi,
        candidat,
        expert1,
        expert2,
        boss,
        lieu,
        sujet,
        description,
        tags,
        dateSoutenance,
        dateDepart,
        dateFin,
        date1ereVisite,
        date2emeVisite,
        dateRenduFinal,
        lienDepot,
        noteEvaluation,
        lienEvaluation,
      } = tpiToLoad;

      setRefTpi(refTpi);
      setCandidat(candidat);
      setExpert1(expert1);
      setExpert2(expert2);
      setBoss(boss);
      setLieu(lieu);
      setSujet(sujet);
      setDescription(description);
      setTags(tags);

      const formatDate = (dateStr) => {
        if (!dateStr) {
          return "";
        }

        const dateISO = dateStr.slice(2, 12); // "202023-05-07"
        const year = parseInt(dateISO.slice(0, 4));
        const month = parseInt(dateISO.slice(5, 7)) - 1;
        const day = parseInt(dateISO.slice(8, 10));
        const dateObject = new Date(year, month, day);

        return format(dateObject, "yyyy-MM-dd");
      };

      setDateSoutenance(formatDate(dateSoutenance));
      setDateDepart(formatDate(dateDepart));
      setDateFin(formatDate(dateFin));
      setDate1ereVisite(formatDate(date1ereVisite));
      setDate2emeVisite(formatDate(date2emeVisite));
      setDateRenduFinal(formatDate(dateRenduFinal));

      setLienDepot(lienDepot);
      setLienDepot(lienDepot);
      setNoteEvaluation(noteEvaluation);
      setLienEvaluation(lienEvaluation);
      console.log(tpiToLoad);
    }
  }, [tpiToLoad]);

  const handleSubmit = (e) => {
    e.preventDefault();

    // Créer un objet avec les données saisies
    const tpiData = {
      refTpi,
      candidat,
      expert1,
      expert2,
      boss,
      sujet,
      description,
      tags,
      lieu,
      dateSoutenance,
      dateDepart,
      dateFin,
      date1ereVisite,
      date2emeVisite,
      dateRenduFinal,
      lienDepot,
      noteEvaluation,
      lienEvaluation,
    };

    // Appeler la fonction onSave pour sauvegarder les données
    onSave(tpiData);

    // Réinitialiser les champs du formulaire
    setRefTpi("");
    setCandidat("");
    setExpert1("");
    setExpert2("");
    setBoss("");
    setSujet("");
    setDescription("");
    setTags("");
    setLieu("");
    setDateSoutenance("");
    setDateDepart("");
    setDateFin("");
    setDate1ereVisite("");
    setDate2emeVisite("");
    setDateRenduFinal("");
    setLienDepot("");
    setNoteEvaluation("");
    setLienEvaluation("");

    setSaved(true);
  };

  // Function to handle cancellation
  const handleCancel = () => {
    // Reset all the form fields
    setRefTpi("");
    setCandidat("");
    setExpert1("");
    setExpert2("");
    setBoss("");
    setSujet("");
    setDescription("");
    setTags("");
    setLieu("");
    setDateSoutenance("");
    setDateDepart("");
    setDateFin("");
    setDate1ereVisite("");
    setDate2emeVisite("");
    setDateRenduFinal("");
    setLienDepot("");
    setNoteEvaluation("");
    setLienEvaluation("");

    // Set the cancelled state to true
    setCancelled(true);
  };

  return (
    <div className="containerForm">
      <form onSubmit={handleSubmit}>
        <div className="gpRef">
          <div className="form-row">
            <label>Ref TPI:</label>
            <input
              type="text"
              value={refTpi}
              onChange={(e) => setRefTpi(e.target.value)}
            />
          </div>
          <div className="form-row">
            <label>Tags:</label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
            />
          </div>
        </div>

        <div className="gpPerson">
          <div className="form-row">
            <label>Candidat:</label>
            <input
              type="text"
              value={candidat}
              onChange={(e) => setCandidat(e.target.value)}
            />
          </div>
          <div className="form-row">
            <label>Expert 1:</label>
            <input
              type="text"
              value={expert1}
              onChange={(e) => setExpert1(e.target.value)}
            />
          </div>
          <div className="form-row">
            <label>Expert 2:</label>
            <input
              type="text"
              value={expert2}
              onChange={(e) => setExpert2(e.target.value)}
            />
          </div>
          <div className="form-row">
            <label>Chef(fe) de projet:</label>
            <input
              type="text"
              value={boss}
              onChange={(e) => setBoss(e.target.value)}
            />
          </div>
        </div>

        <div className="gpSujetTpi">
          <div className="form-row">
            <label>Sujet:</label>
            <input
              type="text"
              value={sujet}
              onChange={(e) => setSujet(e.target.value)}
            />
          </div>
          <div className="form-row">
            <label>Description:</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="form-row">
            <label>Lieu:</label>
            <input
              type="text"
              value={lieu}
              onChange={(e) => setLieu(e.target.value)}
            />
          </div>
        </div>

        <div className="grExterne">
          <div className="form-row">
            <label>Liens du dépot git:</label>
            <input
              type="text"
              min="1.0"
              max="6.o"
              value={lienDepot}
              onChange={(e) => setLienDepot(e.target.value)}
            />
          </div>
          <div className="form-row">
            <label>Note de l'évaluation:</label>
            <input
              type="number"
              min="1"
              max="6"
              value={noteEvaluation}
              onChange={(e) => setNoteEvaluation(e.target.value)}
            />
          </div>
          <div className="form-row">
            <label>Liens vers l'évaluation:</label>
            <input
              type="text"
              value={lienEvaluation}
              onChange={(e) => setLienEvaluation(e.target.value)}
            />
          </div>
        </div>
        <div className="gpDates">
          <div className="form-row">
            <label>Date de départ:</label>
            <input
              type="date"
              value={dateDepart}
              onChange={(e) => setDateDepart(e.target.value)}
            />
          </div>
          <div className="form-row">
            <label>Date de fin:</label>
            <input
              type="date"
              value={dateFin}
              onChange={(e) => setDateFin(e.target.value)}
            />
          </div>
          <div className="form-row">
            <label>Date 1ère visite:</label>
            <input
              type="date"
              value={date1ereVisite}
              onChange={(e) => setDate1ereVisite(e.target.value)}
            />
          </div>
          <div className="form-row">
            <label>Date 2ème visite:</label>
            <input
              type="date"
              value={date2emeVisite}
              onChange={(e) => setDate2emeVisite(e.target.value)}
            />
          </div>
          <div className="form-row">
            <label>Date rendu final:</label>
            <input
              type="date"
              value={dateRenduFinal}
              onChange={(e) => setDateRenduFinal(e.target.value)}
            />
          </div>
          <div className="form-row">
            <label>Date de soutenance:</label>
            <input
              type="date"
              value={dateSoutenance}
              onChange={(e) => setDateSoutenance(e.target.value)}
            />
          </div>
        </div>

        <div className="form-row save">
          <button id="btConcel" type="button" onClick={handleCancel}>
            Annuler
          </button>
          <button type="submit">Enregistrer</button>
        </div>
      </form>
    </div>
  );
};

export default TpiForm;
