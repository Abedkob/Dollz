import type { Metadata } from 'next';
import { ArrowLeft, LockKeyhole } from 'lucide-react';
import { Suspense } from 'react';
import { LoginForm } from '../../../components/login-form';

export const metadata: Metadata = {
  title: 'Admin sign in',
  robots: { index: false, follow: false },
};

export default function AdminLoginPage() {
  return (
    <main className="login-page">
      <div className="login-stage">
        <section className="login-atelier" aria-labelledby="login-heading">
          <a className="login-wordmark" href="/" aria-label="Dollz storefront">
            <span>Dollz</span>
            <small>Atelier desk</small>
          </a>

          <div className="login-atelier-copy">
            <span className="login-private-label">
              <LockKeyhole aria-hidden="true" size={15} strokeWidth={1.8} />
              Private workspace
            </span>
            <h1 id="login-heading">Keep every order moving.</h1>
            <p>
              Review custom requests, prepare quotations, and keep production on
              schedule from one focused workspace.
            </p>
          </div>
        </section>

        <section className="login-panel" aria-labelledby="sign-in-heading">
          <div className="login-panel-content">
            <header className="login-panel-header">
              <p>Welcome back</p>
              <h2 id="sign-in-heading">Sign in to the atelier</h2>
              <span>Use your administrator email and password.</span>
            </header>

            <Suspense
              fallback={
                <div
                  className="login-form-skeleton"
                  aria-label="Loading sign-in form"
                >
                  <span />
                  <span />
                  <span />
                </div>
              }
            >
              <LoginForm />
            </Suspense>

            <a className="login-return-link" href="/">
              <ArrowLeft aria-hidden="true" size={16} />
              Return to the shop
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
