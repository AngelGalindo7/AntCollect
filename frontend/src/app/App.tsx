import React from 'react';
import type { ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import './index.css';
import SignUp from '@/features/auth/pages/SignUp';
import LogIn from '@/features/auth/pages/LogIn';
import UserProfile from '@/features/profile/pages/UserProfile';
import HomePage from '@/features/feed/pages/HomePage';
import SearchResultsPage from '@/features/search/pages/SearchResultsPage';
import CreatePost from '@/features/posts/components/CreatePost';
import Layout from '@/shared/components/Layout/Layout';
import ChatPage from '@/features/messaging/pages/ChatPage';
import SettingsPage from '@/features/settings/pages/SettingsPage';
import CreateFolder from '@/features/create/pages/CreateFolder';
import FolderPage from '@/features/create/pages/FolderPage';
import LibraryPage from '@/features/library/pages/LibraryPage';

function RequireAuth() {
  return localStorage.getItem('userId') ? <Outlet /> : <Navigate to="/Login" replace />;
}

// Catches any render error inside the chat route and shows a recovery UI
// instead of a blank white page. Keyed by conversationId in the route so it
// auto-resets when the user navigates to a different conversation.
interface BoundaryState { hasError: boolean }
class ChatErrorBoundary extends React.Component<{ children: ReactNode }, BoundaryState> {
  state: BoundaryState = { hasError: false };

  static getDerivedStateFromError(): BoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[Chat] Render error:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
          <p className="text-sm text-gray-500">Chat couldn't load. Try refreshing the page.</p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function App(){
  return (
    <BrowserRouter>
    <Routes>
        <Route path="/Login" element={<LogIn />} />
        <Route path="/CreateAccount" element={<SignUp />}/>

      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/create-post" element={<CreatePost />} />
          <Route path="/create-folder" element={<CreateFolder />} />
          <Route path="/folders/:folderId" element={<FolderPage />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/search" element={<SearchResultsPage />} />
          <Route path="/messages/:conversationId" element={<ChatErrorBoundary><ChatPage /></ChatErrorBoundary>} />
          <Route path="/:username" element={<UserProfile />} caseSensitive/>
        </Route>
      </Route>
    </Routes>
    </BrowserRouter>
  )
}

export default App

