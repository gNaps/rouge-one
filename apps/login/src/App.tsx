import { FormEvent, useEffect, useState } from 'react';
import '../../../packages/brand/universe.css';
import './App.css';

import type { LoginConfig } from '@rouge-one/contracts';
async function api(path: string, body?: unknown) {
  const response = await fetch(path, { method: body === undefined ? 'GET' : 'POST', headers: body === undefined ? {} : { 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Request failed');
  return data;
}

export default function App() {
  const parts = location.pathname.split('/').filter(Boolean);
  const tenant = parts[1] || '';
  const initialAction = ['magic', 'reset', 'verify'].includes(parts[2]) ? parts[2] : 'sign-in';
  const [config, setConfig] = useState<LoginConfig | null>(null);
  const [action, setAction] = useState(initialAction);
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  const [token] = useState(new URLSearchParams(location.search).get('token') || '');
  const [flow] = useState(() => {
    const search = new URLSearchParams(location.search);
    return { redirect_uri: search.get('redirect_uri') || '', code_challenge: search.get('code_challenge') || '', state: search.get('state') || '' };
  });
  const base = `/api/auth/${encodeURIComponent(tenant)}`;
  useEffect(() => {
    if (token) history.replaceState(null, '', location.pathname);
    api(`${base}/config`).then(setConfig).catch(error => setMessage(error.message));
  }, [base, token]);
  const validFlow = !!config && flow.redirect_uri === config.redirect_uri && /^[A-Za-z0-9_-]{43}$/.test(flow.code_challenge) && flow.state.length >= 16;
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setMessage('');
    try {
      let data;
      if (token) data = await api(`${base}/email/${initialAction}/consume`, { token, ...(initialAction === 'reset' ? { password } : {}) });
      else if (action === 'sign-in' || action === 'sign-up') data = await api(`${base}/${action}`, { email, password, ...flow });
      else data = await api(action === 'magic' ? `${base}/sign-in/magic-link` : `${base}/email/${action}`, { email, ...(action === 'magic' ? flow : {}) });
      if (data.redirect) location.assign(data.redirect);
      else setMessage(data.message || 'Done');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Request failed'); }
    finally { setBusy(false); }
  }
  function google() { location.assign(`${base}/sign-in/google?${new URLSearchParams(flow)}`); }
  const showPassword = !token && ['sign-in', 'sign-up'].includes(action) || !!token && initialAction === 'reset';
  return <div className="login-page"><main className="auth-shell">
    <aside className="auth-story starfield">
        <div className="auth-brand"><span className="orbit-mark" aria-hidden="true"><span></span></span>Rouge One</div>
        <p className="eyebrow">Identity, in your orbit</p>
        <p className="auth-headline">A universe<br />of possibilities.<br /><span>One identity.</span></p>
        <div className="universe-art" aria-hidden="true"><div className="orbit-track orbit-track-one"></div><div className="orbit-track orbit-track-two"></div><div className="orbit-track orbit-track-three"></div><div className="planet"></div><span className="satellite satellite-one"></span><span className="satellite satellite-two"></span><span className="cosmic-cross"></span></div>
        <span className="auth-story-note">Your space. Your people. Your rules.</span>
      </aside>
    <section className="auth-form-panel">
    <p className="eyebrow">Your application / Secure access</p><h1>{config?.name || 'Sign in'}</h1>
    <p>{token ? initialAction === 'magic' ? 'Confirm email sign-in' : initialAction === 'reset' ? 'Choose a new password' : 'Confirm your email' : action === 'sign-up' ? 'Create an account' : action === 'magic' ? 'Sign in by email' : action === 'reset' ? 'Reset password' : action === 'verify' ? 'Verify email' : 'Welcome back'}</p>
    {message && <p role="alert">{message}</p>}
    {config && !token && !validFlow && <p>Return to your application and choose Sign in to begin.</p>}
    {config && (token || validFlow) && <>
      {(token || !['sign-in', 'sign-up'].includes(action) || config.methods.password) && <form onSubmit={submit}>
        {!token && <label>Email<input name="email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} /></label>}
        {showPassword && <label>Password<input name="password" type="password" required minLength={action === 'sign-in' && !token ? 1 : 12} maxLength={72} autoComplete={action === 'sign-in' ? 'current-password' : 'new-password'} value={password} onChange={e => setPassword(e.target.value)} /></label>}
        <button disabled={busy} type="submit">{busy ? 'Please wait…' : token ? 'Confirm' : action === 'sign-in' ? 'Sign in' : action === 'sign-up' ? 'Create account' : 'Send email'}</button>
      </form>}
      {!token && <nav>
        {config.methods.google && <button type="button" onClick={google}>Continue with Google</button>}
        {config.methods.password && <button type="button" onClick={() => { setMessage(''); setAction(action === 'sign-up' ? 'sign-in' : 'sign-up'); }}>{action === 'sign-up' ? 'Already have an account? Sign in' : 'Create an account'}</button>}
        {config.methods.magic_link && <button type="button" onClick={() => { setMessage(''); setAction('magic'); }}>Sign in by email link</button>}
        {config.email && <><button type="button" onClick={() => { setMessage(''); setAction('reset'); }}>Forgot password?</button><button type="button" onClick={() => { setMessage(''); setAction('verify'); }}>Verify email</button></>}
        {action !== 'sign-in' && <button type="button" onClick={() => { setMessage(''); setAction('sign-in'); }}>Back to sign in</button>}
      </nav>}
    </>}
    </section>
  </main><footer className="auth-footer"><span>Powered by Rouge One</span><span>Identity in orbit</span></footer></div>;
}
