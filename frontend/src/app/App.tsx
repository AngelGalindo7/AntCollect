import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { ErrorBoundary } from '@/shared/components/ErrorBoundary';
import './index.css';
import SignUp from '@/features/auth/pages/SignUp';
import LogIn from '@/features/auth/pages/LogIn';
import UserProfile from '@/features/profile/pages/UserProfile';
import HomePage from '@/features/feed/pages/HomePage';
import SearchResultsPage from '@/features/search/pages/SearchResultsPage';
import CreatePost from '@/features/posts/components/CreatePost';
import Layout from '@/shared/components/Layout/Layout';
// DECOMMISSIONED 2026-05-06: trading & messaging — see docs/RECOMMISSION_TRADING_MESSAGING.md
// import type { ReactNode } from 'react';
// import ChatPage from '@/features/messaging/pages/ChatPage';
import SettingsPage from '@/features/settings/pages/SettingsPage';
import CreateFolder from '@/features/create/pages/CreateFolder';
import FolderPage from '@/features/create/pages/FolderPage';
import LibraryPage from '@/features/library/pages/LibraryPage';
import StickersPage from '@/features/stickers/pages/StickersPage';
import SetupProfile from '@/features/auth/pages/SetupProfile';
import AuthComplete from '@/features/auth/pages/AuthComplete';
import { getSession } from '@/shared/auth/session';

function RequireAuth() {
  return getSession() ? <Outlet /> : <Navigate to="/Login" replace />;
}

function App(){
  return (
    <BrowserRouter>
      <ErrorBoundary>
      <Routes>
        {/* Standalone auth pages — no Layout */}
        <Route path="/Login" element={<LogIn />} />
        <Route path="/CreateAccount" element={<SignUp />} />
        <Route path="/setup-profile" element={<SetupProfile />} />
        <Route path="/auth/complete" element={<AuthComplete />} />

        {/* Single Layout instance for all app routes.
            RequireAuth is nested INSIDE Layout so auth users on public routes
            always see the authenticated shell (SideBar etc.) */}
        <Route element={<Layout />}>
          {/* Public — guests can browse */}
          <Route path="/" element={<HomePage />} />
          <Route path="/search" element={<SearchResultsPage />} />
          <Route path="/folders/:folderId" element={<FolderPage />} />

          {/* Protected — RequireAuth redirects guests to /Login */}
          <Route element={<RequireAuth />}>
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/create-post" element={<CreatePost />} />
            <Route path="/create-folder" element={<CreateFolder />} />
            <Route path="/library" element={<LibraryPage />} />
            {/* DECOMMISSIONED 2026-05-06: trading & messaging — see docs/RECOMMISSION_TRADING_MESSAGING.md */}
            {/* <Route path="/messages/:conversationId" element={<ChatErrorBoundary><ChatPage /></ChatErrorBoundary>} /> */}
          </Route>

          {/* Catch-all LAST — must follow specific routes to avoid shadowing /settings etc. */}
          <Route path="/:username/stickers" element={<StickersPage />} />
          <Route path="/:username" element={<UserProfile />} caseSensitive />
        </Route>
      </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  )
}

export default App

