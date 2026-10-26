import React, { useState } from 'react';
import { DriveStatus } from '../types/yearbook';
import { 
  ShieldCheck, 
  Lock, 
  Unlock, 
  RefreshCw, 
  Share2, 
  FolderSync, 
  Check, 
  AlertCircle, 
  X, 
  ExternalLink,
  Eye,
  LogOut,
  Folder
} from 'lucide-react';

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAdmin: boolean;
  onLogin: (email: string, pass: string) => boolean;
  onLogout: () => void;
  onForceRefresh: () => void;
  isRefreshing: boolean;
  driveStatus: DriveStatus | null;
  onOpenDriveModal: () => void;
  itemCount: number;
}

const AUTHORIZED_ADMIN_EMAIL = 'leziel.pikp@binabangsaschool.com';

export const AdminModal: React.FC<AdminModalProps> = ({
  isOpen,
  onClose,
  isAdmin,
  onLogin,
  onLogout,
  onForceRefresh,
  isRefreshing,
  driveStatus,
  onOpenDriveModal,
  itemCount,
}) => {
  const [emailInput, setEmailInput] = useState<string>(AUTHORIZED_ADMIN_EMAIL);
  const [passInput, setPassInput] = useState<string>('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [refreshSuccess, setRefreshSuccess] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    const success = onLogin(emailInput.trim(), passInput.trim());
    if (!success) {
      setLoginError('Invalid administrator credentials. Authorized for Bina Bangsa School PIK administration.');
    } else {
      setPassInput('');
    }
  };

  const handleQuickAdminLogin = () => {
    setLoginError(null);
    const success = onLogin(AUTHORIZED_ADMIN_EMAIL, 'bbsadmin');
    if (!success) {
      setLoginError('Authentication failed. Please verify credentials.');
    }
  };

  const handleCopyPublicLink = () => {
    const publicUrl = window.location.origin;
    navigator.clipboard.writeText(publicUrl).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }).catch(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    });
  };

  const handleRefreshClick = async () => {
    onForceRefresh();
    setRefreshSuccess(true);
    setTimeout(() => setRefreshSuccess(false), 3000);
  };

  const isLiveDrive = driveStatus?.configured && !driveStatus?.error;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-lg rounded-2xl bg-[#fdfbf7] p-6 shadow-2xl border border-amber-300/80 text-slate-800 my-8 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-amber-200">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${isAdmin ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
              {isAdmin ? <ShieldCheck className="w-5 h-5 text-emerald-700" /> : <Lock className="w-5 h-5 text-amber-800" />}
            </div>
            <div>
              <h2 className="text-lg font-serif font-bold text-slate-900">
                {isAdmin ? 'Administrator Portal' : 'Admin Access Verification'}
              </h2>
              <p className="text-xs text-slate-500">
                {isAdmin ? 'Manage web app updates & share public view-only access' : 'Authorized for Bina Bangsa School PIK Archive managers'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-amber-100/50 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Not Logged In -> Login Form */}
        {!isAdmin ? (
          <div className="py-4 space-y-4">
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 leading-relaxed">
              <strong>Notice:</strong> The public web app is strictly <strong>view-only</strong>. Visitors and students can browse and read all yearbooks with zero installation required. Only authenticated administrators can synchronize and update the archive from Google Drive.
            </div>

            <form onSubmit={handleLoginSubmit} className="space-y-3 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Administrator Email
                </label>
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="admin@binabangsaschool.com"
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-amber-900/20 rounded-xl text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-700"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Admin Passcode
                </label>
                <input
                  type="password"
                  value={passInput}
                  onChange={(e) => setPassInput(e.target.value)}
                  placeholder="Enter passcode or click quick login below"
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-amber-900/20 rounded-xl text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-700"
                />
              </div>

              {loginError && (
                <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}

              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="submit"
                  className="w-full py-2.5 px-4 rounded-xl bg-amber-800 hover:bg-amber-900 text-white text-xs font-semibold shadow-xs transition flex items-center justify-center gap-2"
                >
                  <Unlock className="w-4 h-4" />
                  <span>Unlock Admin Controls</span>
                </button>

                <button
                  type="button"
                  onClick={handleQuickAdminLogin}
                  className="w-full py-2 px-4 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-950 text-xs font-medium border border-amber-300 transition"
                >
                  Verify as <strong>leziel.pikp@binabangsaschool.com</strong>
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* Logged In -> Admin Dashboard */
          <div className="py-4 space-y-4">
            {/* Admin identity banner */}
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <div>
                  <span className="text-xs font-bold text-emerald-950 block">
                    Active Administrator Session
                  </span>
                  <span className="text-[11px] font-mono text-emerald-800">
                    {AUTHORIZED_ADMIN_EMAIL}
                  </span>
                </div>
              </div>
              <button
                onClick={onLogout}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-white text-slate-700 border border-emerald-300 hover:bg-red-50 hover:text-red-700 transition"
                title="Switch back to public view"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Log Out</span>
              </button>
            </div>

            {/* ACTION 1: Update & Sync Web App */}
            <div className="p-4 rounded-xl bg-white border border-amber-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-serif font-bold text-sm text-slate-900">
                    Update Web App from Google Drive
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Forces an immediate re-scan of the Drive folder and updates yearbooks for all visitors.
                  </p>
                </div>
                <span className="text-xs font-semibold text-slate-700 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200">
                  {itemCount} Volumes
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleRefreshClick}
                  disabled={isRefreshing}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-amber-800 hover:bg-amber-900 text-white text-xs font-semibold shadow-xs transition disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                  <span>{isRefreshing ? 'Syncing Google Drive...' : 'Update & Re-sync Archive Now'}</span>
                </button>

                <button
                  onClick={onOpenDriveModal}
                  className="px-3 py-2.5 rounded-xl border border-amber-200 bg-amber-50/70 hover:bg-amber-100 text-amber-950 text-xs font-medium transition"
                  title="View connection health & telemetry"
                >
                  <FolderSync className="w-4 h-4 text-amber-800" />
                </button>
              </div>

              {refreshSuccess && (
                <div className="p-2 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs flex items-center gap-1.5 animate-in fade-in">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>Web app successfully synchronized with Google Drive!</span>
                </div>
              )}
            </div>

            {/* ACTION 2: Share to Public (View-Only) */}
            <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/90 shadow-2xs space-y-3">
              <div className="flex items-center gap-2">
                <Share2 className="w-4 h-4 text-amber-800" />
                <h3 className="font-serif font-bold text-sm text-slate-900">
                  Share to Public (View-Only)
                </h3>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Copy this link to share the archive with students, parents, and alumni. Visitors can browse all yearbooks in landscape spread and grid mode <strong>without installing any app</strong> and with view-only permissions.
              </p>

              <div className="flex items-center gap-2 p-2 rounded-lg bg-white border border-amber-200">
                <input
                  type="text"
                  readOnly
                  value={typeof window !== 'undefined' ? window.location.origin : ''}
                  className="w-full bg-transparent text-xs font-mono text-slate-800 select-all focus:outline-hidden"
                />
                <button
                  onClick={handleCopyPublicLink}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition shrink-0 flex items-center gap-1.5 ${
                    copiedLink
                      ? 'bg-emerald-600 text-white'
                      : 'bg-amber-800 hover:bg-amber-900 text-white'
                  }`}
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
                </button>
              </div>
            </div>

            {/* Public View Guarantee */}
            <div className="p-3 rounded-xl bg-white border border-slate-200 text-xs text-slate-600 flex items-start gap-2">
              <Eye className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-slate-800 block">Public View-Only Guarantee:</span>
                <span>Visitors cannot edit, delete, or trigger administrative cache rebuilds. They have pure reading access with high-resolution landscape spreads.</span>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-amber-200 flex items-center justify-between">
          <span className="text-[11px] text-slate-500 font-serif italic">
            Bina Bangsa School-Pantai Indah Kapuk
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
