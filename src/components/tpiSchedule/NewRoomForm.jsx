import React, { useEffect, useMemo, useState } from "react";
import { showNotification } from "../Tools.jsx";
import {
  applySoutenanceDateYear,
  formatSoutenanceDateLabel,
  getSoutenanceDateBadgeLabel,
  normalizeSoutenanceDateEntries
} from "./soutenanceDateUtils";

const normalizeRoomNameKey = (value) => String(value || "").trim().toLowerCase();
const normalizeDateInputValue = (value) => {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) {
    return text.slice(0, 10);
  }

  return date.toISOString().slice(0, 10);
};

const NewRoomForm = ({
  onNewRoom,
  setShowForm,
  configData,
  soutenanceDates = [],
  roomCatalogBySite = {},
  existingRooms = [],
  selectedYear = null
}) => {
  const availableDates = useMemo(() => normalizeSoutenanceDateEntries(soutenanceDates), [soutenanceDates])
  const availableSites = useMemo(() => {
    const source = roomCatalogBySite && typeof roomCatalogBySite === "object" ? roomCatalogBySite : {}
    return Object.keys(source)
      .map((site) => String(site || "").trim().toUpperCase())
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right))
  }, [roomCatalogBySite])
  const [date, setDate] = useState("")
  const [nameRoom, setNameRoom] = useState("");
  const [site, setSite] = useState("");
  const usedRoomNameKeys = useMemo(() => {
    const selectedSite = String(site || "").trim().toUpperCase();
    const selectedDate = normalizeDateInputValue(date);

    if (!selectedSite || !selectedDate) {
      return new Set();
    }

    const usedKeys = new Set();

    (Array.isArray(existingRooms) ? existingRooms : []).forEach((room) => {
      const roomSite = String(room?.site || "").trim().toUpperCase();
      const roomDate = normalizeDateInputValue(room?.date);
      const roomNameKey = normalizeRoomNameKey(room?.name || room?.nameRoom);

      if (!roomNameKey) {
        return;
      }

      if (roomSite === selectedSite && roomDate === selectedDate) {
        usedKeys.add(roomNameKey);
      }
    });

    return usedKeys;
  }, [date, existingRooms, site]);

  const availableRooms = useMemo(() => {
    const hasCatalogRooms = Object.prototype.hasOwnProperty.call(roomCatalogBySite || {}, site)
    const catalogRooms = hasCatalogRooms ? roomCatalogBySite?.[site] || [] : []
    const normalizedCatalogRooms = Array.from(
      new Set(catalogRooms.map((room) => String(room || "").trim()).filter(Boolean))
    );
    if (!hasCatalogRooms) {
      return [];
    }

    return normalizedCatalogRooms.filter(
      (roomName) => !usedRoomNameKeys.has(normalizeRoomNameKey(roomName))
    );
  }, [roomCatalogBySite, site, usedRoomNameKeys]);

  useEffect(() => {
    if (availableDates.length === 0) {
      setDate("")
      return
    }

    if (date && availableDates.some((entry) => entry.date === date)) {
      return
    }

    const yearAdjustedDate = applySoutenanceDateYear(date, selectedYear)
    if (yearAdjustedDate && availableDates.some((entry) => entry.date === yearAdjustedDate)) {
      setDate(yearAdjustedDate)
      return
    }

    if (!date) {
      setDate(availableDates[0]?.date || "")
    }
  }, [availableDates, date, selectedYear])

  useEffect(() => {
    if (availableSites.length === 0) {
      setSite("")
      return
    }

    if (!availableSites.includes(site)) {
      setSite(availableSites[0])
    }
  }, [availableSites, site])

  useEffect(() => {
    if (!nameRoom) {
      return;
    }

    const selectedNameKey = normalizeRoomNameKey(nameRoom);
    const isAvailable = availableRooms.some(
      (roomName) => normalizeRoomNameKey(roomName) === selectedNameKey
    );

    if (!isAvailable) {
      setNameRoom("");
    }
  }, [availableRooms, nameRoom]);

  const handleFormSubmit = (e) => {
    e.preventDefault();

    if (date && nameRoom && site) {
      onNewRoom({ date, nameRoom, site });
      setShowForm(false);
      setDate("");
      setNameRoom("");
      setSite("");
    } else {
      showNotification(
        "Renseigne la date, le site et la salle avant de valider.",
        3000
      );
    }
  };

  const handleCancel = () => {
    setDate("");
    setNameRoom("");
    setSite("");
    setShowForm(false);
  };

  const handleSiteChange = (e) => {
    const selectedSite = e.target.value;
    setSite(selectedSite);
    setNameRoom("");
  };

  const submitDisabledReason =
    availableDates.length === 0
      ? "Ajoute d'abord des dates de défense"
      : availableSites.length === 0
        ? "Ajoute d'abord des sites"
      : availableRooms.length === 0
        ? "Aucune salle disponible pour cette date et ce site"
        : undefined

  return (
    <form className="addRoom room-add-form" onSubmit={handleFormSubmit}>
      <div className="room-add-grid">
        <label className="page-tools-field room-add-field" htmlFor="date">
          <span className="page-tools-field-label">Date</span>
          <select
            className="page-tools-field-control"
            id="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            disabled={availableDates.length === 0}
          >
            <option value="">
              {availableDates.length > 0 ? "Sélectionner une date" : "Ajoute d'abord des dates"}
            </option>
            {availableDates.map((availableDate) => (
              (() => {
                const badgeLabel = getSoutenanceDateBadgeLabel(availableDate)

                return (
                  <option key={availableDate.date} value={availableDate.date}>
                    {`${formatSoutenanceDateLabel(availableDate.date)}${badgeLabel ? ` • ${badgeLabel}` : ""}`}
                  </option>
                )
              })()
            ))}
          </select>
        </label>

        <label className="page-tools-field room-add-field" htmlFor="site">
          <span className="page-tools-field-label">Site</span>
          <select className="page-tools-field-control" id="site" value={site} onChange={handleSiteChange} required disabled={availableSites.length === 0}>
            <option value="">
              {availableSites.length > 0 ? "Sélectionner" : "Ajoute d'abord des sites"}
            </option>
            {availableSites.map((siteCode) => (
              <option key={siteCode} value={siteCode}>
                {siteCode}
              </option>
            ))}
          </select>
        </label>

        <label className="page-tools-field room-add-field" htmlFor="availableRooms">
          <span className="page-tools-field-label">Salle</span>
          <select
            className="page-tools-field-control"
            id="availableRooms"
            value={nameRoom}
            onChange={(e) => setNameRoom(e.target.value)}
            required
            disabled={!site || !date || availableRooms.length === 0}
          >
            <option value="">
              {site && date
                ? (availableRooms.length > 0 ? 'Sélectionner une salle' : 'Ajoute des noms de salles')
                : 'Choisir un site et une date'}
            </option>
            {availableRooms.map((availableRoom) => (
              <option key={availableRoom} value={availableRoom}>
                {availableRoom}
              </option>
            ))}
          </select>
        </label>

      </div>

      <div className="room-add-actions">
        <button type="button" className="page-tools-action-btn secondary" onClick={handleCancel}>
          Annuler
        </button>
        <button
          type="submit"
          className="page-tools-action-btn primary"
          disabled={Boolean(submitDisabledReason)}
          title={submitDisabledReason}
        >
          Valider
        </button>
      </div>
    </form>
  );
};

export default NewRoomForm;
