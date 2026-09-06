import { Suspense } from 'react';
import { LoginForm } from '../../../components/login-form';

export default function AdminLoginPage() {
  return (
    <main className="login-page">
      <section className="login-intro" aria-labelledby="login-heading">
        <div className="brand-mark" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <p className="eyebrow">Dollz workshop</p>
        <h1 id="login-heading">Welcome back.</h1>
        <p className="login-copy">
          Sign in to the private workspace for your Dollz catalogue and orders.
        </p>
      </section>
      <section className="login-panel" aria-label="Super Admin sign in">
        <div>
          <p className="eyebrow">Super Admin</p>
          <h2>Sign in</h2>
        </div>
        <Suspense
          fallback={<p className="muted-copy">Loading sign-in form…</p>}
        >
          <LoginForm />
        </Suspense>
      </section>
    </main>
  );
}
