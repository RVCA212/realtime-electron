import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "react-feather";
import Button from "../components/Button";
import SystemPromptPanel from "../components/SystemPromptPanel";
import VoiceSelector from "../components/VoiceSelector";
import UserInfo from "../components/UserInfo";
import ToolPanel from "../components/ToolPanel";
import WeatherPanel from "../components/WeatherPanel";
import DebugPanel from "../components/DebugPanel";
import DraggableHeader from "../components/DraggableHeader";

export default function Settings({
  isSessionActive,
  sendClientEvent,
  sendTextMessage,
  updateSessionInstructions,
  currentSystemPrompt,
  currentVoice,
  events,
  onVoiceChange,
  onPromptChange
}) {
  const navigate = useNavigate();

  return (
    <>
      <DraggableHeader />
      <main className="absolute top-16 left-0 right-0 bottom-0">
        <div className="h-full flex flex-col">
          {/* Header with back button */}
          <div className="flex items-center gap-4 p-4 border-b border-gray-200">
            <Button
              onClick={() => navigate("/")}
              className="text-gray-600 hover:text-gray-700"
              variant="ghost"
            >
              <ArrowLeft size={16} />
              Back to Console
            </Button>
            <h1 className="text-xl font-semibold">Settings</h1>
          </div>

          {/* Settings content */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="max-w-2xl mx-auto space-y-6">
              <UserInfo />
              <SystemPromptPanel
                isSessionActive={isSessionActive}
                onPromptChange={onPromptChange}
              />
              <VoiceSelector
                isSessionActive={isSessionActive}
                onVoiceChange={onVoiceChange}
              />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ToolPanel
                  sendClientEvent={sendClientEvent}
                  sendTextMessage={sendTextMessage}
                  events={events}
                  isSessionActive={isSessionActive}
                />
                <WeatherPanel
                  sendClientEvent={sendClientEvent}
                  events={events}
                  isSessionActive={isSessionActive}
                />
              </div>
              <DebugPanel
                events={events}
                isSessionActive={isSessionActive}
              />
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
