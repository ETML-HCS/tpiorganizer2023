import React, { Fragment } from 'react';
import NavButton from './components/NavButtons';
import DateRoom from './components/DateRoom';
import './css/globalStyles.css';

const App = () => {
  const dateAujourdhui = new Date();
  const dateFormatted = dateAujourdhui.toLocaleDateString();

  var site="";

  return (

    <Fragment>
      <div id='header'>
        <div id="title">
          <span id="left"> <span className="etml">ETML</span> / CFPV</span>
          <span id="center">O'2023</span>
          <span id="right" className="dateToday">aujourd'hui: {dateFormatted}</span>
        </div>
        <NavButton />
      </div>
      <DateRoom date="2023-07-16" room="Salle A" site={"CFPV"} onDelete={() => { }} />
    </Fragment>
  );
};

export default App;
