// Page d'inscription aux projets en cours
const RegisterToProjects = ({ userRole }) => {
    // Ici, vous pouvez afficher la liste des projets en cours
    // et permettre aux utilisateurs de s'inscrire en fonction de leur rôle (étudiant, boss, expert)
    return (
      <div className={`subscriber ${userRole}`}>

        <h2>Inscription aux projets</h2>
        {/* Afficher la liste des projets en cours et les options d'inscription */}
      </div>
    );
  };
export default RegisterToProjects;  