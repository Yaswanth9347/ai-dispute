"use client";

import { useState, useEffect } from "react";
import {
  Shield,
  Lock,
  Bell,
  Eye,
  Save,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { apiFetch } from "@/lib/fetchClient";

export default function SecuritySettings() {
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    twoFactorEnabled: false,
    emailNotifications: true,
    pushNotifications: true,
    caseUpdates: true,
    settlementAlerts: true,
    securityAlerts: true,
    sessionTimeout: "30",
    passwordExpiry: "90",
    loginHistory: true,
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiFetch("/users/settings/security", {
        method: "PUT",
        body: JSON.stringify(settings),
      });
      setStatus({ type: 'success', text: 'Security settings updated successfully.' });
    } catch (error) {
      console.error("Error updating settings:", error);
      setStatus({ type: 'error', text: 'Failed to update settings' });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = () => {
    setStatus({ type: 'info', text: 'Change password functionality coming soon!' });
  };

  const [status, setStatus] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  useEffect(() => {
    if (!status) return;
    const t = setTimeout(() => setStatus(null), 4000);
    return () => clearTimeout(t);
  }, [status]);

  return (
    <div className="max-w-4xl mx-auto space-y-10">
      {status && (
        <div role="status" className={`mb-4 p-3 rounded ${status.type === 'success' ? 'bg-green-50 text-green-800' : status.type === 'error' ? 'bg-red-50 text-red-800' : 'bg-blue-50 text-blue-800'}`}>
          <div className="flex items-center justify-between">
            <div>{status.text}</div>
            <button onClick={() => setStatus(null)} className="ml-3 text-sm opacity-70 hover:opacity-100">✕</button>
          </div>
        </div>
      )}
      {/* Section 1: Security Settings */}
      <div className="rounded-2xl bg-white/80 backdrop-blur-md shadow-lg border border-gray-100 transition-all hover:shadow-xl">
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-6 rounded-t-2xl text-white">
          <div className="flex items-center space-x-3">
            <Shield className="w-6 h-6" />
            <div>
              <h2 className="text-2xl font-semibold">Security Settings</h2>
              <p className="text-blue-100 text-sm">
                Manage your account protection and access control
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Two Factor Auth */}
          <ToggleRow
            icon={<Lock className="w-5 h-5 text-blue-600" />}
            title="Two-Factor Authentication"
            desc="Add an extra layer of protection to your account."
            value={settings.twoFactorEnabled}
            onChange={(v) => setSettings({ ...settings, twoFactorEnabled: v })}
          />

          {/* Change Password */}
          <div className="flex items-center justify-between py-4 border-t border-gray-200">
            <div className="flex items-start space-x-3">
              <Lock className="w-5 h-5 text-blue-600 mt-1" />
              <div>
                <h3 className="font-semibold text-gray-900">Password</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Last changed 30 days ago
                </p>
              </div>
            </div>
            <button
              onClick={handleChangePassword}
              className="px-4 py-2 bg-blue-50 text-blue-700 font-medium rounded-lg hover:bg-blue-100 transition"
            >
              Change Password
            </button>
          </div>

          {/* Session Timeout */}
          <div className="border-t border-gray-200 pt-4">
            <div className="flex items-start space-x-3 mb-3">
              <Eye className="w-5 h-5 text-blue-600 mt-1" />
              <div>
                <h3 className="font-semibold text-gray-900">
                  Session Timeout
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Automatically log out after a period of inactivity
                </p>
              </div>
            </div>
            <select
              value={settings.sessionTimeout}
              onChange={(e) =>
                setSettings({ ...settings, sessionTimeout: e.target.value })
              }
              className="w-full md:w-64 px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="15">15 minutes</option>
              <option value="30">30 minutes</option>
              <option value="60">1 hour</option>
              <option value="120">2 hours</option>
              <option value="never">Never</option>
            </select>
          </div>

          {/* Login History */}
          <ToggleRow
            icon={<Eye className="w-5 h-5 text-blue-600" />}
            title="Login History"
            desc="Track login activity and devices."
            value={settings.loginHistory}
            onChange={(v) => setSettings({ ...settings, loginHistory: v })}
          />
        </div>
      </div>

      {/* Section 2: Notifications */}
      <div className="rounded-2xl bg-white/80 backdrop-blur-md shadow-lg border border-gray-100 transition-all hover:shadow-xl">
        <div className="bg-gradient-to-r from-emerald-500 to-green-600 p-6 rounded-t-2xl text-white">
          <div className="flex items-center space-x-3">
            <Bell className="w-6 h-6" />
            <div>
              <h2 className="text-xl font-semibold">Notification Preferences</h2>
              <p className="text-emerald-100 text-sm">
                Choose how you want to stay informed
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <ToggleRow
            title="Email Notifications"
            desc="Receive updates via email."
            value={settings.emailNotifications}
            onChange={(v) => setSettings({ ...settings, emailNotifications: v })}
          />

          <ToggleRow
            title="Push Notifications"
            desc="Get browser push notifications."
            value={settings.pushNotifications}
            onChange={(v) => setSettings({ ...settings, pushNotifications: v })}
          />

          <ToggleRow
            title="Case Updates"
            desc="Be notified about case progress."
            value={settings.caseUpdates}
            onChange={(v) => setSettings({ ...settings, caseUpdates: v })}
          />

          <ToggleRow
            title="Settlement Alerts"
            desc="Receive updates about settlement offers."
            value={settings.settlementAlerts}
            onChange={(v) => setSettings({ ...settings, settlementAlerts: v })}
          />

          <ToggleRow
            title="Security Alerts"
            desc="Critical alerts for account security."
            value={settings.securityAlerts}
            onChange={(v) => setSettings({ ...settings, securityAlerts: v })}
          />
        </div>
      </div>

      {/* Section 3: Danger Zone */}
      <div className="rounded-2xl border border-red-300 bg-gradient-to-br from-red-50 to-white shadow-lg transition hover:shadow-xl">
        <div className="bg-gradient-to-r from-red-600 to-rose-700 p-6 rounded-t-2xl text-white">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="w-6 h-6" />
            <div>
              <h2 className="text-xl font-semibold">Danger Zone</h2>
              <p className="text-red-100 text-sm">
                Irreversible and destructive actions
              </p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-gray-900">Delete Account</h3>
              <p className="text-sm text-gray-600">
                Permanently delete your account and all data.
              </p>
            </div>
            <button className="px-4 py-2 bg-red-600 text-white font-medium rounded-lg shadow-sm hover:bg-red-700 transition">
              Delete Account
            </button>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end pt-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center space-x-2 px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium rounded-lg hover:from-blue-700 hover:to-indigo-700 shadow-md disabled:opacity-50 transition"
        >
          {saving ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              <span>Save Settings</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

/* 🔹 Reusable Toggle Row Component */
function ToggleRow({
  icon,
  title,
  desc,
  value,
  onChange,
}: {
  icon?: React.ReactNode;
  title: string;
  desc: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-4 border-t border-gray-200">
      <div className="flex items-start space-x-3">
        {icon}
        <div>
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <p className="text-sm text-gray-600 mt-1">{desc}</p>
        </div>
      </div>
      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          checked={value}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only peer"
        />
        <div className="w-11 h-6 bg-gray-200 rounded-full peer-focus:ring-4 peer-focus:ring-blue-300 peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full shadow-sm"></div>
      </label>
    </div>
  );
}
