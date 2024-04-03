import React from 'react';

const v = 0.9;
const year = '2017/2018';

const pagex = x => {
  return (
    <Frame>page {x} sur 6</Frame>
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
    <Frame>
      <span>Page 1 sur 6</span>
    </Frame>
  );
};

export default footPage;
