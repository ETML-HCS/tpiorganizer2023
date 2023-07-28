import React, { useState, useEffect } from "react";
import { format } from "date-fns";

const initialState = {
  refTpi: "",
  candidat: "",
  expert1: "",
  expert2: "",
  boss: "",
  sujet: "",
  description: "",
  tags: "",
  lieu: "",
  dateSoutenance: "",
  dateDepart: "",
  dateFin: "",
  date1ereVisite: "",
  date2emeVisite: "",
  dateRenduFinal: "",
  lienDepot: "",
  noteEvaluation: "",
  lienEvaluation: "",
};

const TpiForm = ({ onSave, tpiToLoad,onClose }) => {
  const [cancelled, setCancelled] = useState(false);
  const [saved, setSaved] = useState(false);
  const [formData, setFormData] = useState(initialState);

  useEffect(() => {
    if (tpiToLoad) {
      console.log(tpiToLoad.dateDepart);
      const formattedTpiToLoad = {
        ...tpiToLoad,
        dateSoutenance: formatDate(tpiToLoad.dateSoutenance),
        dateDepart: formatDate(tpiToLoad.dateDepart),
        dateFin: formatDate(tpiToLoad.dateFin),
        date1ereVisite: formatDate(tpiToLoad.date1ereVisite),
        date2emeVisite: formatDate(tpiToLoad.date2emeVisite),
        dateRenduFinal: formatDate(tpiToLoad.dateRenduFinal),
      };
      setFormData(formattedTpiToLoad);
    }
  }, [tpiToLoad]);

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

  const resetForm = () => {
    setFormData(initialState);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
    setSaved(true);
    resetForm();
  };

  const handleCancel = () => {
    resetForm();
    setCancelled(true);
    onClose(true);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  return (
    <>
      {!cancelled && (
        <div className="containerForm">
          <form onSubmit={handleSubmit}>
            <div className="gpRef">
              <div className="form-row">
                <label>Ref TPI:</label>
                <input
                  type="text"
                  name="refTpi"
                  value={formData.refTpi}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-row">
                <label>Tags:</label>
                <input
                  type="text"
                  name="tags"
                  value={formData.tags}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            <div className="gpPerson">
              <div className="form-row">
                <label>Candidat:</label>
                <input
                  type="text"
                  name="candidat"
                  value={formData.candidat}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-row">
                <label>Expert 1:</label>
                <input
                  type="text"
                  name="expert1"
                  value={formData.expert1}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-row">
                <label>Expert 2:</label>
                <input
                  type="text"
                  name="expert2"
                  value={formData.expert2}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-row">
                <label>Chef(fe) de projet:</label>
                <input
                  type="text"
                  name="boss"
                  value={formData.boss}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            <div className="gpSujetTpi">
              <div className="form-row">
                <label>Sujet:</label>
                <input
                  type="text"
                  name="sujet"
                  value={formData.sujet}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-row">
                <label>Description:</label>
                <input
                  type="text"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-row">
                <label>Lieu:</label>
                <input
                  type="text"
                  name="lieu"
                  value={formData.lieu}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            <div className="grExterne">
              <div className="form-row">
                <label>Liens du dépot git:</label>
                <input
                  type="text"
                  name="lienDepot"
                  value={formData.lienDepot}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-row">
                <label>Note de l'évaluation:</label>
                <input
                  type="number"
                  min="1"
                  max="6"
                  name="noteEvaluation"
                  value={formData.noteEvaluation}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-row">
                <label>Liens vers l'évaluation:</label>
                <input
                  type="text"
                  name="lienEvaluation"
                  value={formData.lienEvaluation}
                  onChange={handleInputChange}
                />
              </div>
            </div>
            <div className="gpDates">
              <div className="form-row">
                <label>Date de départ:</label>
                <input
                  type="date"
                  name="dateDepart"
                  value={formData.dateDepart}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-row">
                <label>Date de fin:</label>
                <input
                  type="date"
                  name="dateFin"
                  value={formData.dateFin}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-row">
                <label>Date 1ère visite:</label>
                <input
                  type="date"
                  name="date1ereVisite"
                  value={formData.date1ereVisite}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-row">
                <label>Date 2ème visite:</label>
                <input
                  type="date"
                  name="date2emeVisite"
                  value={formData.date2emeVisite}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-row">
                <label>Date rendu final:</label>
                <input
                  type="date"
                  name="dateRenduFinal"
                  value={formData.dateRenduFinal}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-row">
                <label>Date de soutenance:</label>
                <input
                  type="date"
                  name="dateSoutenance"
                  value={formData.dateSoutenance}
                  onChange={handleInputChange}
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
      )}
    </>
  );
};

export default TpiForm;
