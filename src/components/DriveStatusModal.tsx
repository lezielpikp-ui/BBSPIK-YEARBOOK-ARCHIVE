import React, { useState } from 'react';
import { DriveStatus } from '../types/yearbook';
import { 
  FolderSync, 
  CheckCircle2, 
  AlertTriangle, 
  Key, 
  Folder, 
  RefreshCw, 
  X, 
  ExternalLink,
  ShieldCheck,
  FileCheck2,
  Clock
} from 'lucide-react';

interface DriveStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: DriveStatus | null;
  secondsUntilNextPoll: number;
  onForceRefresh: () => void;
  isRefreshing: boolean;
  itemCount: number;
}

export const DriveStatusModal: React.FC<DriveStatusModalProps> = ({
  isOpen,
  onClose,
  status,
  secondsUntilNextPoll,
  onForceRefresh,
  isRefreshing,
  itemCount,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen) return null;

  const isLiveDrive = status?.configured && !status?.error;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-xl rounded-2xl bg-[#fdfbf7] p-6 shadow-2xl border border-amber-200 text-slate-800 my-8 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-amber-200/80">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl ${isLiveDrive ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
              <FolderSync className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-serif font-bold text-slate-900">Google Drive Synchronization</h2>
              <p className="text-xs text-slate-500">Live source-of-truth status &amp; connection telemetry</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-amber-100/50 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Card */}
        <div className="my-5 p-4 rounded-xl border border-amber-200/90 bg-white/70 shadow-xs">
          {/* Prominent Admin Requirement Banner */}
          <div className="mb-4 p-3 rounded-xl bg-amber-500/15 border-2 border-amber-500/40 flex items-start gap-2.5 text-xs text-amber-950">
            <AlertTriangle className="w-4 h-4 text-amber-800 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-amber-900 block text-xs">
                Admin Sharing Requirement:
              </span>
              <p className="mt-0.5 leading-relaxed text-amber-900/90 text-[11px]">
                The source Google Drive folder must be shared as <strong>‘Anyone with the link’ (Viewer)</strong>. This allows the public archive to stream and render yearbooks without requiring visitors to sign in to a Google account.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-amber-100">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${isLiveDrive ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              <span className="font-semibold text-sm text-slate-900">
                {isLiveDrive ? 'Active Google Drive Connection' : 'Showcase Archive Mode (Demo Fallback)'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200/60 self-start sm:self-auto">
              <Clock className="w-3.5 h-3.5 text-amber-700" />
              <span>Next auto-poll in <strong>{secondsUntilNextPoll}s</strong></span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-3 text-xs">
            <div>
              <span className="text-slate-500 block">Active Items:</span>
              <span className="font-semibold text-slate-800 text-sm">{itemCount} Yearbooks</span>
            </div>
            <div>
              <span className="text-slate-500 block">Poll Frequency:</span>
              <span className="font-medium text-slate-700">Every 45 seconds + Window Focus</span>
            </div>
            <div>
              <span className="text-slate-500 block">Folder ID Status:</span>
              <span className={`font-mono font-medium ${status?.hasFolderId ? 'text-emerald-700' : 'text-amber-700'}`}>
                {status?.hasFolderId ? 'Configured' : 'Missing secret'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">API Key Status:</span>
              <span className={`font-mono font-medium ${status?.hasApiKey ? 'text-emerald-700' : 'text-amber-700'}`}>
                {status?.hasApiKey ? 'Configured' : 'Missing secret'}
              </span>
            </div>
          </div>

          {status?.error && (
            <div className="mt-3 p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              <div className="overflow-hidden text-ellipsis">
                <span className="font-semibold">Drive Notice:</span> {status.error}
              </div>
            </div>
          )}
        </div>

        {/* Action button */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={onForceRefresh}
            disabled={isRefreshing}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-amber-800 hover:bg-amber-900 text-amber-50 py-2.5 px-4 text-xs font-semibold shadow-xs transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Checking Drive Folder...' : 'Force Refresh Now'}</span>
          </button>
        </div>

        {/* Setup guide & Security Restrictions */}
        <div className="space-y-4 text-xs">
          {/* Security: Restrict Key */}
          <div className="p-4 rounded-xl bg-emerald-50/80 border border-emerald-200/80 text-emerald-950">
            <h3 className="font-serif font-bold text-sm mb-1.5 flex items-center gap-2 text-emerald-900">
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              Security: Restrict API Key to Drive API Only
            </h3>
            <p className="text-emerald-800 leading-relaxed text-[11px] mb-2">
              This application only interacts with the Google Drive API (<code className="font-mono bg-emerald-100/80 px-1 py-0.5 rounded text-[10px]">drive.googleapis.com</code>). To lock down your key in Google Cloud Console:
            </p>
            <ol className="list-decimal list-inside space-y-1 text-[11px] text-emerald-900 font-medium pl-1">
              <li>Open <strong>Google Cloud Console → APIs &amp; Services → Credentials</strong>.</li>
              <li>Click your API key to open its settings.</li>
              <li>Under <strong>API restrictions</strong>, select <strong>"Restrict key"</strong>.</li>
              <li>In the dropdown, select <strong>"Google Drive API"</strong> and click <strong>Save</strong>.</li>
            </ol>
          </div>

          <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/70">
            <h3 className="font-serif font-bold text-slate-900 text-sm mb-2 flex items-center gap-2">
              <Folder className="w-4 h-4 text-amber-800" />
              Connected Drive Credentials
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-amber-200">
                <div className="flex items-center gap-2">
                  <Folder className="w-4 h-4 text-amber-700 shrink-0" />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-slate-800">PERMANENT_DRIVE_FOLDER_ID</span>
                      <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 text-[9px] font-bold uppercase tracking-wider">Permanent Source</span>
                    </div>
                    <span className="text-[11px] font-mono text-slate-600 block">1t7nywiFhuJSq97UznMrxBWOC36vG-tzZ</span>
                  </div>
                </div>
                <button
                  onClick={() => copyToClipboard('1t7nywiFhuJSq97UznMrxBWOC36vG-tzZ', 'folder')}
                  className="px-2 py-1 rounded bg-amber-100 hover:bg-amber-200 text-amber-900 text-[11px] font-medium transition shrink-0"
                >
                  {copiedKey === 'folder' ? 'Copied' : 'Copy ID'}
                </button>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-amber-200">
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-amber-700 shrink-0" />
                  <div>
                    <span className="font-mono font-bold text-slate-800">GOOGLE_DRIVE_API_KEY</span>
                    <span className="text-[11px] text-slate-500 block">AIzaSyD6XIv17-DG...4GY2RdJf3MQ (Drive API restricted)</span>
                  </div>
                </div>
                <button
                  onClick={() => copyToClipboard('GOOGLE_DRIVE_API_KEY', 'key')}
                  className="px-2 py-1 rounded bg-amber-100 hover:bg-amber-200 text-amber-900 text-[11px] font-medium transition shrink-0"
                >
                  {copiedKey === 'key' ? 'Copied' : 'Copy Name'}
                </button>
              </div>
            </div>
          </div>

          {/* Folder permissions note */}
          <div className="p-3.5 rounded-xl bg-white border border-amber-200 shadow-2xs">
            <h4 className="font-bold text-slate-800 mb-1 flex items-center gap-1.5">
              <FileCheck2 className="w-4 h-4 text-emerald-600" />
              Source Folder Sharing
            </h4>
            <p className="text-slate-600 leading-relaxed text-[11px]">
              Ensure folder access is set to <strong>"Anyone with the link can view"</strong> so all students, alumni, and families can open and flip pages without restriction.
            </p>
          </div>

          {/* 250MB limit & streaming note */}
          <div className="p-3.5 rounded-xl bg-white border border-slate-200">
            <h4 className="font-bold text-slate-800 mb-1">
              Large File &amp; PDF Streaming (Up to 250 MB)
            </h4>
            <p className="text-slate-600 leading-relaxed text-[11px]">
              The server uses HTTP Range streaming to progressively stream PDFs and image sequences up to <strong>250 MB</strong>. Readers do not have to wait for the entire book to download before turning the first page.
            </p>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-amber-200/80 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
