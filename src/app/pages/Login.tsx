import React from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import SignInBox from '../components/SignIn'
import { useAuth } from '../auth/store'

export default function Login() {
  const { token } = useAuth()
  const nav = useNavigate()
  const loc = useLocation() as any
  const from = loc?.state?.from?.pathname || '/designer'

  React.useEffect(() => {
    if (token) {
      nav(from, { replace: true })
    }
  }, [token, from, nav])

  return (
    <div style={{display:'grid', placeItems:'center', height:'100vh', fontFamily:'Inter, system-ui, Arial'}}>
      <div style={{width:360}}>
        <h2 style={{marginBottom:8}}>Welcome</h2>
        <p style={{marginTop:0, color:'#64748b'}}>Sign in to continue to the Designer.</p>
        <SignInBox />
        <div style={{marginTop:12, fontSize:14}}>
          No account? <Link to="/signup">Create one</Link>
        </div>
      </div>
    </div>
  )
}
