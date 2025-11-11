import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './store'

export default function RequireAuth({ children }: { children: React.ReactElement }) {
  const { token } = useAuth()
  const loc = useLocation()
  if (!token) {
    return <Navigate to="/login" replace state={{ from: loc }} />
  }
  return children
}
