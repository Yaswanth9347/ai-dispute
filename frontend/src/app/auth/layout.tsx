import React from 'react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
	// Public/auth pages should not include the global Navbar — the root layout includes it conditionally.
	return (
		<div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
			{children}
		</div>
	);
}
