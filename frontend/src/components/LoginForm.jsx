// src/components/LoginForm.jsx
import { useState } from 'react';
import emailIcon from '../assets/email-icon.svg';
import eyeIcon from '../assets/eye-icon.svg';
import loginIcon from '../assets/login-icon.svg';
import passwordIcon from '../assets/password-icon.svg';
import BrandHeader from './BrandHeader';
import FormField from './FormField';

export default function LoginForm({
  onSubmit,
  onForgotPassword,
  statusMessage,
  isSubmitting,
}) {
  const [passwordVisible, setPasswordVisible] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email');
    const password = formData.get('password');

    onSubmit({ email, password });
  };

  return (
    <section className="login-card" aria-labelledby="portal-title">
      <BrandHeader />

      <form className="login-form" onSubmit={handleSubmit}>
        <FormField htmlFor="email" icon={emailIcon} label="Email ID">
          <input
            autoComplete="username"
            id="email"
            name="email"
            placeholder="admin@devikulamcardbank.in"
            required
            type="email"
            disabled={isSubmitting}
          />
        </FormField>

        <FormField htmlFor="password" icon={passwordIcon} label="Password">
          <input
            autoComplete="current-password"
            id="password"
            name="password"
            placeholder="••••••••••••"
            required
            type={passwordVisible ? 'text' : 'password'}
            disabled={isSubmitting}
          />
          <button
            aria-label={passwordVisible ? 'Hide password' : 'Show password'}
            aria-pressed={passwordVisible}
            className="visibility-toggle"
            onClick={() => setPasswordVisible((visible) => !visible)}
            type="button"
            disabled={isSubmitting}
          >
            <img src={eyeIcon} alt="" />
          </button>
        </FormField>

        <button className="submit-button" type="submit" disabled={isSubmitting}>
          <img src={loginIcon} alt="" />
          <span>{isSubmitting ? 'Verifying...' : 'Login'}</span>
        </button>

        <button
          className="login-link-button"
          onClick={onForgotPassword}
          type="button"
        >
          Forgot password?
        </button>

        {statusMessage && (
          <p aria-live="polite" className="form-status">
            {statusMessage}
          </p>
        )}
      </form>
    </section>
  );
}
