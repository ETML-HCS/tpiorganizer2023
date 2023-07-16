// TPICard.js
import React, { Fragment } from 'react';

const TPICard = ({ candidat, expert1, expert2, boss }) => {
  return (
    <Fragment>
      <div className='candidat'>Candidat: {candidat}</div>
      <div className='expert'>Expert 1: {expert1}</div>
      <div className='expert' >Expert 2: {expert2}</div>
      <div className='boss' >Chef de projet: {boss}</div>
    </Fragment>
  );
};

export default TPICard;
