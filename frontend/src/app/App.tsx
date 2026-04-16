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

function RequireAuth() {
  return localStorage.getItem('userId') ? <Outlet /> : <Navigate to="/Login" replace />;
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
          <Route path="/search" element={<SearchResultsPage />} />
          <Route path="/messages/:conversationId" element={<ChatPage />} />
          <Route path="/:username" element={<UserProfile />} caseSensitive/>
        </Route>
      </Route>
    </Routes>
    </BrowserRouter>
  )
}

export default App
