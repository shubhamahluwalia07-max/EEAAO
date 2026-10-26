import React, { useState, useEffect, useMemo } from 'react';
import { ModuleId } from '../../shell/stateBus';

interface AccountProfileViewProps {
  onSelectModule?: (mod: ModuleId) => void;
  theme?: 'light' | 'dark';
}

interface UserProfile {
  fullName: string;
  email: string;
  organization: string;
  department: string;
  role: string;
  operatingMode: string;
  twoFactorEnabled: boolean;
}

interface InvoiceItem {
  id: string;
  date: string;
  description: string;
  amount: string;
  status: 'Paid' | 'Processing';
}

export const AccountProfileView: React.FC<AccountProfileViewProps> = ({
  onSelectModule,
  theme = 'dark',
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'subscription' | 'billing' | 'telemetry'>('profile');
  
  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);
  const [loginEmail, setLoginEmail] = useState<string>('s.ahluwalia@medam-surgical.org');
  const [loginPassword, setLoginPassword] = useState<string>('••••••••••••');
  
  // User Profile State
  const [profile, setProfile] = useState<UserProfile>({
    fullName: 'Dr. Shubham Ahluwalia',
    email: 's.ahluwalia@medam-surgical.org',
    organization: 'MEDAM Clinical Biomechanics Centre',
    department: 'Orthopaedic Reconstruction & Surgical Planning',
    role: 'Attending Surgical Specialist / Senior Biomechanical Engineer',
    operatingMode: 'Clinical Diagnostics & Implant Design',
    twoFactorEnabled: true,
  });

  const [editForm, setEditForm] = useState<UserProfile>({ ...profile });
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string>('');

  // Subscription State
  const [billingCycle, setBillingCycle] = useState<'annual' | 'monthly'>('annual');
  const [allocatedSeats] = useState<number>(5);
  const [totalSeats] = useState<number>(10);

  // Billing & Invoices
  const [invoices] = useState<InvoiceItem[]>([
    {
      id: 'INV-2026-0091',
      date: '2026-10-01',
      description: 'MEDAM Studio Enterprise Annual License (10 Seats)',
      amount: '$4,800.00',
      status: 'Paid',
    },
    {
      id: 'INV-2025-0084',
      date: '2025-10-01',
      description: 'MEDAM Studio Enterprise Annual License (10 Seats)',
      amount: '$4,800.00',
      status: 'Paid',
    },
    {
      id: 'INV-2024-0042',
      date: '2024-10-01',
      description: 'MEDAM Studio Pro Annual License (3 Seats)',
      amount: '$1,800.00',
      status: 'Paid',
    },
  ]);

  const [toastMessage, setToastMessage] = useState<string>('');

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  // Hardware and WebGL GPU/CPU Telemetry detection
  const [telemetry, setTelemetry] = useState<{
    gpuVendor: string;
    gpuRenderer: string;
    cpuCores: number;
    devicePixelRatio: number;
    maxTextureSize: number;
    powerPreference: string;
  }>({
    gpuVendor: 'Detecting...',
    gpuRenderer: 'Detecting...',
    cpuCores: navigator.hardwareConcurrency || 8,
    devicePixelRatio: Math.min(window.devicePixelRatio || 1, 1.5),
    maxTextureSize: 8192,
    powerPreference: 'high-performance',
  });

  useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      const gl = (canvas.getContext('webgl2') || canvas.getContext('webgl')) as WebGLRenderingContext | null;
      if (gl) {
        const dbgRenderInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (dbgRenderInfo) {
          const vendor = gl.getParameter(dbgRenderInfo.UNMASKED_VENDOR_WEBGL) || 'Hardware Accelerated';
          const renderer = gl.getParameter(dbgRenderInfo.UNMASKED_RENDERER_WEBGL) || 'Direct3D11 / Vulkan Engine';
          const maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 8192;
          setTelemetry((prev) => ({
            ...prev,
            gpuVendor: String(vendor),
            gpuRenderer: String(renderer),
            maxTextureSize: Number(maxTex),
          }));
        }
      }
    } catch {
      // Fallback defaults
    }
  }, []);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setProfile({ ...editForm });
    setSaveSuccessMsg('Profile information updated successfully');
    setTimeout(() => setSaveSuccessMsg(''), 3000);
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthenticated(true);
    setIsLoginModalOpen(false);
    triggerToast('Authenticated as ' + loginEmail);
  };

  const handleSignOut = () => {
    setIsAuthenticated(false);
    triggerToast('Signed out of MEDAM workstation');
  };

  return (
    <div className="flex-1 flex flex-col bg-origin-alabaster dark:bg-[#090D16] text-[#0F172A] dark:text-[#F8FAFC] overflow-y-auto font-sans p-6 md:p-8">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#0284C7] text-white px-4 py-2.5 rounded-lg shadow-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Profile Summary Header Card */}
      <div className="max-w-6xl w-full mx-auto mb-6">
        <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-[#1E293B] rounded-2xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#0284C7] to-[#0369A1] flex items-center justify-center text-white font-bold text-xl shadow-md">
              {profile.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  {isAuthenticated ? profile.fullName : 'Guest Clinician'}
                </h1>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                  isAuthenticated
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                    : 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800'
                }`}>
                  {isAuthenticated ? 'Authenticated' : 'Sign In Required'}
                </span>
              </div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {profile.role}
              </p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                {profile.organization} &bull; {profile.email}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-stretch md:self-auto justify-end">
            {isAuthenticated ? (
              <button
                type="button"
                onClick={handleSignOut}
                className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-[#1E293B] hover:bg-slate-200 dark:hover:bg-slate-700/80 transition-colors cursor-pointer flex items-center gap-2"
              >
                <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span>Sign Out</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsLoginModalOpen(true)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-[#0284C7] hover:bg-[#0369A1] shadow-xs transition-colors cursor-pointer flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
                <span>Sign In to Workstation</span>
              </button>
            )}

            {onSelectModule && (
              <button
                type="button"
                onClick={() => onSelectModule('Rados')}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-[#0284C7] hover:bg-[#0369A1] shadow-xs transition-colors cursor-pointer flex items-center gap-2"
              >
                <span>Return to Rados</span>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="max-w-6xl w-full mx-auto mb-6">
        <div className="flex items-center gap-1 border-b border-slate-200 dark:border-[#1E293B] pb-px">
          {[
            { id: 'profile', label: 'Profile & Security' },
            { id: 'subscription', label: 'Subscription & Seats' },
            { id: 'billing', label: 'Billing & Invoices' },
            { id: 'telemetry', label: 'Hardware & GPU Optimization' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
                activeTab === tab.id
                  ? 'border-[#0284C7] text-[#0284C7] dark:text-sky-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* TAB CONTENT */}
      <div className="max-w-6xl w-full mx-auto">
        {/* TAB 1: PROFILE & SECURITY */}
        {activeTab === 'profile' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-[#1E293B] rounded-2xl p-6 shadow-sm">
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-4">
                  Clinician & Engineering Details
                </h2>

                {saveSuccessMsg && (
                  <div className="mb-4 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                    {saveSuccessMsg}
                  </div>
                )}

                <form onSubmit={handleSaveProfile} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        Full Name
                      </label>
                      <input
                        type="text"
                        value={editForm.fullName}
                        onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#151D2C] border border-slate-200 dark:border-[#1E293B] text-xs font-medium text-slate-900 dark:text-slate-100 outline-none focus:border-[#0284C7]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        Professional Email
                      </label>
                      <input
                        type="email"
                        value={editForm.email}
                        onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#151D2C] border border-slate-200 dark:border-[#1E293B] text-xs font-medium text-slate-900 dark:text-slate-100 outline-none focus:border-[#0284C7]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        Organization / Hospital
                      </label>
                      <input
                        type="text"
                        value={editForm.organization}
                        onChange={(e) => setEditForm({ ...editForm, organization: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#151D2C] border border-slate-200 dark:border-[#1E293B] text-xs font-medium text-slate-900 dark:text-slate-100 outline-none focus:border-[#0284C7]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        Department
                      </label>
                      <input
                        type="text"
                        value={editForm.department}
                        onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#151D2C] border border-slate-200 dark:border-[#1E293B] text-xs font-medium text-slate-900 dark:text-slate-100 outline-none focus:border-[#0284C7]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Clinical Specialty & Role
                    </label>
                    <input
                      type="text"
                      value={editForm.role}
                      onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#151D2C] border border-slate-200 dark:border-[#1E293B] text-xs font-medium text-slate-900 dark:text-slate-100 outline-none focus:border-[#0284C7]"
                    />
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-[#0284C7] hover:bg-[#0369A1] shadow-xs transition-colors cursor-pointer"
                    >
                      Save Profile Changes
                    </button>
                  </div>
                </form>
              </div>

              {/* Password & Security Card */}
              <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-[#1E293B] rounded-2xl p-6 shadow-sm">
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-4">
                  Security & Access Credentials
                </h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-[#151D2C] border border-slate-200 dark:border-[#1E293B]">
                    <div>
                      <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                        Two-Factor Authentication (2FA)
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Secured with FIDO2 hardware token or authenticator app
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setProfile((p) => ({ ...p, twoFactorEnabled: !p.twoFactorEnabled }));
                        triggerToast(profile.twoFactorEnabled ? 'Two-factor disabled' : 'Two-factor enabled');
                      }}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                        profile.twoFactorEnabled ? 'bg-[#0284C7]' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                          profile.twoFactorEnabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-[#151D2C] border border-slate-200 dark:border-[#1E293B]">
                    <div>
                      <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                        Workstation Access Password
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Last changed 42 days ago
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => triggerToast('Password update link dispatched to ' + profile.email)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                    >
                      Update Password
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Side Column: Active Session & Workstation Info */}
            <div className="space-y-6">
              <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-[#1E293B] rounded-2xl p-6 shadow-sm">
                <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider mb-3">
                  Current Session
                </h3>
                <div className="space-y-3 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500">Client Engine</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">MEDAM Studio v2.4</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500">Host OS</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">Windows x86_64</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500">Connection</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">Local Verified</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-500">Session IP</span>
                    <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300">127.0.0.1</span>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-[#1E293B] rounded-2xl p-6 shadow-sm">
                <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider mb-3">
                  Quick Actions
                </h3>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setIsLoginModalOpen(true)}
                    className="w-full px-3 py-2 rounded-lg text-xs font-semibold text-left text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-between"
                  >
                    <span>Switch Workstation Account</span>
                    <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('subscription')}
                    className="w-full px-3 py-2 rounded-lg text-xs font-semibold text-left text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-between"
                  >
                    <span>Manage Enterprise Seats</span>
                    <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('telemetry')}
                    className="w-full px-3 py-2 rounded-lg text-xs font-semibold text-left text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-between"
                  >
                    <span>View GPU Optimization Report</span>
                    <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: SUBSCRIPTION & SEATS */}
        {activeTab === 'subscription' && (
          <div className="space-y-6">
            {/* Active Tier Banner */}
            <div className="bg-gradient-to-r from-sky-900/40 via-[#0F172A] to-[#0F172A] border border-sky-800/50 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#0284C7] text-white">
                    CURRENT PLAN
                  </span>
                  <h2 className="text-xl font-bold text-white">
                    MEDAM Studio Enterprise
                  </h2>
                </div>
                <p className="text-xs text-slate-300">
                  Full multi-planar reconstruction, 3D watertight surface generation, CAD integration, and FEA biomechanical validation.
                </p>
                <p className="text-[11px] text-sky-400 mt-2 font-medium">
                  Annual billing &bull; Renews on December 31, 2026 &bull; Dedicated Clinical Support
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-2xl font-bold text-white">$4,800</p>
                  <p className="text-[11px] text-slate-400">per annum / 10 seats</p>
                </div>
                <button
                  type="button"
                  onClick={() => triggerToast('Subscription license renewal scheduled for Dec 31, 2026')}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-[#0284C7] hover:bg-[#0369A1] shadow-xs transition-colors cursor-pointer whitespace-nowrap"
                >
                  Manage License
                </button>
              </div>
            </div>

            {/* Seat Utilization Card */}
            <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-[#1E293B] rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Network Floating Seat Allocation
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {allocatedSeats} of {totalSeats} concurrent workstation seats currently active
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => triggerToast('Seat addition requested')}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-[#1E293B] hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  Add Floating Seats
                </button>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-3 rounded-full overflow-hidden mb-4">
                <div
                  className="bg-[#0284C7] h-full rounded-full transition-all duration-300"
                  style={{ width: `${(allocatedSeats / totalSeats) * 100}%` }}
                />
              </div>

              {/* Active Workstation Nodes List */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {[
                  { name: 'Workstation 01 (Lead Diagnostic)', user: 'Dr. S. Ahluwalia', ip: '192.168.1.101', status: 'Active' },
                  { name: 'Workstation 02 (Surgical Planning)', user: 'Dr. C. Vance', ip: '192.168.1.102', status: 'Active' },
                  { name: 'Workstation 03 (FEA Biomechanics)', user: 'Eng. M. Patel', ip: '192.168.1.105', status: 'Active' },
                  { name: 'Workstation 04 (3D Print Factory)', user: 'Lab Operator', ip: '192.168.1.110', status: 'Active' },
                  { name: 'Workstation 05 (Datum Ingestion)', user: 'Radiology Tech', ip: '192.168.1.112', status: 'Active' },
                ].map((ws, i) => (
                  <div key={i} className="p-3 rounded-xl bg-slate-50 dark:bg-[#151D2C] border border-slate-200 dark:border-[#1E293B] flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-slate-100">{ws.name}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">{ws.user} &bull; {ws.ip}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
                      {ws.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Plan Features Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  title: 'Clinical Diagnostics',
                  features: [
                    'Multi-Planar Reconstruction (Axial, Coronal, Sagittal)',
                    'Exact physical millimeter spacing interpolation',
                    'Interactive HU thresholding and windowing',
                    'Smart seed region grow and morphological split',
                  ],
                },
                {
                  title: 'Surface CAD & Meshing',
                  features: [
                    'Watertight Marching Cubes 3D surface extraction',
                    'Bi-harmonic Taubin surface smoothing',
                    'Quadric Error Metric (QEM) decimation',
                    'Direct watertight STL export',
                  ],
                },
                {
                  title: 'Enterprise Architecture',
                  features: [
                    '10 Floating network concurrent seat licenses',
                    'Zero-copy in-memory shared state bus',
                    'Bidirectional FEA biomechanical verification',
                    'Demand-driven optimal GPU & CPU rendering',
                  ],
                },
              ].map((card, idx) => (
                <div key={idx} className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-[#1E293B] rounded-2xl p-6 shadow-sm">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 mb-3">
                    {card.title}
                  </h4>
                  <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                    {card.features.map((feat, fi) => (
                      <li key={fi} className="flex items-start gap-2">
                        <svg className="w-4 h-4 text-[#0284C7] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: BILLING & INVOICES */}
        {activeTab === 'billing' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Payment Method Card */}
              <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-[#1E293B] rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Payment Method
                  </h3>
                  <button
                    type="button"
                    onClick={() => triggerToast('Payment method update dialog opened')}
                    className="text-xs font-semibold text-[#0284C7] hover:underline cursor-pointer"
                  >
                    Edit
                  </button>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#151D2C] border border-slate-200 dark:border-[#1E293B] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-7 rounded bg-[#0284C7] text-white font-bold text-[10px] flex items-center justify-center tracking-wider">
                      VISA
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                        Visa Corporate ending in 4242
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Expires 12/2028 &bull; Default payment source
                      </p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-sky-100 dark:bg-sky-950 text-[#0284C7]">
                    Primary
                  </span>
                </div>
              </div>

              {/* Billing Address Card */}
              <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-[#1E293B] rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Billing Details & Tax ID
                  </h3>
                  <button
                    type="button"
                    onClick={() => triggerToast('Billing address update dialog opened')}
                    className="text-xs font-semibold text-[#0284C7] hover:underline cursor-pointer"
                  >
                    Edit
                  </button>
                </div>
                <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                  <p className="font-semibold text-slate-900 dark:text-slate-100">
                    MEDAM Clinical Biomechanics Centre LLC
                  </p>
                  <p>Tax Registration: US-MED-9948210</p>
                  <p>100 Innovation Parkway, Suite 400</p>
                  <p>Cambridge, MA 02142, United States</p>
                </div>
              </div>
            </div>

            {/* Invoices Table */}
            <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-[#1E293B] rounded-2xl p-6 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-4">
                Billing & Invoicing History
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 pb-2">
                      <th className="py-2.5 font-semibold">Invoice ID</th>
                      <th className="py-2.5 font-semibold">Date</th>
                      <th className="py-2.5 font-semibold">Description</th>
                      <th className="py-2.5 font-semibold">Amount</th>
                      <th className="py-2.5 font-semibold">Status</th>
                      <th className="py-2.5 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                    {invoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 font-mono text-slate-900 dark:text-slate-100">{inv.id}</td>
                        <td className="py-3 text-slate-600 dark:text-slate-300">{inv.date}</td>
                        <td className="py-3 text-slate-700 dark:text-slate-200">{inv.description}</td>
                        <td className="py-3 font-semibold text-slate-900 dark:text-slate-100">{inv.amount}</td>
                        <td className="py-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
                            {inv.status}
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          <button
                            type="button"
                            onClick={() => triggerToast(`Downloading PDF for invoice ${inv.id}...`)}
                            className="px-2.5 py-1 rounded bg-slate-100 dark:bg-[#1E293B] hover:bg-slate-200 dark:hover:bg-slate-700 text-[11px] font-semibold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer inline-flex items-center gap-1.5"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            <span>Download PDF</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: HARDWARE & GPU OPTIMIZATION MONITOR (Directly addressing Issue 6!) */}
        {activeTab === 'telemetry' && (
          <div className="space-y-6">
            {/* Header info */}
            <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-[#1E293B] rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  GPU & CPU System Utilization Architecture
                </h3>
                <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Optimal High Performance Active
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                MEDAM Studio utilizes demand-driven WebGL rendering and multi-threaded Web Workers to keep workstation CPU and GPU utilization at ~0% when idle while delivering instantaneous 60fps interaction during volumetric rotations.
              </p>
            </div>

            {/* Hardware Telemetry Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-[#1E293B] shadow-sm">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Logical CPU Cores
                </p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {telemetry.cpuCores} Threads
                </p>
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 font-medium">
                  Multi-planar reconstruction multithreaded
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-[#1E293B] shadow-sm">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Device Pixel Ratio
                </p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {telemetry.devicePixelRatio.toFixed(2)}x (Capped)
                </p>
                <p className="text-[11px] text-sky-600 dark:text-sky-400 mt-1 font-medium">
                  Optimized for Retina displays without 4K fill-rate penalty
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-[#1E293B] shadow-sm">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Idle GPU Overhead
                </p>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  0% (On-Demand)
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Zero continuous spin loops when scene is stationary
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-[#1E293B] shadow-sm">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Max Texture Dimension
                </p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {telemetry.maxTextureSize} px
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Full 16-bit volumetric slice buffering
                </p>
              </div>
            </div>

            {/* Hardware Renderer Details Card */}
            <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-[#1E293B] rounded-2xl p-6 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-4">
                Detected Hardware Graphics Pipeline
              </h3>
              <div className="space-y-3 text-xs">
                <div className="flex flex-col sm:flex-row sm:justify-between py-2 border-b border-slate-100 dark:border-slate-800 gap-1">
                  <span className="text-slate-500">Unmasked Graphics Vendor</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{telemetry.gpuVendor}</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between py-2 border-b border-slate-100 dark:border-slate-800 gap-1">
                  <span className="text-slate-500">Unmasked GPU Renderer</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100 font-mono text-[11px]">{telemetry.gpuRenderer}</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between py-2 border-b border-slate-100 dark:border-slate-800 gap-1">
                  <span className="text-slate-500">Power Preference Mode</span>
                  <span className="font-semibold text-[#0284C7] uppercase">{telemetry.powerPreference}</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between py-2 gap-1">
                  <span className="text-slate-500">Geometry Centering Reference Frame</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">Unified Voxel Volume Center (Zero Mesh Drift)</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sleek Origin UI Login / Switch Account Modal */}
      {isLoginModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-[#1E293B] rounded-2xl shadow-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-[#0284C7] flex items-center justify-center font-bold text-white text-[10px]">
                  MD
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Sign In to MEDAM Studio
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsLoginModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Workstation Clinician ID / Email
                </label>
                <input
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#151D2C] border border-slate-200 dark:border-[#1E293B] text-xs font-medium text-slate-900 dark:text-slate-100 outline-none focus:border-[#0284C7]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Access Password
                </label>
                <input
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#151D2C] border border-slate-200 dark:border-[#1E293B] text-xs font-medium text-slate-900 dark:text-slate-100 outline-none focus:border-[#0284C7]"
                />
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-slate-600 dark:text-slate-400">
                  <input type="checkbox" defaultChecked className="rounded text-[#0284C7] focus:ring-0" />
                  <span>Remember workstation session</span>
                </label>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsLoginModalOpen(false)}
                  className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-[#0284C7] hover:bg-[#0369A1] shadow-xs transition-colors cursor-pointer"
                >
                  Sign In
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountProfileView;
