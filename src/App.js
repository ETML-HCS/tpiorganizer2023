import React from 'react';
import DateRoom from './components/DateRoom';

const App = () => {
  return (
    <div>
      <h1>TPIorganizer version 2023</h1>
      <DateRoom date="2023-07-16" room="Salle A" numSlots={8} breakDuration={10} onDelete={() => {}} />
    </div>
  );
};

export default App;
