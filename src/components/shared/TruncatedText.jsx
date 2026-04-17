import React from 'react';

const TruncatedText = ({ text, maxLength }) => {
  if (!text || text.length <= maxLength) {
    return <span>{text}</span>;
  }
  return <span title={text}>{text.substring(0, maxLength)}...</span>;
};

export default TruncatedText;