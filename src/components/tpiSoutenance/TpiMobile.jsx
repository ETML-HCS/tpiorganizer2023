
import React, { useState, useEffect } from 'react';
import { formatDate } from './TpiSoutenanceParts';
import TruncatedText from '../shared/TruncatedText';

const MobileRoomFilter = ({ rooms, schedule }) => {
    const [roomIndex, setRoomIndex] = useState(0);
  
    useEffect(() => {
      const msgClass = document.querySelector(".message-smartphone");
      const filtersClass = document.querySelector(".filters-smartphone");
      if (msgClass) {
        msgClass.remove();
      }
      if (filtersClass) {
        filtersClass.remove();
      }
    }, []);
  
    const handleNextRoom = () => {
      setRoomIndex((prevIndex) => (prevIndex + 1) % rooms.length);
    };
  
    const handlePreviousRoom = () => {
      setRoomIndex((prevIndex) => (prevIndex - 1 + rooms.length) % rooms.length);
    };
  
    return (
      <div className="mobile-room-filter">
        <div key={roomIndex} className={`salle ${rooms[roomIndex].site}`}>
          <span className="site">{rooms[roomIndex].site}</span>
          <div className={`header_${roomIndex}`}>
            <h3>{formatDate(rooms[roomIndex].date)}</h3>
            <h4>{rooms[roomIndex].name}</h4>
          </div>
          {rooms[roomIndex].tpiDatas.map((tpiData, index) => {
            // Extrait le numéro de ligne à partir de l'ID de tpiData
            const lineNumber = tpiData.id.split("_").pop();
            // Décomposition des propriétés de tpiData
            const { candidat, expert1, expert2, boss } = tpiData;
            return (
              <React.Fragment key={index}>
                <div className="tpi-data" id={tpiData.id}>
                  <div className="time-label">
                    {`${schedule[lineNumber].startTime} - ${schedule[lineNumber].endTime}`}
                  </div>
                  <div className="tpi-container">
                    <div className="tpi-entry tpi-candidat">
                      <TruncatedText text={candidat} maxLength={30} />
                    </div>
                    <div className="tpi-entry">
                      <div className="tpi-expert1">Expert1: </div>
                      <TruncatedText text={expert1?.name} maxLength={20} />
                    </div>
                    <div className="tpi-entry">
                      <div className="tpi-expert2">Expert2: </div>
                      <TruncatedText text={expert2?.name} maxLength={20} />
                    </div>
                    <div className="tpi-entry">
                      <div className="tpi-boss">CDP {">>"}</div>
                      <TruncatedText text={boss?.name} maxLength={20} />
                    </div>
                  </div>
                </div>
              </React.Fragment>
            );
          })}
        </div>
        <button
          onClick={handlePreviousRoom}
          title="Voir la salle précédente"
          aria-label="Salle précédente"
        >
          Gauche
        </button>
        <button
          onClick={handleNextRoom}
          title="Voir la salle suivante"
          aria-label="Salle suivante"
        >
          Droite
        </button>
      </div>
    );
  };
