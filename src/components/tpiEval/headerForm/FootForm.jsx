import React from 'react';

const v = 0.9;
const year = '2017/2018';

const pagex = x => {
  return (
    <div>page {x} sur 6</div>
  );
};

const copyRight = (v, year) => {
  return (
    <>
      Version {v}
      © I-CQ VD {year}
    </>
  );
};

const footPage = () => {
  return (
    <div>
      <span>Page 1 sur 6</span>
    </div>
  );
};

export default footPage;
