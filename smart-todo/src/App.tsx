import SmartTodo from './SmartTodo.jsx'
import { UpdateNotification } from './components/UpdateNotification'
import { TitleBar } from './components/TitleBar'

function App() {
  return (
    <>
      <TitleBar />
      <SmartTodo />
      <UpdateNotification />
    </>
  )
}

export default App
