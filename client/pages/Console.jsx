import EventLog from "../components/EventLog";
import SessionControls from "../components/SessionControls";
import DraggableHeader from "../components/DraggableHeader";

export default function Console({
  isSessionActive,
  events,
  startSession,
  stopSession,
  sendClientEvent,
  sendTextMessage,
  updateSessionInstructions,
  currentSystemPrompt,
  currentVoice
}) {
  return (
    <>
      <DraggableHeader />
      <main className="absolute top-16 left-0 right-0 bottom-0">
        <section className="absolute top-0 left-0 right-0 bottom-0 flex">
          <section className="absolute top-0 left-0 right-0 bottom-32 px-4 overflow-y-auto">
            <EventLog events={events} />
          </section>
          <section className="absolute h-32 left-0 right-0 bottom-0 p-4">
            <SessionControls
              startSession={(customPrompt, customVoice) => startSession(customPrompt || currentSystemPrompt, customVoice || currentVoice)}
              stopSession={stopSession}
              sendClientEvent={sendClientEvent}
              sendTextMessage={sendTextMessage}
              updateSessionInstructions={updateSessionInstructions}
              currentSystemPrompt={currentSystemPrompt}
              currentVoice={currentVoice}
              events={events}
              isSessionActive={isSessionActive}
            />
          </section>
        </section>
      </main>
    </>
  );
}
