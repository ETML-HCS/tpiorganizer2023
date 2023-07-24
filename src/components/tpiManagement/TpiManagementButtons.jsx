const TpiManagementButtons = ({ onNewTpi, newTpi, toggleArrow, isArrowUp }) => {
  
  const handleNewTpi = () => {
    onNewTpi((newTpi) => !newTpi);
  };

  return (
    <div id="tools">
      <button id="btNewTpi" onClick={handleNewTpi}>
        {newTpi ? (
          <>
            <span role="img" aria-label="Close">
              ❌
            </span>{" "}
            Fermer le formulaire
          </>
        ) : (
          <>
            <span role="img" aria-label="New TPI">
              🔔
            </span>{" "}
            Nouveau TPI
          </>
        )}
      </button>

      <button
        onClick={toggleArrow}
        id="upArrowButton"
        className={!isArrowUp ? "" : "active"}
        aria-label={isArrowUp ? "Arrow up" : "Arrow down"}
      >
        ▲ ▲ ▲
      </button>
    </div>
  );
};

export default TpiManagementButtons;
