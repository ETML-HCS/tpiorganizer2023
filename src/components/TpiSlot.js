import React, { useState } from "react";
import TPICard from "./TpiCard";

const TPISlot = ({
  isEditTPISlot,
  startTime,
  endTime,
  candidat,
  expert1,
  expert2,
  boss,
}) => {


  return (
    <div className="tpiSlot">
      <div className="timeSlot">
        <p className="top">Début : {startTime}</p>
        <p className="bottom">Fin : {endTime}</p>
      </div>
      <TPICard
        isEditingTpiCard={isEditTPISlot}
        candidat={candidat}
        expert1={expert1}
        expert2={expert2}
        boss={boss}
      />
    </div>
  );
};

export default TPISlot;
