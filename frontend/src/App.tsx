import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
//import SignUp from './pages/SignUp'
import LogIn from './pages/LogIn'
import UserProfile from './pages/UserProfile'
import HomePage from './pages/HomePage'
import CreatePost from './pages/CreatePost'
import Layout from './pages/Layout'
function App(){
  return (
    <BrowserRouter>
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<LogIn />} />
        <Route path="/:username" element={<UserProfile />} />
        <Route path="/Home" element={<HomePage />} />
        <Route path="/create-post" element={<CreatePost />} />
        </Route>
    </Routes>
    </BrowserRouter>
  )
}

export default App