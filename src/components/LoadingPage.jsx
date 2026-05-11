import React from 'react'

import '../css/loadingPage.css'

const APP_TITLE = 'TPI Organizer'

const LoadingPage = () => (
  <main className='loading-page' aria-labelledby='loading-title' aria-busy='true'>
    <section className='loading-panel'>
      <div className='loading-mark' aria-hidden='true'>
        <span className='loading-mark-ring'></span>
        <span className='loading-mark-core'>TPI</span>
      </div>
      <h1 id='loading-title' aria-label={APP_TITLE}>
        {APP_TITLE.split('').map((character, index) => (
          <span
            className='loading-title-letter'
            key={`${character}-${index}`}
            style={{ '--letter-index': index }}
            aria-hidden='true'
          >
            {character === ' ' ? '\u00A0' : character}
          </span>
        ))}
      </h1>
      <div className='loading-progress' aria-hidden='true'>
        <span></span>
      </div>
    </section>
  </main>
)

export default LoadingPage
