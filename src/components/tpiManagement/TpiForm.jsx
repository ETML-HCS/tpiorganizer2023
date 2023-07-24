import React, { useState, useEffect } from "react";

const TpiForm = ({ onSave, tpiToLoad }) => {
  
  const [saved, setSaved] = useState(false);

  const [refTpi, setRefTpi] = useState("");
  const [candidat, setCandidat] = useState("");
  const [expert1, setExpert1] = useState("");
  const [expert2, setExpert2] = useState("");
  const [boss, setBoss] = useState("");
  const [sujet, setSujet] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
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
    if (saved) {
      window.location.reload();
    }
  }, [saved]);

  useEffect(() => {
    // Si tpiToLoad est fourni, chargez les détails du TPI depuis tpiToLoad
    if (tpiToLoad) {
      const {
        refTpi,
        candidat,
        expert1,
        expert2,
        boss,
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
      setSujet(sujet);
      setDescription(description);
      setTags(tags);
      setDateSoutenance(dateSoutenance);
      setDateDepart(dateDepart);
      setDateFin(dateFin);
      setDate1ereVisite(date1ereVisite);
      setDate2emeVisite(date2emeVisite);
      setDateRenduFinal(dateRenduFinal);
      setLienDepot(lienDepot);
      setNoteEvaluation(noteEvaluation);
      setLienEvaluation(lienEvaluation);
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
        </div>

        <div className="grExterne">
          <div className="form-row">
            <label>Liens du dépot git:</label>
            <input
              type="text"
              min="1"
              max="6"
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
          <button type="submit">Enregistrer</button>
        </div>
      </form>
    </div>
  );
};

export default TpiForm;
