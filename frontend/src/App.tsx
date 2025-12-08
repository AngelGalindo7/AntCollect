import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import SignUp from './pages/SignUp'
import LogIn from './pages/login'
function App(){
  return (
    <BrowserRouter>
    <Routes>
      <Route path="/" element={<LogIn />} />
    </Routes>
    </BrowserRouter>
  )
}

export default App