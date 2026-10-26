import ReactDOM from 'react-dom/client'
import CloudWorkspace from './components/CloudWorkspace'
import PwaStatus from './components/PwaStatus'
import './style.css'
ReactDOM.createRoot(document.getElementById('root')!).render(
  <>
    <CloudWorkspace />
    <PwaStatus />
  </>,
)
