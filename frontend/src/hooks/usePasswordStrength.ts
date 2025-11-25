import { useState, useEffect } from 'react';
import zxcvbn from 'zxcvbn';

export interface PasswordStrength {
  score: number; // 0-4
  feedback: {
    warning: string;
    suggestions: string[];
  };
  crackTime: string;
  strength: 'Very Weak' | 'Weak' | 'Fair' | 'Strong' | 'Very Strong';
  color: string;
}

export function usePasswordStrength(password: string): PasswordStrength {
  const [strength, setStrength] = useState<PasswordStrength>({
    score: 0,
    feedback: { warning: '', suggestions: [] },
    crackTime: '',
    strength: 'Very Weak',
    color: 'bg-red-500',
  });

  useEffect(() => {
    if (!password) {
      setStrength({
        score: 0,
        feedback: { warning: '', suggestions: [] },
        crackTime: '',
        strength: 'Very Weak',
        color: 'bg-red-500',
      });
      return;
    }

    const result = zxcvbn(password);
    
    const strengthLabels: ('Very Weak' | 'Weak' | 'Fair' | 'Strong' | 'Very Strong')[] = [
      'Very Weak',
      'Weak',
      'Fair',
      'Strong',
      'Very Strong',
    ];
    
    const colors = [
      'bg-red-500',
      'bg-orange-500',
      'bg-yellow-500',
      'bg-lime-500',
      'bg-green-500',
    ];

    setStrength({
      score: result.score,
      feedback: {
        warning: result.feedback.warning || '',
        suggestions: result.feedback.suggestions || [],
      },
      crackTime: String(result.crack_times_display.offline_slow_hashing_1e4_per_second || ''),
      strength: strengthLabels[result.score],
      color: colors[result.score],
    });
  }, [password]);

  return strength;
}
