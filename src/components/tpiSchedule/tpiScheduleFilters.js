const normalizeClassValue = (value) => String(value || "").trim().toUpperCase();

export const isMatuClass = (value) => normalizeClassValue(value).startsWith("M");

export const inferRoomClassMode = ({ roomName, roomDateEntry, allowedPrefixes }) => {
  if (roomDateEntry && typeof roomDateEntry === "object") {
    if (roomDateEntry.min === true) {
      return "matu";
    }

    if (roomDateEntry.special === true) {
      return "nonM";
    }
  }

  if (Array.isArray(allowedPrefixes) && allowedPrefixes.some((prefix) => isMatuClass(prefix))) {
    return "matu";
  }

  if (Array.isArray(allowedPrefixes) && allowedPrefixes.length > 0) {
    return "nonM";
  }

  const normalizedRoomName = normalizeClassValue(roomName);
  if (normalizedRoomName.startsWith("M")) {
    return "matu";
  }

  if (roomDateEntry && typeof roomDateEntry === "object") {
    return "nonM";
  }

  return null;
};

export const matchesClassFilterForRoom = (item, allowedPrefixes = [], roomClassMode = null) => {
  const classe = String(item?.classe || "").trim().toUpperCase();

  if (!classe) {
    return true;
  }

  if (roomClassMode === "matu") {
    return classe.startsWith("M");
  }

  if (roomClassMode === "nonM") {
    return !classe.startsWith("M");
  }

  if (allowedPrefixes.length === 0) {
    return true;
  }

  return allowedPrefixes.some((prefix) => classe.startsWith(normalizeClassValue(prefix)));
};
