import React from 'react'

type ErrorBoundaryState = { error: any }

export class ErrorBoundary extends React.Component<React.PropsWithChildren<{}>, ErrorBoundaryState> {
  constructor(props: {}) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error: any): ErrorBoundaryState {
    return { error }
  }
  componentDidCatch(error: any, info: any) {
    // eslint-disable-next-line no-console
    console.error('UI ErrorBoundary caught error:', error, info)
  }
  render() {
    if (this.state.error) {
      const err = this.state.error
      return (
        <div style={{padding:24, fontFamily:'sans-serif'}}>
          <h2 style={{marginTop:0, color:'#b91c1c'}}>Something went wrong.</h2>
          <p style={{color:'#1e293b'}}>The UI hit an unexpected error. This prevents a silent blank screen.</p>
          <pre style={{background:'#f1f5f9', padding:12, borderRadius:8, overflow:'auto', maxHeight:260, fontSize:12}}>{(err?.stack || String(err)).substring(0,500)}</pre>
          <button type="button" onClick={()=> this.setState({ error:null })} style={{marginTop:12}}>Retry</button>
        </div>
      )
    }
    return this.props.children
  }
}

export default ErrorBoundary