import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import SignUp from '@/features/auth/pages/SignUp';
import LogIn from '@/features/auth/pages/LogIn';
import UserProfile from '@/features/profile/pages/UserProfile';
import HomePage from '@/features/feed/pages/HomePage';
import SearchResultsPage from '@/features/search/pages/SearchResultsPage';
import CreatePost from '@/features/posts/components/CreatePost';
import Layout from '@/shared/components/Layout/Layout';
import ChatPage from '@/features/messaging/pages/ChatPage';

function App(){
  return (
    <BrowserRouter>
    <Routes>
        <Route path="/Login" element={<LogIn />} />
        <Route path="/CreateAccount" element={<SignUp />}/>

      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/:username" element={<UserProfile />} caseSensitive/>
        <Route path="/create-post" element={<CreatePost />} />
        <Route path="/search" element={<SearchResultsPage />} />
        <Route path="/messages/:conversationId" element={<ChatPage />} /> 
        </Route>
    </Routes>
    </BrowserRouter>
  )
}

export default App
