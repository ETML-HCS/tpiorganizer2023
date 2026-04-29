import React from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

const root = createRoot(document.getElementById('root'))

root.render(
  <React.StrictMode>
    <App />
    <ToastContainer
      position='top-center'
      className='toast-container-top-center'
      theme='colored'
      autoClose={6000}
      closeOnClick
      pauseOnHover
      draggable
      newestOnTop
      limit={3}
    />
  </React.StrictMode>
)
