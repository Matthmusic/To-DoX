import ToDoX from './ToDoX.jsx'
import { UpdateNotification } from './components/UpdateNotification'
import { TitleBar } from './components/TitleBar'

function App() {
  return (
    <>
      <TitleBar />
      <div className="pt-8">
        <ToDoX />
      </div>
      <UpdateNotification />
    </>
  )
}

export default App
