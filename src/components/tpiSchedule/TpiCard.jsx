/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useLayoutEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { useDrag } from "react-dnd";
import { ItemTypes } from "./Constants";
import { getTpiModels } from "../tpiControllers/TpiController";
import { normalizeTpi } from "./tpiScheduleData";
import {
  inferRoomClassMode,
  matchesClassFilterForRoom
} from "./tpiScheduleFilters";
import {
  CalendarIcon,
  CandidateIcon,
  ExpertIcon,
  ProjectLeadIcon
} from "../shared/InlineIcons";
import {
  formatPreferredSoutenanceChoiceLabel,
  getPreferredSoutenanceChoicesForPerson
} from "../../utils/preferredSoutenanceUtils";

const PREFERENCE_INDICATOR_COPY = Object.freeze({
  green: {
    ariaLabel: "Préférence respectée",
    title: "Préférence respectée"
  },
  orange: {
    ariaLabel: "Préférences compatibles",
    title: "Préférences compatibles"
  },
  red: {
    ariaLabel: "Préférence non respectée",
    title: "Préférence non respectée"
  }
});

const AFTERNOON_START_MINUTES = 12 * 60 + 30;
const FALLBACK_MORNING_PERIOD_COUNT = 4;

const getYearFromRoomDate = (value) => {
  const normalizedValue = String(value || "").trim();

  if (!normalizedValue) {
    return new Date().getFullYear();
  }

  const isoMatch = normalizedValue.match(/^(\d{4})-\d{2}-\d{2}/);
  if (isoMatch) {
    const parsedYear = Number.parseInt(isoMatch[1], 10);
    if (Number.isInteger(parsedYear)) {
      return parsedYear;
    }
  }

  const parsedDate = new Date(normalizedValue);
  if (!Number.isNaN(parsedDate.getTime())) {
    return parsedDate.getFullYear();
  }

  return new Date().getFullYear();
};

const normalizeLookupValue = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const formatRegistryPersonLabel = (person) =>
  [person?.firstName, person?.lastName].filter(Boolean).join(" ").trim();

const buildPersonNameKey = (firstName, lastName) => {
  const normalizedFirstName = normalizeLookupValue(firstName);
  const normalizedLastName = normalizeLookupValue(lastName);

  if (!normalizedFirstName && !normalizedLastName) {
    return "";
  }

  return `${normalizedFirstName}|${normalizedLastName}`;
};

const buildNameVariantKeys = (value) => {
  const parts = normalizeLookupValue(value)
    .split(" ")
    .filter(Boolean);

  if (parts.length < 2) {
    return [];
  }

  const firstName = parts[0];
  const lastName = parts.slice(1).join(" ");

  return [
    buildPersonNameKey(firstName, lastName),
    buildPersonNameKey(lastName, firstName)
  ].filter(Boolean);
};

const getStakeholderHintKey = (role, name) => {
  const normalizedName = normalizeLookupValue(name);

  if (!role || !normalizedName) {
    return "";
  }

  return `${role}|${normalizedName}`;
};

const getPersonShortIdPrefix = (person) => {
  const roles = Array.isArray(person?.roles)
    ? person.roles.map((role) => String(role || "").trim().toLowerCase()).filter(Boolean)
    : [];
  const roleSet = new Set(roles);

  if (roleSet.size > 1) {
    return "M";
  }

  if (roleSet.has("expert")) {
    return "E";
  }

  if (roleSet.has("chef_projet")) {
    return "P";
  }

  if (roleSet.has("candidat")) {
    return "C";
  }

  if (roleSet.has("admin")) {
    return "A";
  }

  return "S";
};

const formatPersonShortIdNumber = (person) => {
  const parsedShortId = Number.parseInt(person?.shortId, 10);

  if (!Number.isInteger(parsedShortId) || parsedShortId <= 0) {
    return "";
  }

  return String(parsedShortId).padStart(3, "0");
};

const formatRegistryPersonShortId = (person) => {
  const shortIdNumber = formatPersonShortIdNumber(person);

  if (!shortIdNumber) {
    return "";
  }

  return `${getPersonShortIdPrefix(person)}-${shortIdNumber}`;
};

const findRegistryPersonByObjectId = (people, personId) => {
  const normalizedPersonId = String(personId || "").trim();

  if (!normalizedPersonId) {
    return null;
  }

  return (Array.isArray(people) ? people : []).find(
    (person) => String(person?._id || "").trim() === normalizedPersonId
  ) || null;
};

const personHasRole = (person, role) => {
  if (!role) {
    return true;
  }

  const roles = Array.isArray(person?.roles) ? person.roles : [];
  return roles.some((value) => String(value || "").trim() === role);
};

const personMatchesPlanningYear = (person, role, year) => {
  if (role !== "candidat" || !Number.isInteger(year)) {
    return true;
  }

  const candidateYears = Array.isArray(person?.candidateYears)
    ? person.candidateYears
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value))
    : [];

  if (candidateYears.length === 0) {
    return true;
  }

  return candidateYears.includes(year);
};

