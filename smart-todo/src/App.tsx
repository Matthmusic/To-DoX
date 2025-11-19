import SmartTodo from './SmartTodo.jsx'
import { UpdateNotification } from './components/UpdateNotification'
import { TitleBar } from './components/TitleBar'

function App() {
  return (
    <>
      <TitleBar />
      <div className="pt-8">
        <SmartTodo />
      </div>
      <UpdateNotification />
    </>
  )
}

export default App
