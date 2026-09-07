'use client';

import React, {
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import type { SessionResponse } from '../lib/auth';
import { catalogRequest } from '../lib/catalog';
import type { SystemStatus, WorkspaceSettings } from '../lib/settings';

const sections = [
  ['atelier', 'Atelier', 'Public identity'],
  ['orders', 'Orders & delivery', 'Checkout methods'],
  ['catalog', 'Catalog defaults', 'New product defaults'],
  ['security', 'Account & security', 'Profile and access'],
  ['system', 'System status', 'Service connections'],
] as const;

const countries = [
  ['LB', 'Lebanon'],
  ['AE', 'United Arab Emirates'],
  ['SA', 'Saudi Arabia'],
  ['QA', 'Qatar'],
  ['KW', 'Kuwait'],
  ['JO', 'Jordan'],
  ['US', 'United States'],
  ['CA', 'Canada'],
  ['GB', 'United Kingdom'],
  ['FR', 'France'],
  ['DE', 'Germany'],
] as const;

type Section = (typeof sections)[number][0];
type Result = { kind: 'success' | 'error'; message: string } | null;

function text(form: FormData, name: string) {
  return String(form.get(name) ?? '').trim();
}

function nullable(value: string) {
  return value || null;
}

function SectionForm({
  section,
  eyebrow,
  title,
  description,
  impact,
  preview,
  children,
  busy,
  dirty,
  result,
  onDirty,
  onDiscard,
  onSubmit,
}: {
  section: string;
  eyebrow: string;
  title: string;
  description: string;
  impact: string;
  preview?: ReactNode;
  children: ReactNode;
  busy: boolean;
  dirty: boolean;
  result: Result;
  onDirty: () => void;
  onDiscard: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="settings-section-layout">
      <aside className="settings-context">
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        <p>{description}</p>
        <div className="settings-impact">
          <span aria-hidden="true">↗</span>
          <p>
            <strong>Where this appears</strong>
            {impact}
          </p>
        </div>
        {preview}
      </aside>
      <form
        className="settings-editor"
        data-section={section}
        onChange={onDirty}
        onSubmit={onSubmit}
      >
        <div className="settings-editor-heading">
          <div>
            <span>Edit details</span>
            <strong>{title}</strong>
          </div>
          <span className={`settings-save-state ${dirty ? 'dirty' : ''}`}>
            {dirty ? 'Unsaved' : 'Up to date'}
          </span>
        </div>
        <div className="settings-fields">{children}</div>
        {result ? (
          <p
            className={`settings-result ${result.kind}`}
            role={result.kind === 'error' ? 'alert' : 'status'}
          >
            {result.message}
          </p>
        ) : null}
        <footer className={`settings-action-bar ${dirty ? 'is-dirty' : ''}`}>
          <span>
            {dirty
              ? 'You have changes that are not live yet.'
              : 'Everything here is saved.'}
          </span>
          <div>
            {dirty ? (
              <button
                type="reset"
                className="secondary-button"
                onClick={onDiscard}
              >
                Discard
              </button>
            ) : null}
            <button className="primary-button" disabled={!dirty || busy}>
              {busy ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </footer>
      </form>
    </div>
  );
}

export function SettingsPanel({
  session,
  initialSettings,
  systemStatus,
}: {
  session: SessionResponse;
  initialSettings: WorkspaceSettings;
  systemStatus: SystemStatus;
}) {
  const [active, setActive] = useState<Section>('atelier');
  const [settings, setSettings] = useState(initialSettings);
  const [busy, setBusy] = useState('');
  const [dirty, setDirty] = useState<Set<string>>(() => new Set());
  const [result, setResult] = useState<Record<string, Result>>({});
  const [pickupEnabled, setPickupEnabled] = useState(settings.pickupEnabled);

  useEffect(() => {
    if (dirty.size === 0) return;
    const preventExit = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', preventExit);
    return () => window.removeEventListener('beforeunload', preventExit);
  }, [dirty]);

  function markDirty(section: string) {
    setDirty((current) => {
      if (current.has(section)) return current;
      const next = new Set(current);
      next.add(section);
      return next;
    });
    setResult((current) => ({ ...current, [section]: null }));
  }

  function clearDirty(section: string) {
    setDirty((current) => {
      const next = new Set(current);
      next.delete(section);
      return next;
    });
  }

  async function save(
    section: string,
    path: string,
    payload: Record<string, unknown>,
  ) {
    setBusy(section);
    setResult((current) => ({ ...current, [section]: null }));
    try {
      const response = await catalogRequest<{ settings: WorkspaceSettings }>(
        path,
        { method: 'PATCH', body: JSON.stringify(payload) },
        session.csrfToken,
      );
      setSettings(response.settings);
      clearDirty(section);
      setResult((current) => ({
        ...current,
        [section]: { kind: 'success', message: 'Changes are now live.' },
      }));
    } catch (reason) {
      setResult((current) => ({
        ...current,
        [section]: {
          kind: 'error',
          message:
            reason instanceof Error
              ? reason.message
              : 'The settings could not be saved.',
        },
      }));
    } finally {
      setBusy('');
    }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy('profile');
    setResult((current) => ({ ...current, profile: null }));
    try {
      await catalogRequest(
        'settings/profile',
        {
          method: 'PATCH',
          body: JSON.stringify({ fullName: nullable(text(form, 'fullName')) }),
        },
        session.csrfToken,
      );
      clearDirty('profile');
      setResult((current) => ({
        ...current,
        profile: { kind: 'success', message: 'Profile name saved.' },
      }));
    } catch (reason) {
      setResult((current) => ({
        ...current,
        profile: {
          kind: 'error',
          message:
            reason instanceof Error ? reason.message : 'Profile not saved.',
        },
      }));
    } finally {
      setBusy('');
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = text(form, 'newPassword');
    if (next !== text(form, 'confirmPassword')) {
      setResult((current) => ({
        ...current,
        password: { kind: 'error', message: 'The new passwords do not match.' },
      }));
      return;
    }
    setBusy('password');
    setResult((current) => ({ ...current, password: null }));
    try {
      const response = await fetch('/admin/auth/change-password', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'content-type': 'application/json',
          'x-csrf-token': session.csrfToken,
        },
        body: JSON.stringify({
          currentPassword: text(form, 'currentPassword'),
          newPassword: next,
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(
          payload?.error?.message ?? 'The password could not be changed.',
        );
      }
      window.location.assign('/admin/login?changed=password');
    } catch (reason) {
      setResult((current) => ({
        ...current,
        password: {
          kind: 'error',
          message:
            reason instanceof Error
              ? reason.message
              : 'The password could not be changed.',
        },
      }));
      setBusy('');
    }
  }

  const enabledMethods =
    Number(settings.deliveryEnabled) + Number(settings.pickupEnabled);
  const readyChecks = systemStatus.checks.filter((check) => check.ready).length;

  return (
    <div className="settings-workbench">
      <header className="admin-header settings-page-header">
        <div>
          <p className="eyebrow">Workspace controls</p>
          <h1>Settings</h1>
          <p className="page-intro">
            Shape the customer experience and your atelier’s everyday defaults.
          </p>
        </div>
        <span className="settings-updated">
          Last saved{' '}
          {new Intl.DateTimeFormat(undefined, {
            dateStyle: 'medium',
            timeStyle: 'short',
          }).format(new Date(settings.updatedAt))}
        </span>
      </header>

      <dl className="settings-health-strip" aria-label="Settings overview">
        <div>
          <dt>Storefront</dt>
          <dd>
            <span className="system-dot ready" /> Connected
          </dd>
        </div>
        <div>
          <dt>Checkout</dt>
          <dd>
            {enabledMethods} fulfilment{' '}
            {enabledMethods === 1 ? 'method' : 'methods'}
          </dd>
        </div>
        <div>
          <dt>Services</dt>
          <dd>
            {readyChecks} of {systemStatus.checks.length} ready
          </dd>
        </div>
      </dl>

      <nav className="settings-tabs" aria-label="Settings sections">
        {sections.map(([key, label, hint]) => (
          <button
            key={key}
            type="button"
            className={active === key ? 'active' : ''}
            aria-current={active === key ? 'page' : undefined}
            onClick={() => setActive(key)}
          >
            <strong>{label}</strong>
            <span>{hint}</span>
            {dirty.has(key) || (key === 'security' && dirty.has('profile')) ? (
              <i aria-label="Unsaved changes" />
            ) : null}
          </button>
        ))}
      </nav>

      <label className="settings-section-select">
        Settings section
        <select
          value={active}
          onChange={(event) => setActive(event.target.value as Section)}
        >
          {sections.map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <div className="settings-workspace">
        <section hidden={active !== 'atelier'}>
          <SectionForm
            section="atelier"
            eyebrow="Customer-facing"
            title="Atelier profile"
            description="Give the shop a clear voice and make it easy for customers to reach you."
            impact="Storefront footer, product pages and checkout contact details."
            preview={
              <div className="settings-shop-preview">
                <span>In the shop</span>
                <strong>{settings.atelierName}</strong>
                <p>{settings.storefrontDescription}</p>
                <small>{settings.locationLabel}</small>
              </div>
            }
            busy={busy === 'atelier'}
            dirty={dirty.has('atelier')}
            result={result.atelier ?? null}
            onDirty={() => markDirty('atelier')}
            onDiscard={() => clearDirty('atelier')}
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              void save('atelier', 'settings/atelier', {
                version: settings.version,
                atelierName: text(form, 'atelierName'),
                publicEmail: nullable(text(form, 'publicEmail')),
                publicPhone: nullable(text(form, 'publicPhone')),
                whatsappNumber: nullable(text(form, 'whatsappNumber')),
                locationLabel: text(form, 'locationLabel'),
                storefrontDescription: text(form, 'storefrontDescription'),
              });
            }}
          >
            <label>
              Atelier name
              <input
                name="atelierName"
                required
                maxLength={120}
                defaultValue={settings.atelierName}
              />
            </label>
            <label>
              Public email <small>Optional</small>
              <input
                name="publicEmail"
                type="email"
                maxLength={320}
                defaultValue={settings.publicEmail ?? ''}
              />
            </label>
            <label>
              Public phone <small>Optional</small>
              <input
                name="publicPhone"
                type="tel"
                maxLength={50}
                defaultValue={settings.publicPhone ?? ''}
              />
            </label>
            <label>
              WhatsApp number <small>Optional</small>
              <input
                name="whatsappNumber"
                type="tel"
                maxLength={50}
                defaultValue={settings.whatsappNumber ?? ''}
              />
            </label>
            <label className="settings-wide">
              Location label
              <input
                name="locationLabel"
                required
                maxLength={200}
                defaultValue={settings.locationLabel}
              />
            </label>
            <label className="settings-wide">
              Storefront description
              <textarea
                name="storefrontDescription"
                required
                maxLength={500}
                rows={4}
                defaultValue={settings.storefrontDescription}
              />
            </label>
          </SectionForm>
        </section>

        <section hidden={active !== 'orders'}>
          <SectionForm
            section="orders"
            eyebrow="Customer-facing"
            title="Orders and delivery"
            description="Choose how customers receive an order and where you currently serve."
            impact="Checkout fulfilment choices, address fields and the order confirmation."
            preview={
              <div className="settings-shop-preview settings-method-preview">
                <span>Available at checkout</span>
                {settings.deliveryEnabled ? <strong>Delivery</strong> : null}
                {settings.pickupEnabled ? (
                  <strong>{settings.pickupLabel}</strong>
                ) : null}
                <small>{settings.checkoutNotice}</small>
              </div>
            }
            busy={busy === 'orders'}
            dirty={dirty.has('orders')}
            result={result.orders ?? null}
            onDirty={() => markDirty('orders')}
            onDiscard={() => {
              clearDirty('orders');
              setPickupEnabled(settings.pickupEnabled);
            }}
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const supportedCountryCodes = form
                .getAll('supportedCountryCodes')
                .map(String);
              const defaultCountry = text(form, 'defaultCountry');
              if (!supportedCountryCodes.includes(defaultCountry)) {
                setResult((current) => ({
                  ...current,
                  orders: {
                    kind: 'error',
                    message:
                      'Include the default country in your delivery countries.',
                  },
                }));
                return;
              }
              void save('orders', 'settings/orders', {
                version: settings.version,
                deliveryEnabled: form.get('deliveryEnabled') === 'on',
                pickupEnabled: form.get('pickupEnabled') === 'on',
                pickupLabel: text(form, 'pickupLabel'),
                pickupAddress: nullable(text(form, 'pickupAddress')),
                pickupCity: text(form, 'pickupCity'),
                pickupCountry: text(form, 'pickupCountry'),
                supportedCountryCodes,
                defaultCountry,
                checkoutNotice: text(form, 'checkoutNotice'),
              });
            }}
          >
            <fieldset className="settings-wide settings-toggle-row">
              <legend>Fulfilment methods</legend>
              <label>
                <input
                  type="checkbox"
                  name="deliveryEnabled"
                  defaultChecked={settings.deliveryEnabled}
                />
                <span>
                  <strong>Delivery</strong>
                  <small>Customers enter a delivery address.</small>
                </span>
              </label>
              <label>
                <input
                  type="checkbox"
                  name="pickupEnabled"
                  defaultChecked={settings.pickupEnabled}
                  onChange={(event) => setPickupEnabled(event.target.checked)}
                />
                <span>
                  <strong>Atelier pickup</strong>
                  <small>Customers arrange local collection.</small>
                </span>
              </label>
            </fieldset>
            {pickupEnabled ? (
              <div className="settings-wide settings-subsection">
                <div className="settings-subsection-title">
                  <strong>Pickup details</strong>
                  <span>Shown only when pickup is enabled</span>
                </div>
                <div className="settings-fields settings-nested-fields">
                  <label>
                    Pickup label
                    <input
                      name="pickupLabel"
                      required
                      maxLength={150}
                      defaultValue={settings.pickupLabel}
                    />
                  </label>
                  <label>
                    Pickup city
                    <input
                      name="pickupCity"
                      required
                      maxLength={150}
                      defaultValue={settings.pickupCity}
                    />
                  </label>
                  <label className="settings-wide">
                    Pickup address <small>Optional</small>
                    <input
                      name="pickupAddress"
                      maxLength={500}
                      defaultValue={settings.pickupAddress ?? ''}
                    />
                  </label>
                  <label>
                    Pickup country
                    <select
                      name="pickupCountry"
                      defaultValue={settings.pickupCountry}
                    >
                      {countries.map(([code, name]) => (
                        <option key={code} value={code}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            ) : (
              <>
                <input
                  type="hidden"
                  name="pickupLabel"
                  value={settings.pickupLabel}
                />
                <input
                  type="hidden"
                  name="pickupAddress"
                  value={settings.pickupAddress ?? ''}
                />
                <input
                  type="hidden"
                  name="pickupCity"
                  value={settings.pickupCity}
                />
                <input
                  type="hidden"
                  name="pickupCountry"
                  value={settings.pickupCountry}
                />
              </>
            )}
            <label>
              Default customer country
              <select
                name="defaultCountry"
                defaultValue={settings.defaultCountry}
              >
                {countries.map(([code, name]) => (
                  <option key={code} value={code}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <fieldset className="settings-wide settings-country-options">
              <legend>Countries you deliver to</legend>
              <p>Select every destination currently available at checkout.</p>
              <div>
                {countries.map(([code, name]) => (
                  <label key={code}>
                    <input
                      type="checkbox"
                      name="supportedCountryCodes"
                      value={code}
                      defaultChecked={settings.supportedCountryCodes.includes(
                        code,
                      )}
                    />
                    <span>{name}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="settings-wide">
              Checkout notice
              <textarea
                name="checkoutNotice"
                required
                maxLength={500}
                rows={4}
                defaultValue={settings.checkoutNotice}
              />
            </label>
          </SectionForm>
        </section>

        <section hidden={active !== 'catalog'}>
          <SectionForm
            section="catalog"
            eyebrow="Internal default"
            title="Catalog defaults"
            description="Set sensible starting values so every new product takes fewer steps to publish."
            impact="The product wizard only. Existing products remain exactly as they are."
            preview={
              <div className="settings-shop-preview settings-default-preview">
                <span>Next new product</span>
                <strong>{settings.defaultCurrency}</strong>
                <p>
                  {settings.defaultProductionMinDays}–
                  {settings.defaultProductionMaxDays} production days
                </p>
              </div>
            }
            busy={busy === 'catalog'}
            dirty={dirty.has('catalog')}
            result={result.catalog ?? null}
            onDirty={() => markDirty('catalog')}
            onDiscard={() => clearDirty('catalog')}
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              void save('catalog', 'settings/catalog-defaults', {
                version: settings.version,
                defaultCurrency: text(form, 'defaultCurrency').toUpperCase(),
                defaultProductionMinDays: Number(
                  form.get('defaultProductionMinDays'),
                ),
                defaultProductionMaxDays: Number(
                  form.get('defaultProductionMaxDays'),
                ),
              });
            }}
          >
            <label>
              Default currency
              <select
                name="defaultCurrency"
                defaultValue={settings.defaultCurrency}
              >
                <option value="USD">USD — US dollar</option>
                <option value="EUR">EUR — Euro</option>
                <option value="GBP">GBP — British pound</option>
                <option value="AED">AED — UAE dirham</option>
              </select>
            </label>
            <span />
            <label>
              Minimum production days
              <input
                name="defaultProductionMinDays"
                required
                type="number"
                min={1}
                max={365}
                defaultValue={settings.defaultProductionMinDays}
              />
            </label>
            <label>
              Maximum production days
              <input
                name="defaultProductionMaxDays"
                required
                type="number"
                min={1}
                max={365}
                defaultValue={settings.defaultProductionMaxDays}
              />
            </label>
            <div className="settings-wide settings-note">
              <strong>Safe by default</strong>
              <p>
                These values prefill the next product wizard. Published prices
                and production promises are never rewritten.
              </p>
            </div>
          </SectionForm>
        </section>

        <section hidden={active !== 'security'}>
          <div className="settings-section-layout">
            <aside className="settings-context">
              <p className="eyebrow">Private workspace</p>
              <h2>Account & security</h2>
              <p>
                Manage the identity used in the admin and protect access to the
                workspace.
              </p>
              <div className="settings-impact">
                <span aria-hidden="true">✓</span>
                <p>
                  <strong>Private by design</strong>None of these details are
                  displayed in the customer storefront.
                </p>
              </div>
            </aside>
            <div className="settings-security-stack">
              <form
                className="settings-editor"
                onChange={() => markDirty('profile')}
                onSubmit={(event) => void saveProfile(event)}
              >
                <div className="settings-editor-heading">
                  <div>
                    <span>Profile</span>
                    <strong>Your admin identity</strong>
                  </div>
                  <span
                    className={`settings-save-state ${dirty.has('profile') ? 'dirty' : ''}`}
                  >
                    {dirty.has('profile') ? 'Unsaved' : 'Up to date'}
                  </span>
                </div>
                <div className="settings-fields">
                  <label>
                    Display name
                    <input
                      name="fullName"
                      required
                      minLength={2}
                      maxLength={150}
                      defaultValue={session.admin.fullName ?? ''}
                    />
                  </label>
                  <label>
                    Login email
                    <input
                      value={session.admin.email}
                      readOnly
                      aria-describedby="email-help"
                    />
                    <small id="email-help">
                      Contact deployment support to change this.
                    </small>
                  </label>
                </div>
                {result.profile ? (
                  <p
                    className={`settings-result ${result.profile.kind}`}
                    role="status"
                  >
                    {result.profile.message}
                  </p>
                ) : null}
                <footer
                  className={`settings-action-bar ${dirty.has('profile') ? 'is-dirty' : ''}`}
                >
                  <span>
                    {dirty.has('profile')
                      ? 'Your profile has unsaved changes.'
                      : 'Your profile is saved.'}
                  </span>
                  <div>
                    {dirty.has('profile') ? (
                      <button
                        type="reset"
                        className="secondary-button"
                        onClick={() => clearDirty('profile')}
                      >
                        Discard
                      </button>
                    ) : null}
                    <button
                      className="primary-button"
                      disabled={!dirty.has('profile') || busy === 'profile'}
                    >
                      {busy === 'profile' ? 'Saving…' : 'Save profile'}
                    </button>
                  </div>
                </footer>
              </form>
              <form
                className="settings-editor settings-danger-zone"
                onSubmit={(event) => void changePassword(event)}
              >
                <div className="settings-editor-heading">
                  <div>
                    <span>Security</span>
                    <strong>Change password</strong>
                  </div>
                </div>
                <div className="settings-fields">
                  <label className="settings-wide">
                    Current password
                    <input
                      name="currentPassword"
                      type="password"
                      autoComplete="current-password"
                      required
                      maxLength={128}
                    />
                  </label>
                  <label>
                    New password
                    <input
                      name="newPassword"
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength={12}
                      maxLength={128}
                    />
                  </label>
                  <label>
                    Confirm new password
                    <input
                      name="confirmPassword"
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength={12}
                      maxLength={128}
                    />
                  </label>
                </div>
                {result.password ? (
                  <p
                    className={`settings-result ${result.password.kind}`}
                    role="alert"
                  >
                    {result.password.message}
                  </p>
                ) : null}
                <footer className="settings-action-bar settings-password-action">
                  <span>
                    Changing your password signs out every admin session.
                  </span>
                  <div>
                    <button
                      className="danger-button"
                      disabled={busy === 'password'}
                    >
                      {busy === 'password' ? 'Changing…' : 'Change password'}
                    </button>
                  </div>
                </footer>
              </form>
            </div>
          </div>
        </section>

        <section hidden={active !== 'system'}>
          <div className="settings-section-layout">
            <aside className="settings-context">
              <p className="eyebrow">Read-only</p>
              <h2>System status</h2>
              <p>
                See which external services are connected without exposing
                private credentials.
              </p>
              <span className="environment-badge">
                {systemStatus.environment}
              </span>
            </aside>
            <div className="settings-editor settings-system-panel">
              <div className="settings-editor-heading">
                <div>
                  <span>Connections</span>
                  <strong>
                    {readyChecks} of {systemStatus.checks.length} services ready
                  </strong>
                </div>
              </div>
              <div className="system-check-list">
                {systemStatus.checks.map((check) => (
                  <article key={check.key}>
                    <span
                      className={`system-dot ${check.ready ? 'ready' : 'pending'}`}
                      aria-hidden="true"
                    />
                    <div>
                      <strong>{check.label}</strong>
                      <p>{check.detail}</p>
                    </div>
                    <span
                      className={`status-pill ${check.ready ? 'active' : 'draft'}`}
                    >
                      {check.ready ? 'Ready' : 'Not connected'}
                    </span>
                  </article>
                ))}
              </div>
              <div className="settings-note">
                <strong>Managed at deployment</strong>
                <p>
                  Secrets, storage paths and provider credentials remain in the
                  server environment and are never displayed here.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
