// import {useEffect} from "react";
// import { updateMany } from "../models/userModels";

export const showNotification = (message, duration) => {
  const notification = document.createElement("div");
  notification.innerText = message;
  notification.className = "saveMessage show";
  document.body.appendChild(notification);

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

