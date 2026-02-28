import "./index.css";
import { Sidebar } from "./components/Sidebar";
import { ChatCanvas } from "./components/ChatCanvas";
import { useChat } from "./hooks/useChat";

function App() {
  const {
    sessions,
    activeSessionId,
    messages,
    isStreaming,
    sendMessage,
    newSession,
    selectSession,
  } = useChat();

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ backgroundColor: "var(--cc-bg-base)" }}
    >
      <Sidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelect={selectSession}
        onNew={newSession}
      />
      <ChatCanvas
        messages={messages}
        isStreaming={isStreaming}
        onSend={sendMessage}
      />
    </div>
  );
}

export default App;
