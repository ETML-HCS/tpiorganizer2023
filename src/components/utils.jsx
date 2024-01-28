// import {useEffect} from "react";
// import { updateMany } from "../models/userModels";
export const showNotification = (message, type = "info",duration = 3000) => {
  const notification = document.createElement("div");
  notification.innerText = message;

  // Définir la classe en fonction du type de notification
  switch (type) {
    case "success":
      notification.className = "notification success show";
      break;
    case "error":
      notification.className = "notification error show";
      break;
    case "info":
    default:
      notification.className = "notification info show";
      break;
  }

  document.body.appendChild(notification);

  // Enlever la notification après le délai spécifié
  setTimeout(() => {
    notification.classList.remove("show");
    document.body.removeChild(notification);
  }, duration);
};

export const updateMarginTopPage = (delta) => {
  const rootElement = document.querySelector(".container");
  if (rootElement) {
    rootElement.style.setProperty("margin-top", `${delta}px`);
  }
};

