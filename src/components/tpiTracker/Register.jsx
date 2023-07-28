import React, { useState, useEffect } from "react";
import User from "../../models/userModels";

const Register = () => {
  const [activeForm, setActiveForm] = useState(null);
  const [lastUserId, setLastUserId] = useState(-1);

  const saveToBd = async (data) => {
    try {
      const response = await fetch("http://localhost:5000/inscription", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
  
      if (response.ok) {
        const savedUser = await response.json();
        console.log("Utilisateur enregistré avec succès, ID :", savedUser);
        
      } else {
        console.error("Erreur lors de l'enregistrement de l'utilisateur :", response.status);
        
      }
    } catch (error) {
      console.error("Erreur lors de l'enregistrement de l'utilisateur :", error);
    }
  };

  const handleFormSelection = (formType) => {
    setActiveForm(formType);
  };

  // Formulaire d'inscription pour les étudiants
  const StudentForm = () => {
    const [studentData, setStudentData] = useState({
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      studentId: "",
      role: "student",
    });

    const handleStudentRegistration = () => {
      // Traitez les données d'inscription des étudiants ici
      console.log("Données d'inscription des étudiants :", studentData);
      saveToBd(studentData);
    };

    return (
      <div
        className={`student-registration ${
          activeForm === "student" ? "active" : ""
        }`}
      >
        <h3>Étudiant</h3>
        <input
          type="text"
          placeholder="Prénom"
          value={studentData.firstName}
          onChange={(e) =>
            setStudentData({ ...studentData, firstName: e.target.value })
          }
        />
        <input
          type="text"
          placeholder="Nom de famille"
          value={studentData.lastName}
          onChange={(e) =>
            setStudentData({ ...studentData, lastName: e.target.value })
          }
        />
        <input
          type="email"
          placeholder="Adresse e-mail"
          value={studentData.email}
          onChange={(e) =>
            setStudentData({ ...studentData, email: e.target.value })
          }
        />
        <input
          type="text"
          placeholder="Numéro d'étudiant"
          value={studentData.studentId}
          onChange={(e) =>
            setStudentData({ ...studentData, studentId: e.target.value })
          }
        />
        <button onClick={handleStudentRegistration}>
          S'inscrire en tant qu'étudiant
        </button>
      </div>
    );
  };

  // Formulaire d'inscription pour les chefs de projet
  const ProjectManagerForm = () => {
    const [projectManagerData, setProjectManagerData] = useState({
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      role: "boss",
    });

    const handleProjectManagerRegistration = () => {
      // Traitez les données d'inscription des chefs de projet ici
      console.log(
        "Données d'inscription des chefs de projet :",
        projectManagerData
      );
      saveToBd(projectManagerData);
    };

    return (
      <div
        className={`project-manager-registration ${
          activeForm === "projectManager" ? "active" : ""
        }`}
      >
        <h3>Chef de projet</h3>
        <input
          type="text"
          placeholder="Prénom"
          value={projectManagerData.firstName}
          onChange={(e) =>
            setProjectManagerData({
              ...projectManagerData,
              firstName: e.target.value,
            })
          }
        />
        <input
          type="text"
          placeholder="Nom de famille"
          value={projectManagerData.lastName}
          onChange={(e) =>
            setProjectManagerData({
              ...projectManagerData,
              lastName: e.target.value,
            })
          }
        />
        <input
          type="email"
          placeholder="Adresse e-mail"
          value={projectManagerData.email}
          onChange={(e) =>
            setProjectManagerData({
              ...projectManagerData,
              email: e.target.value,
            })
          }
        />
        <button onClick={handleProjectManagerRegistration}>
          S'inscrire en tant que chef de projet
        </button>
      </div>
    );
  };

  // Formulaire d'inscription pour les doyens
  const DeanForm = () => {
    const [deanData, setDeanData] = useState({
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      role: "dean",
      // Ajoutez d'autres champs spécifiques aux doyens ici si nécessaire
    });

    const handleDeanRegistration = () => {
      // Traitez les données d'inscription des doyens ici
      console.log("Données d'inscription des doyens :", deanData);
      saveToBd(deanData);
    };

    return (
      <div
        className={`dean-registration ${activeForm === "dean" ? "active" : ""}`}
      >
        <h3>Doyen</h3>
        <input
          type="text"
          placeholder="Prénom"
          value={deanData.firstName}
          onChange={(e) =>
            setDeanData({ ...deanData, firstName: e.target.value })
          }
        />
        <input
          type="text"
          placeholder="Nom de famille"
          value={deanData.lastName}
          onChange={(e) =>
            setDeanData({ ...deanData, lastName: e.target.value })
          }
        />
        <input
          type="email"
          placeholder="Adresse e-mail"
          value={deanData.email}
          onChange={(e) => setDeanData({ ...deanData, email: e.target.value })}
        />
        <button onClick={handleDeanRegistration}>
          S'inscrire en tant que doyen
        </button>
      </div>
    );
  };

  // Formulaire d'inscription pour les experts
  const ExpertForm = () => {
    const [expertData, setExpertData] = useState({
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      role: "expert",
    });

    const handleExpertRegistration = () => {
      console.log("Données d'inscription des experts :", expertData);
      saveToBd(expertData);
    };

    return (
      <div
        className={`expert-registration ${
          activeForm === "expert" ? "active" : ""
        }`}
      >
        <h3>Expert</h3>
        <input
          type="text"
          placeholder="Prénom"
          value={expertData.firstName}
          onChange={(e) =>
            setExpertData({ ...expertData, firstName: e.target.value })
          }
        />
        <input
          type="text"
          placeholder="Nom de famille"
          value={expertData.lastName}
          onChange={(e) =>
            setExpertData({ ...expertData, lastName: e.target.value })
          }
        />
        <input
          type="email"
          placeholder="Adresse e-mail"
          value={expertData.email}
          onChange={(e) =>
            setExpertData({ ...expertData, email: e.target.value })
          }
        />
        <button onClick={handleExpertRegistration}>
          S'inscrire en tant qu'expert
        </button>
      </div>
    );
  };

  return (
    <div className="register">
      <h2>Inscription</h2>
      <ul className="form-selection">
        <li onClick={() => handleFormSelection("student")}>Étudiant</li>
        <li onClick={() => handleFormSelection("projectManager")}>
          Chef de projet
        </li>
        <li onClick={() => handleFormSelection("dean")}>Doyen</li>
        <li onClick={() => handleFormSelection("expert")}>Expert</li>
      </ul>
      {/* Affichez le formulaire sélectionné en fonction de l'état activeForm */}
      {activeForm === "student" && <StudentForm />}
      {activeForm === "projectManager" && <ProjectManagerForm />}
      {activeForm === "dean" && <DeanForm />}
      {activeForm === "expert" && <ExpertForm />}
    </div>
  );
};

export default Register;
