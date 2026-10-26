// src/pages/LoginPage.jsx
import { useState } from 'react';
import LoginForm from '../components/LoginForm';
import LegalNotice from '../components/LegalNotice';
import PasswordResetForm from '../components/PasswordResetForm';
import {
  loginUser,
  resetPassword,
  verifyPasswordReset,
} from '../services/authService';

export default function LoginPage({ onAuthenticated, accessMessage = '' }) {
  const [statusMessage, setStatusMessage] = useState(accessMessage);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  const handleLoginSubmit = async ({ email, password }) => {
    setIsSubmitting(true);
    setStatusMessage('Connecting...');

    try {
      const user = await loginUser(email, password);
      if (user.role !== 'Superadmin' && user.role !== 'Bank') {
        setStatusMessage('This console is only available to Superadmin and Bank accounts.');
        return;
      }
      onAuthenticated(user);
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? error.message
          : 'Unable to authenticate. Please check your credentials.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="login-page">
      <div className="login-content">
        {isResettingPassword ? (
          <PasswordResetForm
            onBack={() => setIsResettingPassword(false)}
            onReset={resetPassword}
            onVerify={verifyPasswordReset}
          />
        ) : (
          <LoginForm
            onSubmit={handleLoginSubmit}
            onForgotPassword={() => setIsResettingPassword(true)}
            statusMessage={statusMessage}
            isSubmitting={isSubmitting}
          />
        )}
        <LegalNotice />
      </div>
    </main>
  );
}
