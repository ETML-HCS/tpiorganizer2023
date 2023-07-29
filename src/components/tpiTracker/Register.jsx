import React, { useState } from "react";
import { AES } from "crypto-js";
import {
  createUser,
  getUsers,
  updateUser,
} from "../tpiControllers/TpiUsersController";

const InputField = ({ type, placeholder, value, onChange }) => {
  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
    />
  );
};

const Register = ({secret}) => {
  const [activeForm, setActiveForm] = useState(null);
  const [formData, setFormData] = useState({
    login: "",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    studentId: "",
    bossId: "",
    expertID: "",
    role: "",
  });

  const handleFormSelection = (formType) => {
    setActiveForm(formType);
    setFormData({ ...formData, role: formType });
  };

  const handleInputChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
  };

  const hashToPassword = (password) => {
    console.log(password,"||",secret);
    return AES.encrypt(password, secret).toString();
  };

  const handleRegistration = () => {
    console.log(formData);
    const hashedPassword = hashToPassword(formData.password);
    console.log(hashedPassword);
    createUser({ ...formData, password: hashedPassword });
    setActiveForm(false);
  };

  return (
    <div className="register">
      <h2>Inscription</h2>
      <ul className="form-selection">
        <li onClick={() => handleFormSelection("student")}>Étudiant</li>
        <li onClick={() => handleFormSelection("projectManager")}>Chef de projet</li>
        <li onClick={() => handleFormSelection("dean")}>Doyen</li>
        <li onClick={() => handleFormSelection("expert")}>Expert</li>
      </ul>
      {/* Affichez le formulaire sélectionné en fonction de l'état activeForm */}
      {activeForm && (
        <div className={`${activeForm}-registration active`}>
          <h3>
            {activeForm === "student"
              ? "Étudiant"
              : activeForm === "projectManager"
              ? "Chef de projet"
              : activeForm === "dean"
              ? "Doyen"
              : "Expert"}
          </h3>
          <InputField
            type="text"
            placeholder="Login"
            value={formData.login}
            onChange={(e) => handleInputChange("login", e.target.value)}
          />
          <InputField
            type="text"
            placeholder="Prénom"
            value={formData.firstName}
            onChange={(e) => handleInputChange("firstName", e.target.value)}
          />
          <InputField
            type="text"
            placeholder="Nom de famille"
            value={formData.lastName}
            onChange={(e) => handleInputChange("lastName", e.target.value)}
          />
          <InputField
            type="email"
            placeholder="Adresse e-mail"
            value={formData.email}
            onChange={(e) => handleInputChange("email", e.target.value)}
          />
          <InputField
            type="password"
            placeholder="password"
            value={formData.password}
            onChange={(e) => handleInputChange("password", e.target.value)}
          />

          <button onClick={handleRegistration}>
            S'inscrire en tant que{" "}
            {activeForm === "student"
              ? "étudiant"
              : activeForm === "projectManager"
              ? "chef de projet"
              : activeForm === "dean"
              ? "doyen"
              : "expert"}
          </button>
        </div>
      )}
    </div>
  );
};

export default Register;
