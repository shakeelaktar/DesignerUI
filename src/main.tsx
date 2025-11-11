import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import ErrorBoundary from './app/components/ErrorBoundary'
import { queryClient } from './app/queryClient'
import App from './App'
import Shell from './app/Shell'
import Entities from './app/pages/Entities'
import Lists from './app/pages/Lists'
import Forms from './app/pages/Forms'
import Pages from './app/pages/Pages'
import Menu from './app/pages/Menu'
import Workflow from './app/pages/Workflow'
import Reports from './app/pages/Reports'
import Audit from './app/pages/Audit'
import Signup from './app/pages/Signup'
import Admin from './app/pages/Admin'
import Login from './app/pages/Login'
import RequireAuth from './app/auth/RequireAuth'
import { useAuth } from './app/auth/store'
import './ui-runtime/bootstrap'

function RootRedirect() {
  const { token } = useAuth()
  return <Navigate to={token ? '/designer' : '/login'} replace />
}

const root = document.getElementById('root')!
createRoot(root).render(
	<QueryClientProvider client={queryClient}>
		<ErrorBoundary>
			<BrowserRouter>
				<Routes>
					<Route path="/" element={<RootRedirect />} />
					<Route path="/login" element={<Login />} />
					<Route path="/signup" element={<Signup />} />
					<Route path="/demo" element={<App />} />
					<Route path="/designer" element={<RequireAuth><Shell /></RequireAuth>}>
						<Route index element={<Navigate to="entities" replace />} />
						<Route path="entities" element={<Entities />} />
						<Route path="lists" element={<Lists />} />
						<Route path="forms" element={<Forms />} />
						<Route path="pages" element={<Pages />} />
						<Route path="menu" element={<Menu />} />
						<Route path="workflow" element={<Workflow />} />
						<Route path="reports" element={<Reports />} />
						<Route path="audit" element={<Audit />} />
														<Route path="admin" element={<Admin />} />
					</Route>
				</Routes>
			</BrowserRouter>
		</ErrorBoundary>
	</QueryClientProvider>
)