const resolveUniqueRegistryPerson = (people, value, role, year) => {
  const normalizedValue = normalizeLookupValue(value);
  const nameVariantKeys = buildNameVariantKeys(value);

  if (!normalizedValue) {
    return null;
  }

  const matches = (Array.isArray(people) ? people : []).filter((person) => {
    if (!person || person.isActive === false) {
      return false;
    }

    if (!personHasRole(person, role) || !personMatchesPlanningYear(person, role, year)) {
      return false;
    }

    const displayName = normalizeLookupValue(formatRegistryPersonLabel(person));
    const personNameKey = buildPersonNameKey(person?.firstName, person?.lastName);
    const email = normalizeLookupValue(person?.email);

    return (
      displayName === normalizedValue ||
      email === normalizedValue ||
      nameVariantKeys.includes(personNameKey)
    );
  });

  return matches.length === 1 ? matches[0] : null;
};

const normalizeDateKey = (value) => {
  const normalizedValue = String(value || "").trim();

  if (!normalizedValue) {
    return "";
  }

  const isoMatch = normalizedValue.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) {
    return isoMatch[1];
  }

  const parsedDate = new Date(normalizedValue);
  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  return parsedDate.toISOString().slice(0, 10);
};

const normalizeDateKeyList = (values = []) => {
  const normalizedValues = [];
  const seen = new Set();

  for (const value of (Array.isArray(values) ? values : [values])) {
    const dateKey = normalizeDateKey(value);

    if (!dateKey || seen.has(dateKey)) {
      continue;
    }

    seen.add(dateKey);
    normalizedValues.push(dateKey);
  }

  return normalizedValues;
};

const formatDateKeyLabel = (value) => {
  const dateKey = normalizeDateKey(value);

  if (!dateKey) {
    return "";
  }

  const [year, month, day] = dateKey.split("-");
  return `${day}.${month}.${year}`;
};

const resolvePeriodStartMinutes = (period, scheduleContext = null) => {
  const normalizedPeriod = Number.parseInt(period, 10);

  if (!Number.isInteger(normalizedPeriod) || normalizedPeriod <= 0) {
    return null;
  }

  const firstTpiStartMinutes = Number(scheduleContext?.firstTpiStartMinutes);
  const tpiDurationMinutes = Number(scheduleContext?.tpiDurationMinutes);
  const breakDurationMinutes = Number(scheduleContext?.breakDurationMinutes ?? 0);

  if (!Number.isFinite(firstTpiStartMinutes) || !Number.isFinite(tpiDurationMinutes)) {
    return null;
  }

  return firstTpiStartMinutes + (normalizedPeriod - 1) * (
    tpiDurationMinutes + (Number.isFinite(breakDurationMinutes) ? breakDurationMinutes : 0)
  );
};

const resolvePeriodHalfDay = (period, scheduleContext = null) => {
  const startMinutes = resolvePeriodStartMinutes(period, scheduleContext);

  if (Number.isFinite(startMinutes)) {
    return startMinutes >= AFTERNOON_START_MINUTES ? "afternoon" : "morning";
  }

  const normalizedPeriod = Number.parseInt(period, 10);

  if (!Number.isInteger(normalizedPeriod) || normalizedPeriod <= 0) {
    return null;
  }

  return normalizedPeriod <= FALLBACK_MORNING_PERIOD_COUNT ? "morning" : "afternoon";
};

const PreferenceTriangleIcon = (props) => (
  <svg viewBox="0 0 20 18" aria-hidden="true" focusable="false" {...props}>
    <path
      d="M10 2 18 16H2Z"
      fill="currentColor"
      stroke="rgba(255, 255, 255, 0.94)"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
  </svg>
);

