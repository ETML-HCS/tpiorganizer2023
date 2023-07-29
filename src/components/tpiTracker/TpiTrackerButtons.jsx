import { useState, useEffect } from "react";

const TpiTrackerButtons = ({ toggleArrow, isArrowUp, user }) => {
  const [onConnecting, setOnConnecting] = useState(user);

  useEffect(() => {
    setOnConnecting(user);
  }, [user]);

  return (
    <>
      <div id="tools">
        {onConnecting ? (
          <>
            <button id="btMyTPI"> Mes TPI
              <span role="img" aria-label="TPI">
                📝
              </span>{" "}
             
            </button>
            <button id="btPlanner">Cal/Défenses
              <span role="img" aria-label="Calendrier">
                📅
              </span>{" "}
              
            </button>
            <button dir="btCompte"> Compte
              <span role="img" aria-label="Compte">
                👤
              </span>{" "}
             
            </button>
          </> ) : ( 
          <h3 style={{ color: "Red" }}>merci de vous connecter</h3>
        )}
        <div
          onClick={toggleArrow}
          id="upArrowButton"
          className={!isArrowUp ? "" : "active"}
        >
          ▲ ▲ ▲
        </div>
      </div>
    </>
  );
};

export default TpiTrackerButtons;
