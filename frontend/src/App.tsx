import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
//import SignUp from './pages/SignUp'
import LogIn from './pages/LogIn'
import UserProfile from './pages/UserProfile'
import HomePage from './pages/HomePage'
import CreatePost from './pages/CreatePost'
function App(){
  return (
    <BrowserRouter>
    <Routes>
      <Route path="/" element={<LogIn />} />
      <Route path="/:username" element={<UserProfile />} />
      <Route path="/Home" element={<HomePage />} />
      <Route path="/create-post" element={<CreatePost />} />
    </Routes>
    </BrowserRouter>
  )
}

export default App