import React, { createContext, useContext, useState } from 'react'

const AuthContext = createContext()

export const useAuth = () => useContext(AuthContext)

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  const login = () => {
    setIsAuthenticated(true)
    // ajoutez votre logique de connexion ici (par exemple, vérification des identifiants)
  }

  const logout = () => {
    setIsAuthenticated(false)
    // ajoutez votre logique de déconnexion ici
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
