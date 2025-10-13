"use client";

import { useState, useEffect } from "react";
import { useRouter } from 'next/navigation';
import {
  User,
  Mail,
  Phone,
  Building,
  Camera,
  Save,
  Loader2,
} from "lucide-react";
import { apiFetch } from "@/lib/fetchClient";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  organization?: string;
  role: string;
  avatar?: string;
  bio?: string;
  createdAt: string;
}

export default function UserProfileEditor() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [status, setStatus] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // auto-dismiss status messages after 4 seconds
  useEffect(() => {
    if (!status) return;
    const t = setTimeout(() => setStatus(null), 4000);
    return () => clearTimeout(t);
  }, [status]);

  useEffect(() => {
    // If there's no auth token, send user to login immediately.
    // This avoids rendering a confusing "Failed to load profile" message
    // when the real issue is that the user is not authenticated.
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      if (!token) {
        router.push('/auth/login');
        return;
      }
    } catch (e) {
      // ignore localStorage errors and try to fetch profile (fetchProfile will handle 401)
    }
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await apiFetch("/users/profile");
      if (response.status === 401) {
        // Not authenticated — redirect to login so user can sign in
        if (typeof window !== 'undefined') {
          localStorage.removeItem('auth_token');
          window.location.href = '/auth/login';
        }
        return;
      }
      if (response.ok) {
        const data = await response.json();
        setProfile(data.data);
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem("auth_token");
      const response = await apiFetch("/users/profile", {
        method: "PUT",
        body: JSON.stringify(profile),
      });
      if (response.ok) {
        setStatus({ type: 'success', text: 'Profile updated successfully.' });
      } else {
        const body = await response.json().catch(() => null);
        setStatus({ type: 'error', text: body?.message || 'Failed to update profile' });
      }
    } catch (error) {
      console.error("Error updating profile:", error);
      setStatus({ type: 'error', text: (error && (error as any).message) || 'Failed to update profile' });
    } finally {
      setSaving(false);
    }
  };

  // Updated to use new backend endpoint for profile photo upload
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("photo", file);

    try {
      // Use native fetch to avoid apiFetch setting JSON headers for FormData
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      const url = `${(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api').replace(/\/api$/, '')}/api/users/profile/photo`;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(url, {
        method: 'POST',
        body: formData,
        headers,
        credentials: 'include',
      });

      const respBody = await response.json().catch(() => null);
      if (!response.ok) {
        console.error('Upload failed', response.status, respBody);
        alert(`Upload failed: ${respBody && (respBody.message || respBody.error) ? (respBody.message || respBody.error) : response.status}`);
        return;
      }
      // After upload, fetch the profile which now contains absolute URL
      await fetchProfile();
    } catch (err: any) {
      console.error('Error uploading avatar:', err);
      alert('Failed to upload image: ' + (err && (err.message || String(err))));
    }
  };

  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );

  if (!profile)
    return (
      <div className="text-center py-12 text-gray-500">
        Failed to load profile
      </div>
    );

  return (
    <div className="max-w-4xl mx-auto">
      {/* Inline status message */}
      {status && (
        <div
          role="status"
          className={`mb-4 p-3 rounded ${status.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
          <div className="flex items-center justify-between">
            <div>{status.text}</div>
            <button onClick={() => setStatus(null)} className="ml-3 text-sm opacity-70 hover:opacity-100">✕</button>
          </div>
        </div>
      )}
      {/* HEADER */}
      <div className="relative bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-8 rounded-2xl shadow-md mb-10 text-white">
        <div className="flex items-center space-x-6">
          <div className="relative group">
            <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-white shadow-lg transform group-hover:scale-105 transition-transform">
              {profile.avatar ? (
                <img
                  src={`${profile.avatar}?t=${Date.now()}`}
                  alt={profile.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-white/20 text-3xl font-bold">
                  {profile.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <label className="absolute bottom-0 right-0 bg-white text-blue-600 rounded-full p-2 cursor-pointer shadow-md hover:bg-blue-100 transition">
              <Camera className="w-4 h-4" />
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
              />
            </label>
          </div>
          <div>
            <h2 className="text-3xl font-bold">{profile.name}</h2>
            <p className="text-blue-100">{profile.email}</p>
            <p className="text-sm text-blue-200 mt-1">
              Member since {new Date(profile.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>

      {/* FORM CARD */}
      <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-lg border border-gray-100 p-8 space-y-6 transition-all duration-300 hover:shadow-xl">
        <h3 className="text-xl font-semibold text-gray-800 border-b pb-2">
          Profile Information
        </h3>

        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
            <User className="w-4 h-4 mr-2 text-blue-600" /> Full Name
          </label>
          <input
            type="text"
            value={profile.name}
            onChange={(e) => setProfile({ ...profile, name: e.target.value })}
            className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          />
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
            <Mail className="w-4 h-4 mr-2 text-blue-600" /> Email Address
          </label>
          <input
            type="email"
            value={profile.email}
            onChange={(e) => setProfile({ ...profile, email: e.target.value })}
            className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          />
        </div>

        {/* Phone */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
            <Phone className="w-4 h-4 mr-2 text-blue-600" /> Phone Number
          </label>
          <input
            type="tel"
            value={profile.phone || ""}
            onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
            className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            placeholder="+91 98765 43210"
          />
        </div>

        {/* Organization */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
            <Building className="w-4 h-4 mr-2 text-blue-600" /> Organization
          </label>
          <input
            type="text"
            value={profile.organization || ""}
            onChange={(e) =>
              setProfile({ ...profile, organization: e.target.value })
            }
            className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            placeholder="Company or Institution"
          />
        </div>

        {/* Bio */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Bio
          </label>
          <textarea
            value={profile.bio || ""}
            onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
            rows={4}
            className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition resize-none"
            placeholder="Write a short description about yourself..."
          />
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center space-x-2 px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 shadow-md disabled:opacity-50 transition"
          >
            {saving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
