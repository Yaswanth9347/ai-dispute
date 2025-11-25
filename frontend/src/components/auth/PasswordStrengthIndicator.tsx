import React from 'react';
import { usePasswordStrength } from '@/hooks/usePasswordStrength';

interface PasswordStrengthIndicatorProps {
  password: string;
}

export function PasswordStrengthIndicator({ password }: PasswordStrengthIndicatorProps) {
  const strength = usePasswordStrength(password);

  if (!password) return null;

  return (
    <div className="mt-2">
      {/* Strength bars */}
      <div className="flex space-x-1">
        {[0, 1, 2, 3, 4].map((level) => (
          <div
            key={level}
            className={`h-2 flex-1 rounded transition-all duration-300 ${
              level <= strength.score ? strength.color : 'bg-gray-200'
            }`}
          />
        ))}
      </div>

      {/* Strength label */}
      <div className="flex items-center justify-between mt-1">
        <p className="text-xs font-medium text-gray-700">
          Password strength: <span className={`${strength.score >= 3 ? 'text-green-600' : 'text-orange-600'}`}>
            {strength.strength}
          </span>
        </p>
        {strength.crackTime && (
          <p className="text-xs text-gray-500">
            Time to crack: {strength.crackTime}
          </p>
        )}
      </div>

      {/* Feedback */}
      {strength.feedback.warning && (
        <p className="text-xs text-orange-600 mt-1">
          ⚠️ {strength.feedback.warning}
        </p>
      )}
      {strength.feedback.suggestions.length > 0 && (
        <ul className="text-xs text-gray-600 mt-1 list-disc list-inside">
          {strength.feedback.suggestions.map((suggestion, idx) => (
            <li key={idx}>{suggestion}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
