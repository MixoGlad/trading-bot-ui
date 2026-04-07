import React, { useMemo } from 'react';

const PasswordStrength = ({ password }) => {
  const strength = useMemo(() => {
    const checks = {
      length: password.length >= 8,
      lowercase: /[a-z]/.test(password),
      uppercase: /[A-Z]/.test(password),
      number: /[0-9]/.test(password),
      specialChar: /[^a-zA-Z0-9]/.test(password),
    };

    const score = Object.values(checks).filter(Boolean).length;

    let color = '#e74c3c'; // red
    if (score >= 5) {
      color = '#2ecc71'; // green
    } else if (score >= 3) {
      color = '#f39c12'; // orange
    }

    return { score, checks, color };
  }, [password]);

  if (!password) {
    return null;
  }

  return (
    <div className="password-strength-meter">
      <div className="strength-bar-container">
        <div
          className="strength-bar"
          style={{
            width: `${(strength.score / 5) * 100}%`,
            backgroundColor: strength.color,
          }}
        />
      </div>
      <ul className="password-criteria">
        <li className={strength.checks.length ? 'met' : ''}>At least 8 characters</li>
        <li className={strength.checks.lowercase ? 'met' : ''}>A lowercase letter</li>
        <li className={strength.checks.uppercase ? 'met' : ''}>An uppercase letter</li>
        <li className={strength.checks.number ? 'met' : ''}>A number</li>
        <li className={strength.checks.specialChar ? 'met' : ''}>A special character</li>
      </ul>
    </div>
  );
};

export default PasswordStrength;
