'use client';

import { LogOut } from 'lucide-react';
import React, { useState } from 'react';

export function LogoutButton({
  csrfToken,
  onComplete = () => window.location.assign('/admin/login'),
}: {
  csrfToken: string;
  onComplete?: () => void;
}) {
  const [loading, setLoading] = useState(false);

  async function logout() {
    if (loading) return;
    setLoading(true);
    try {
      await fetch('/admin/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'x-csrf-token': csrfToken },
      });
    } finally {
      onComplete();
    }
  }

  return (
    <button
      className="logout-button"
      type="button"
      onClick={logout}
      disabled={loading}
      aria-label={loading ? 'Signing out' : 'Sign out'}
      title={loading ? 'Signing out' : 'Sign out'}
    >
      <LogOut aria-hidden="true" size={17} />
      <span className="logout-label">
        {loading ? 'Signing out…' : 'Sign out'}
      </span>
    </button>
  );
}