const TpiCard = ({
  tpi,
  isEditingTpiCard,
  onUpdateTpi,
  detailLevel = 2,
  roomSite = '',
  roomName = '',
  roomDate = '',
  roomPeriod = null,
  roomScheduleContext = null,
  peopleRegistry = [],
  stakeholderShortIdHints = {},
  soutenanceDates = [],
  hasValidationError = false,
  validationErrorMessages = []
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [editedTpi, setEditedTpi] = useState(() => normalizeTpi(tpi));
  const [allTpiList, setAllTpiList] = useState([]);
  const [selectedCandidate, setSelectedCandidate] = useState("");
  const [assignedRefTpis, setAssignedRefTpis] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const refTpiContainerRef = useRef(null);
  const searchInputRef = useRef(null);
  const [isSelectOpen, setIsSelectOpen] = useState(false);
  const safeTpi = editedTpi || normalizeTpi(tpi);
  const roomYear = useMemo(() => getYearFromRoomDate(roomDate), [roomDate]);

  const handleToggleSelect = () => {
    setIsSelectOpen((prevState) => {
      const nextOpen = !prevState;
      if (nextOpen) {
        setSearchQuery("");
      }
      return nextOpen;
    });
  };

  // Mapping site prop to lieu.entreprise values used in the TPI model
  const mapSiteToEntreprise = (site) => {
    const s = String(site || "").trim().toUpperCase();
    if (s === "ETML") return "ETML";
    if (s === "CFPV") return "ETML"; // CFPV cards also use 'ETML' in lieu.entreprise
    return s;
  };

  const roomDateEntry = useMemo(() => {
    if (!roomDate || !Array.isArray(soutenanceDates) || soutenanceDates.length === 0) {
      return null;
    }

    const normalizedRoomDate = roomDate.slice(0, 10);
    return soutenanceDates.find((d) => d.date === normalizedRoomDate) || null;
  }, [roomDate, soutenanceDates]);

  // Find the class prefixes allowed for the current room date
  const roomDateClassPrefixes = useMemo(() => {
    return Array.isArray(roomDateEntry?.classes) ? roomDateEntry.classes : [];
  }, [roomDateEntry]);

  const readAssignedRefTpisFromDom = () => {
    if (typeof document === "undefined") {
      return [];
    }

    return Array.from(document.getElementsByClassName("refTpi"))
      .map((element) => String(element.textContent || "").trim())
      .filter(Boolean);
  };

  const syncAssignedRefTpis = () => {
    const nextAssignedRefs = readAssignedRefTpisFromDom();
    setAssignedRefTpis((currentAssignedRefs) => {
      if (
        currentAssignedRefs.length === nextAssignedRefs.length &&
        currentAssignedRefs.every((value, index) => value === nextAssignedRefs[index])
      ) {
        return currentAssignedRefs;
      }

      return nextAssignedRefs;
    });
  };

  useEffect(() => {
    syncAssignedRefTpis();
  }, [roomYear, roomDateEntry, safeTpi.refTpi]);

  useEffect(() => {
    if (isSelectOpen) {
      syncAssignedRefTpis();
    }
  }, [isSelectOpen]);

  useEffect(() => {
    // Vérifie si un candidat est sélectionné et si la liste des TPI (Travaux Pratiques Individuels) existe et n'est pas vide
    if (selectedCandidate && allTpiList && allTpiList.length > 0) {
      // Trouve le TPI correspondant au candidat sélectionné
      const selectedTpi = allTpiList.find(
        (item) => item.refTpi === selectedCandidate
      );

      // Si un TPI correspondant est trouvé
      if (selectedTpi) {
        const updatedTpi = normalizeTpi({
          ...editedTpi,
          refTpi: selectedTpi.refTpi, // Met à jour la référence du TPI
          candidat: selectedTpi.candidat, // Met à jour le candidat associé
          candidatPersonId: selectedTpi.candidatPersonId || "",
          expert1: {
            name: selectedTpi.experts?.[1] || "",
            personId: selectedTpi.expert1PersonId || ""
          }, // Met à jour le premier expert
          expert2: {
            name: selectedTpi.experts?.[2] || "",
            personId: selectedTpi.expert2PersonId || ""
          }, // Met à jour le deuxième expert
          boss: {
            name: selectedTpi.boss || "",
            personId: selectedTpi.bossPersonId || ""
          }, // Met à jour l'encadrant
        });

        // Met à jour l'état du TPI édité avec les informations du TPI sélectionné
        setEditedTpi(updatedTpi);
        if (typeof onUpdateTpi === "function") {
          onUpdateTpi(updatedTpi);
        }
        setSelectedCandidate("");
      }
    }
  }, [selectedCandidate, allTpiList]); // Déclenche cet effet à chaque changement de candidat sélectionné ou de liste de TPI

  useEffect(() => {
    setEditedTpi(normalizeTpi(tpi));
  }, [tpi]);

  useEffect(() => {
    if (isEditingTpiCard) {
      onUpdateTpi(editedTpi);
    }
  }, [isEditingTpiCard]);

  useLayoutEffect(() => {
    if (!isSelectOpen || typeof document === "undefined") {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    searchInputRef.current?.focus?.({ preventScroll: true });

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setIsSelectOpen(false);
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [isSelectOpen]);

  useEffect(() => {
    let isCancelled = false;

    // Charger les TPI du millésime de la salle plutôt que l'année courante du navigateur.
    const fetchTpiModels = async () => {
      setIsLoading(true);
      setAllTpiList([]);
      setAssignedRefTpis([]);

      try {
        const tpiData = await getTpiModels(roomYear);
        if (isCancelled) {
          return;
        }

        setAllTpiList(Array.isArray(tpiData) ? tpiData : []);
        syncAssignedRefTpis();
      } catch (error) {
        if (!isCancelled) {
          console.error(
            "Une erreur s'est produite lors du chargement des modèles de TPI :",
            error
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    void fetchTpiModels();

    return () => {
      isCancelled = true;
    };
  }, [roomYear]);

  const handleChangeCandidat = (e, field) => {
    const updatedTpi = normalizeTpi({
      ...editedTpi,
      [field]: e.target.value,
      candidatPersonId: "",
    });
    setEditedTpi(updatedTpi);
    onUpdateTpi(updatedTpi);
  };

  const handleChange = (e, field) => {
    const updatedTpi = normalizeTpi({
      ...editedTpi,
      [field]: {
        ...editedTpi[field], // Copie des propriétés actuelles de l'objet imbriqué
        name: e.target.value, // Mise à jour de la propriété 'name' de l'objet imbriqué
        personId: "",
      },
    });
    setEditedTpi(updatedTpi);
    onUpdateTpi(updatedTpi);
  };

  const handleSelectChange = (e) => {
    setSelectedCandidate(e.target.value);
  };

  const formatDate = (date) => {
    const options = { year: "2-digit", month: "2-digit", day: "2-digit" };
    return new Date(date).toLocaleDateString("fr-CH", options);
  };

  const hasExpert1Proposal =
    (safeTpi.expert1.offres?.submit?.length ?? 0) > 0;
  const hasExpert2Proposal =
    (safeTpi.expert2.offres?.submit?.length ?? 0) > 0;
  const hasBossProposal =
    (safeTpi.boss.offres?.submit?.length ?? 0) > 0;
  const normalizedDetailLevel = [0, 1, 2, 3].includes(Number(detailLevel))
    ? Number(detailLevel)
    : 2;
  const compactText = (value) => {
    if (value === null || value === undefined) {
      return "";
    }

    return String(value).trim();
  };
  const displayRef = compactText(safeTpi.refTpi);
  const sourceTpiModel = useMemo(() => {
    if (!displayRef || !Array.isArray(allTpiList) || allTpiList.length === 0) {
      return null
    }

    return allTpiList.find((item) => compactText(item?.refTpi) === displayRef) || null
  }, [allTpiList, displayRef]);
  const displaySite = compactText(tpi?.site || tpi?.lieu?.entreprise);
  const displayClass = compactText(tpi?.classe);
  const candidateName = compactText(safeTpi.candidat || sourceTpiModel?.candidat);
  const storedCandidatePersonId = compactText(
    safeTpi.candidatPersonId || sourceTpiModel?.candidatPersonId
  );
  const expert1Name = compactText(safeTpi.expert1?.name || sourceTpiModel?.experts?.[1]);
  const storedExpert1PersonId = compactText(
    safeTpi.expert1?.personId || sourceTpiModel?.expert1PersonId
  );
  const expert2Name = compactText(safeTpi.expert2?.name || sourceTpiModel?.experts?.[2]);
  const storedExpert2PersonId = compactText(
    safeTpi.expert2?.personId || sourceTpiModel?.expert2PersonId
  );
  const bossName = compactText(safeTpi.boss?.name || sourceTpiModel?.boss);
  const storedBossPersonId = compactText(
    safeTpi.boss?.personId || sourceTpiModel?.bossPersonId
  );
  const candidateRegistryPerson = useMemo(() => {
    if (storedCandidatePersonId) {
      return findRegistryPersonByObjectId(peopleRegistry, storedCandidatePersonId);
    }

    return resolveUniqueRegistryPerson(peopleRegistry, candidateName, "candidat", roomYear);
  }, [candidateName, peopleRegistry, roomYear, storedCandidatePersonId]);
  const expert1RegistryPerson = useMemo(() => {
    if (storedExpert1PersonId) {
      return findRegistryPersonByObjectId(peopleRegistry, storedExpert1PersonId);
    }

    return resolveUniqueRegistryPerson(peopleRegistry, expert1Name, "expert", roomYear);
  }, [expert1Name, peopleRegistry, roomYear, storedExpert1PersonId]);
  const expert2RegistryPerson = useMemo(() => {
    if (storedExpert2PersonId) {
      return findRegistryPersonByObjectId(peopleRegistry, storedExpert2PersonId);
    }

    return resolveUniqueRegistryPerson(peopleRegistry, expert2Name, "expert", roomYear);
  }, [expert2Name, peopleRegistry, roomYear, storedExpert2PersonId]);
  const bossRegistryPerson = useMemo(() => {
    if (storedBossPersonId) {
      return findRegistryPersonByObjectId(peopleRegistry, storedBossPersonId);
    }

    return resolveUniqueRegistryPerson(peopleRegistry, bossName, "chef_projet", roomYear);
  }, [bossName, peopleRegistry, roomYear, storedBossPersonId]);
  const candidateShortIdHint = compactText(
    stakeholderShortIdHints?.[getStakeholderHintKey("candidat", candidateName)]
  );
  const expert1ShortIdHint = compactText(
    stakeholderShortIdHints?.[getStakeholderHintKey("expert", expert1Name)]
  );
  const expert2ShortIdHint = compactText(
    stakeholderShortIdHints?.[getStakeholderHintKey("expert", expert2Name)]
  );
  const bossShortIdHint = compactText(
    stakeholderShortIdHints?.[getStakeholderHintKey("chef_projet", bossName)]
  );
  const candidatePersonId = compactText(
    formatRegistryPersonShortId(candidateRegistryPerson) || candidateShortIdHint
  );
  const expert1PersonId = compactText(
    formatRegistryPersonShortId(expert1RegistryPerson) || expert1ShortIdHint
  );
  const expert2PersonId = compactText(
    formatRegistryPersonShortId(expert2RegistryPerson) || expert2ShortIdHint
  );
  const bossPersonId = compactText(
    formatRegistryPersonShortId(bossRegistryPerson) || bossShortIdHint
  );
  const roomDateKey = useMemo(() => normalizeDateKey(roomDate), [roomDate]);
  const resolvedRoomPeriod = useMemo(() => {
    const explicitPeriod = Number.parseInt(roomPeriod, 10);
    if (Number.isInteger(explicitPeriod) && explicitPeriod > 0) {
      return explicitPeriod;
    }

    const tpiPeriod = Number.parseInt(safeTpi?.period, 10);
    return Number.isInteger(tpiPeriod) && tpiPeriod > 0 ? tpiPeriod : null;
  }, [roomPeriod, safeTpi?.period]);
  const resolvedRoomHalfDay = useMemo(
    () => resolvePeriodHalfDay(resolvedRoomPeriod, roomScheduleContext),
    [resolvedRoomPeriod, roomScheduleContext]
  );
  const stakeholderPreferenceEntries = useMemo(() => {
    const rawEntries = [
      {
        key: "candidat",
        roleLabel: "Candidat",
        displayName: candidateName,
        person: candidateRegistryPerson
      },
      {
        key: "expert1",
        roleLabel: "Expert 1",
        displayName: expert1Name,
        person: expert1RegistryPerson
      },
      {
        key: "expert2",
        roleLabel: "Expert 2",
        displayName: expert2Name,
        person: expert2RegistryPerson
      },
      {
        key: "boss",
        roleLabel: "Chef de projet",
        displayName: bossName,
        person: bossRegistryPerson
      }
    ];

    return rawEntries
      .map((entry) => {
        const preferredChoices = getPreferredSoutenanceChoicesForPerson(entry.person);
        const preferredDateKeys = Array.from(
          new Set(preferredChoices.map((choice) => normalizeDateKey(choice?.date)).filter(Boolean))
        );

        if (preferredChoices.length === 0 || preferredDateKeys.length === 0) {
          return null;
        }

        const matchedChoices = roomDateKey
          ? preferredChoices.filter((choice) => (
              normalizeDateKey(choice?.date) === roomDateKey &&
              (choice?.period == null || Number(choice.period) === Number(resolvedRoomPeriod))
            ))
          : [];
        const compatibleHalfDayChoices = roomDateKey && resolvedRoomHalfDay
          ? preferredChoices.filter((choice) => {
              const choicePeriod = Number.parseInt(choice?.period, 10);

              return (
                Number.isInteger(choicePeriod) &&
                normalizeDateKey(choice?.date) === roomDateKey &&
                choicePeriod !== Number(resolvedRoomPeriod) &&
                resolvePeriodHalfDay(choicePeriod, roomScheduleContext) === resolvedRoomHalfDay
              );
            })
          : [];
        const sameDateChoices = roomDateKey
          ? preferredChoices.filter((choice) => normalizeDateKey(choice?.date) === roomDateKey)
          : [];

        return {
          ...entry,
          personLabel: compactText(formatRegistryPersonLabel(entry.person) || entry.displayName || entry.roleLabel),
          preferredChoices,
          preferredDateKeys,
          hasExactPreference: matchedChoices.some((choice) => Number.isInteger(Number(choice?.period))),
          hasCompatibleHalfDayPreference: compatibleHalfDayChoices.length > 0,
          hasSameDateChoiceWithDifferentHalfDay:
            sameDateChoices.some((choice) => Number.isInteger(Number(choice?.period))) &&
            matchedChoices.length === 0 &&
            compatibleHalfDayChoices.length === 0,
          hasMultiplePreferences: preferredDateKeys.length > 1,
          isMatched: matchedChoices.length > 0 || compatibleHalfDayChoices.length > 0
        };
      })
      .filter(Boolean);
  }, [
    bossName,
    bossRegistryPerson,
    candidateName,
    candidateRegistryPerson,
    expert1Name,
    expert1RegistryPerson,
    expert2Name,
    expert2RegistryPerson,
    resolvedRoomPeriod,
    resolvedRoomHalfDay,
    roomScheduleContext,
    roomDateKey
  ]);
  const preferenceIndicator = useMemo(() => {
    if (isEditingTpiCard || normalizedDetailLevel < 2 || stakeholderPreferenceEntries.length === 0) {
      return null;
    }

    const matchedPreferenceCount = stakeholderPreferenceEntries.filter((entry) => entry.isMatched).length;
    const hasCompatibleHalfDayPreference = stakeholderPreferenceEntries.some(
      (entry) => entry.hasCompatibleHalfDayPreference
    );
    const status = matchedPreferenceCount === 0
      ? "red"
      : matchedPreferenceCount < stakeholderPreferenceEntries.length || hasCompatibleHalfDayPreference
        ? "orange"
        : "green";
    const copy = PREFERENCE_INDICATOR_COPY[status];
    const plannedDateLabel = formatDateKeyLabel(roomDateKey);
    const titleLines = [
      copy.title,
      plannedDateLabel ? `Date planifiée: ${plannedDateLabel}` : null,
      resolvedRoomPeriod ? `Créneau planifié: ${resolvedRoomPeriod}` : null,
      ...stakeholderPreferenceEntries.map((entry) => {
        const preferredDatesLabel = entry.preferredChoices.map((choice) => formatPreferredSoutenanceChoiceLabel(choice)).join(", ");
        const stateLabel = entry.isMatched
          ? entry.hasCompatibleHalfDayPreference
            ? "même demi-journée retenue"
            : entry.hasExactPreference
            ? entry.hasMultiplePreferences
              ? "une préférence précise est retenue"
              : "créneau préféré retenu"
            : entry.hasMultiplePreferences
              ? "une date préférée est retenue"
              : "date préférée retenue"
          : entry.hasSameDateChoiceWithDifferentHalfDay
            ? "date retenue mais demi-journée préférée non respectée"
            : "aucune préférence retenue";

        return `${entry.roleLabel}: ${entry.personLabel} - ${stateLabel} (${preferredDatesLabel})`;
      })
    ].filter(Boolean);

    return {
      status,
      ariaLabel: copy.ariaLabel,
      title: titleLines.join("\n")
    };
  }, [isEditingTpiCard, normalizedDetailLevel, resolvedRoomPeriod, roomDateKey, stakeholderPreferenceEntries]);
  const rolesFilled = [expert1Name, expert2Name, bossName].filter(Boolean).length;
  const isEmptyCard =
    !displayRef &&
    !displaySite &&
    !displayClass &&
    !candidateName &&
    !candidatePersonId &&
    !expert1Name &&
    !expert1PersonId &&
    !expert2Name &&
    !expert2PersonId &&
    !bossName &&
    !bossPersonId &&
    !hasExpert1Proposal &&
    !hasExpert2Proposal &&
    !hasBossProposal;
  const validationErrorTitle = Array.isArray(validationErrorMessages) && validationErrorMessages.length > 0
    ? validationErrorMessages.join("\n")
    : undefined;
  const showHeaderMeta =
    !isEmptyCard &&
    normalizedDetailLevel >= 3 &&
    Boolean(displayRef || displaySite || displayClass || rolesFilled > 0);
  const roomClassMode = inferRoomClassMode({
    roomDateEntry,
    roomName,
    allowedPrefixes: roomDateClassPrefixes
  });

  const [{ isDragging }, dragRef] = useDrag({
    type: ItemTypes.TPI_CARD,
    item: { tpi: safeTpi },
    canDrag: !isEmptyCard && !isEditingTpiCard,
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const expert1Title =
    safeTpi.expert1.offres?.submit
      ?.map((item) => `${formatDate(item.date)}/${item.creneau}`)
      .join("\n") ?? "";

  const expert2Title =
    safeTpi.expert2.offres?.submit
      ?.map((item) => `${formatDate(item.date)}/${item.creneau}`)
      .join("\n") ?? "";

  const bossTitle =
    safeTpi.boss.offres?.submit
      ?.map((item) => `${formatDate(item.date)}/${item.creneau}`)
      .join("\n") ?? "";
  const stakeholderIdEntries = [
    {
      key: "candidat",
      value: candidatePersonId,
      title: candidateName
        ? `Candidat: ${candidateName}${candidatePersonId ? `\nID: ${candidatePersonId}` : "\nID introuvable"}`
        : candidatePersonId || "Candidat non renseigné"
    },
    {
      key: "expert1",
      value: expert1PersonId,
      title: expert1Name
        ? `Expert 1: ${expert1Name}${expert1PersonId ? `\nID: ${expert1PersonId}` : "\nID introuvable"}`
        : expert1PersonId || "Expert 1 non renseigné"
    },
    {
      key: "expert2",
      value: expert2PersonId,
      title: expert2Name
        ? `Expert 2: ${expert2Name}${expert2PersonId ? `\nID: ${expert2PersonId}` : "\nID introuvable"}`
        : expert2PersonId || "Expert 2 non renseigné"
    },
    {
      key: "boss",
      value: bossPersonId,
      title: bossName
        ? `Chef de projet: ${bossName}${bossPersonId ? `\nID: ${bossPersonId}` : "\nID introuvable"}`
        : bossPersonId || "Chef de projet non renseigné"
    }
  ]

  const renderRoleRow = ({
    className,
    Icon,
    iconProps: roleIconProps = {},
    label,
    name,
    proposalTitle,
    proposalLabel,
    hasProposal
  }) => {
    const shouldShowIcon = normalizedDetailLevel >= 2
    const shouldShowLabel = normalizedDetailLevel >= 3
    const shouldShowProposal = normalizedDetailLevel >= 3 && hasProposal && proposalTitle

    if (!name && !shouldShowProposal) {
      return null
    }

    return (
      <div className={`${className} tpi-card-row`} title={shouldShowProposal ? proposalTitle : undefined}>
        {shouldShowIcon ? (
          <span className="tpi-card-icon" aria-hidden="true">
            <Icon {...roleIconProps} />
          </span>
        ) : (
          <span className="tpi-card-icon tpi-card-cell-placeholder" aria-hidden="true" />
        )}
        {shouldShowLabel ? (
          <span className="tpi-card-role">{label}</span>
        ) : (
          <span className="tpi-card-role tpi-card-cell-placeholder" aria-hidden="true" />
        )}
        {name ? (
          <span className="tpi-name">{name}</span>
        ) : (
          <span className="tpi-name tpi-card-cell-placeholder" aria-hidden="true" />
        )}
        {shouldShowProposal ? (
          <span
            className="icon-proposal"
            title={proposalTitle}
            aria-label={proposalLabel}
          >
            <CalendarIcon />
          </span>
        ) : (
          <span className="icon-proposal tpi-card-cell-placeholder" aria-hidden="true" />
        )}
      </div>
    )
  }

  // Élément de chargement conditionnel
  if (isLoading) {
    return <div>Chargement en cours...</div>;
  }

  const candidateRow = candidateName ? (
    normalizedDetailLevel === 1 ? (
      <div className="candidat tpi-card-row tpi-card-row-candidate-only">
        <span className="tpi-name">{candidateName}</span>
      </div>
    ) : (
      <div className="candidat tpi-card-row">
        {normalizedDetailLevel >= 2 ? (
          <span className="tpi-card-icon" aria-hidden="true">
            <CandidateIcon />
          </span>
        ) : (
          <span className="tpi-card-icon tpi-card-cell-placeholder" aria-hidden="true" />
        )}
        {normalizedDetailLevel >= 3 ? (
          <span className="tpi-card-role">Cand.</span>
        ) : (
          <span className="tpi-card-role tpi-card-cell-placeholder" aria-hidden="true" />
        )}
        <span className="tpi-name">{candidateName}</span>
        <span className="icon-proposal tpi-card-cell-placeholder" aria-hidden="true" />
      </div>
    )
  ) : null

  return (
    <div
      ref={isEmptyCard ? undefined : dragRef}
      role={isEmptyCard ? undefined : "article"}
      aria-label={displayRef ? `TPI ${displayRef}` : "TPI"}
      className={`tpiCard detail-level-${normalizedDetailLevel} ${
        isEmptyCard ? "is-empty" : ""
      } ${isDragging ? "dragging" : ""} ${
        !isEmptyCard && hasValidationError ? "has-validation-error" : ""
      }`}
      title={!isEmptyCard && hasValidationError ? validationErrorTitle : undefined}
    >
      {preferenceIndicator ? (
        <span
          className={`tpi-card-preference-indicator tpi-card-preference-indicator--${preferenceIndicator.status}`}
          role="img"
          tabIndex={0}
          aria-label={preferenceIndicator.ariaLabel}
          title={preferenceIndicator.title}
        >
          <PreferenceTriangleIcon />
          {resolvedRoomPeriod ? (
            <span className="tpi-card-preference-slot-number" aria-hidden="true">
              {resolvedRoomPeriod}
            </span>
          ) : null}
        </span>
      ) : null}

      {showHeaderMeta ? (
        <div className="tpi-card-head">
          <div className="tpi-card-head-copy">
            <span className="tpi-card-kicker">TPI</span>
            {displayRef ? (
              <strong className="tpi-card-reference">{displayRef}</strong>
            ) : null}
          </div>
          <div className="tpi-card-head-meta">
            {rolesFilled > 0 ? (
              <span className="tpi-card-pill">{rolesFilled}/3 rôles</span>
            ) : null}
            {displaySite ? (
              <span className="tpi-card-pill tpi-card-pill-soft">{displaySite}</span>
            ) : null}
            {displayClass ? (
              <span className="tpi-card-pill tpi-card-pill-soft">{displayClass}</span>
            ) : null}
          </div>
        </div>
      ) : null}

      {isEditingTpiCard ? (
        <div className="tpi-card-body editing">
          {(() => {
            const normalizedRoomSite = String(roomSite || "").trim().toUpperCase();
            const siteEntreprise = mapSiteToEntreprise(roomSite);
            const roomSiteAliases = Array.from(
              new Set(
                [normalizedRoomSite, siteEntreprise]
                  .map((value) => String(value || "").trim().toUpperCase())
                  .filter(Boolean)
              )
            );

            const matchesSite = (item) => {
              if (roomSiteAliases.length === 0) {
                return true;
              }

              const itemSiteValues = [
                item?.lieu?.entreprise,
                item?.lieu?.site,
                item?.site
              ]
                .map((value) => String(value || "").trim().toUpperCase())
                .filter(Boolean);

              // Les anciennes fiches peuvent ne pas porter de lieu complet.
              if (itemSiteValues.length === 0) {
                return true;
              }

              return itemSiteValues.some((value) => roomSiteAliases.includes(value));
            };

            // All TPIs for this site + class filter, not yet assigned
            const filteredCandidates = (allTpiList || []).filter((item) => {
              const isAssigned = assignedRefTpis.includes(item?.refTpi);
              return !isAssigned && matchesSite(item) && matchesClassFilterForRoom(item, roomDateClassPrefixes, roomClassMode);
            });

            // Search filter
            const query = searchQuery.toLowerCase().trim();
            const searchedCandidates = query
              ? filteredCandidates.filter((item) => {
                  const text = [
                    item?.refTpi,
                    item?.candidat,
                    item?.classe,
                    item?.sujet,
                    item?.description
                  ].filter(Boolean).join(" ").toLowerCase();
                  return text.includes(query);
                })
              : filteredCandidates;

            const sortedCandidates = [...searchedCandidates].sort((left, right) => {
              const leftClass = String(left?.classe || "").trim();
              const rightClass = String(right?.classe || "").trim();
              const classOrder = leftClass.localeCompare(rightClass, "fr", {
                numeric: true,
                sensitivity: "base"
              });

              if (classOrder !== 0) {
                return classOrder;
              }

              const nameOrder = String(left?.candidat || "").localeCompare(
                String(right?.candidat || ""),
                "fr",
                {
                  numeric: true,
                  sensitivity: "base"
                }
              );

              if (nameOrder !== 0) {
                return nameOrder;
              }

              return String(left?.refTpi || "").localeCompare(
                String(right?.refTpi || ""),
                "fr",
                {
                  numeric: true,
                  sensitivity: "base"
                }
              );
            });

            const getClassColor = (cls) => {
              const c = (cls || "").toUpperCase();
              if (c.startsWith("M")) return "tpi-class-badge--matu";
              if (c.startsWith("F")) return "tpi-class-badge--fpa";
              if (c.startsWith("C")) return "tpi-class-badge--cfc";
              return "tpi-class-badge--other";
            };

            return (
              <>
                <div className="editCandidat">
                  <input
                    type="text"
                    className="edit"
                    value={safeTpi.candidat || ""}
                    onChange={(e) => handleChangeCandidat(e, "candidat")}
                  />
                  <div
                    ref={refTpiContainerRef}
                    style={{ display: "none" }}
                    className="refTpi"
                  >
                    {safeTpi.refTpi}{" "}
                  </div>

                  <button
                    type="button"
                    className="btTpiListSite"
                    onClick={handleToggleSelect}
                    title="Rechercher un TPI pour ce créneau"
                  >
                    ⌕
                  </button>
                </div>

                {isSelectOpen && typeof document !== "undefined"
                  ? createPortal(
                      <div
                        className="tpi-candidate-overlay"
                        role="presentation"
                        onClick={() => setIsSelectOpen(false)}
                      >
                        <div
                          className="tpi-candidate-dialog"
                          role="dialog"
                          aria-modal="true"
                          aria-label="Sélectionner un TPI"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <button
                            type="button"
                            className="tpi-candidate-close"
                            aria-label="Fermer la recherche"
                            onClick={() => setIsSelectOpen(false)}
                          >
                            ×
                          </button>

                          <div className="tpi-candidate-dialog-head">
                            <div className="tpi-candidate-dialog-copy">
                              <span className="tpi-candidate-dialog-kicker">
                                Recherche TPI
                              </span>
                              <h3>Choisir un candidat</h3>
                              <p>
                                Année {roomYear}
                                {roomName ? ` · ${roomName}` : ""}
                                {roomSite ? ` · ${roomSite}` : ""}
                                {roomClassMode === "matu"
                                  ? " · Salle MATU"
                                  : roomDateClassPrefixes.length > 0 && roomClassMode !== "nonM"
                                    ? ` · Classes ${roomDateClassPrefixes.join(", ")}`
                                    : ""}
                              </p>
                            </div>

                          </div>

                          <div className="tpi-candidate-search-shell">
                            <input
                              ref={searchInputRef}
                              type="text"
                              className="tpi-candidate-search"
                              placeholder="Rechercher par ref, nom, classe ou sujet"
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                            />
                          </div>

                          <div className="tpi-candidate-results">
                            {sortedCandidates.length === 0 ? (
                              <div className="tpi-candidate-empty-state">
                                Aucun TPI ne correspond à cette recherche.
                              </div>
                            ) : (
                              <div className="tpi-candidate-list">
                                {sortedCandidates.map((item) => {
                                  const candidateClass = String(item?.classe || "").trim()
                                  const subjectText = String(
                                    item?.sujet || item?.description || ""
                                  ).trim()

                                  return (
                                    <button
                                      key={item.refTpi}
                                      type="button"
                                      className="tpi-candidate-row"
                                      onClick={() => {
                                        setSelectedCandidate(item.refTpi)
                                        setIsSelectOpen(false)
                                        setSearchQuery("")
                                      }}
                                      title={subjectText || item.candidat || item.refTpi}
                                    >
                                      <div className="tpi-candidate-row-main">
                                        <span className="tpi-candidate-row-ref">
                                          {item.refTpi}
                                        </span>
                                        <span className="tpi-candidate-row-name">
                                          {item.candidat}
                                        </span>
                                      </div>

                                      <div className="tpi-candidate-row-meta">
                                        {candidateClass ? (
                                          <span
                                            className={`tpi-class-badge ${getClassColor(
                                              candidateClass
                                            )}`}
                                          >
                                            {candidateClass}
                                          </span>
                                        ) : null}
                                      </div>

                                      {subjectText ? (
                                        <div className="tpi-candidate-row-subject">
                                          {subjectText}
                                        </div>
                                      ) : null}
                                    </button>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>,
                      document.body
                    )
                  : null}
              </>
            );
          })()}

          <input
            type="text"
            className="edit"
            value={editedTpi.expert1.name || ""}
            onChange={(e) => handleChange(e, "expert1")}
          />
          <input
            type="text"
            className="edit"
            value={editedTpi.expert2.name || ""}
            onChange={(e) => handleChange(e, "expert2")}
          />
          <input
            type="text"
            className="edit"
            value={editedTpi.boss.name || ""}
            onChange={(e) => handleChange(e, "boss")}
          />
        </div>
      ) : !isEmptyCard ? (
        <div className="tpi-card-body">
          {normalizedDetailLevel === 0 ? (
            <div className="tpi-card-ids-row" aria-label="Identifiants des parties prenantes">
              {stakeholderIdEntries.map((entry) => (
                <div
                  key={entry.key}
                  className={`tpi-card-id-cell ${entry.key} ${entry.value ? "" : "is-missing"}`.trim()}
                  title={entry.title}
                  aria-label={entry.value || "non renseigné"}
                >
                  <span className="tpi-card-id-value">{entry.value || "—"}</span>
                </div>
              ))}
            </div>
          ) : (
            <>
              {candidateRow}
              {renderRoleRow({
                className: "expert",
                Icon: ExpertIcon,
                iconProps: { badge: "1" },
                label: "Exp. 1",
                name: expert1Name,
                proposalTitle: expert1Title,
                proposalLabel: "Propositions de créneaux expert 1",
                hasProposal: hasExpert1Proposal
              })}
              {renderRoleRow({
                className: "expert",
                Icon: ExpertIcon,
                iconProps: { badge: "2" },
                label: "Exp. 2",
                name: expert2Name,
                proposalTitle: expert2Title,
                proposalLabel: "Propositions de créneaux expert 2",
                hasProposal: hasExpert2Proposal
              })}
              {renderRoleRow({
                className: "boss",
                Icon: ProjectLeadIcon,
                label: "Chef",
                name: bossName,
                proposalTitle: bossTitle,
                proposalLabel: "Propositions de créneaux chef de projet",
                hasProposal: hasBossProposal
              })}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
};

export default TpiCard;
