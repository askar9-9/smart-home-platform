import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from '../../src/auth/ProtectedRoute';
import { renderApp } from './test-utils';

describe('auth routing', () => {
  it('redirects protected routes without token', () => {
    localStorage.clear();
    renderApp(
      <Routes>
        <Route path="/login" element={<div>Login page</div>} />
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<div>Dashboard</div>} />
        </Route>
      </Routes>,
      '/dashboard'
    );
    expect(screen.getByText('Login page')).toBeInTheDocument();
  });
});
