import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import ClawDrip from './App.jsx'
import Tank from './Tank.jsx'
import DesignStudio from './DesignStudio.jsx'
import PayPage from './PayPage.jsx'

// Mock window.storage API with localStorage
window.storage = {
  get: async (key) => {
    const value = localStorage.getItem(key)
    return value ? { value } : null
  },
  set: async (key, value) => {
    localStorage.setItem(key, value)
  }
}

// Inject global fonts
const style = document.createElement('style')
style.textContent = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=Outfit:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
`
document.head.appendChild(style)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ClawDrip />} />
        <Route path="/design" element={<DesignStudio />} />
        <Route path="/tank/:orderNumber" element={<TankWrapper />} />
        <Route path="/pay/:giftId" element={<PayPage />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)

// Wrapper to extract orderNumber from URL params
function TankWrapper() {
  const orderNumber = window.location.pathname.split('/tank/')[1]
  return <Tank orderNumber={orderNumber} />
}
