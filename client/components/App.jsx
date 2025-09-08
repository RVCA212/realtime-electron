import { useEffect, useRef, useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import AuthForm from "./AuthForm";
import Console from "../pages/Console";
import Settings from "../pages/Settings";
import { AuthProvider, useAuth } from "../contexts/AuthContext";

function RealtimeConsole() {
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [events, setEvents] = useState([]);
  const [dataChannel, setDataChannel] = useState(null);
  const [currentSystemPrompt, setCurrentSystemPrompt] = useState(null);
  const [currentVoice, setCurrentVoice] = useState(null);
  const [savedSystemPrompt, setSavedSystemPrompt] = useState(null);
  const [savedVoice, setSavedVoice] = useState(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const peerConnection = useRef(null);
  const audioElement = useRef(null);
  const { apiCall } = useAuth();

  // Load user settings from backend
  async function loadUserSettings() {
    if (settingsLoaded) return; // Don't reload if already loaded

    try {
      const [promptResponse, voiceResponse] = await Promise.all([
        apiCall("/system-prompt"),
        apiCall("/voice")
      ]);

      if (promptResponse.ok) {
        const promptData = await promptResponse.json();
        setSavedSystemPrompt(promptData.prompt);
      }

      if (voiceResponse.ok) {
        const voiceData = await voiceResponse.json();
        setSavedVoice(voiceData.voice);
      }

      setSettingsLoaded(true);
    } catch (error) {
      console.error("Failed to load user settings:", error);
      setSettingsLoaded(true); // Mark as loaded even on error to prevent infinite retries
    }
  }

  async function startSession(customSystemPrompt = null, customVoice = null) {
    try {
      // Load saved settings if not already loaded
      await loadUserSettings();

      // Use saved settings as defaults, with custom parameters as overrides
      const effectiveSystemPrompt = customSystemPrompt || savedSystemPrompt;
      const effectiveVoice = customVoice || savedVoice;

      // Prepare headers for token request with effective system prompt and voice
      const tokenHeaders = {};
      if (effectiveSystemPrompt) {
        tokenHeaders["x-system-prompt"] = effectiveSystemPrompt;
        setCurrentSystemPrompt(effectiveSystemPrompt);
      }
      if (effectiveVoice) {
        tokenHeaders["x-voice"] = effectiveVoice;
        setCurrentVoice(effectiveVoice);
      }

      // Get a session token for OpenAI Realtime API through our authenticated server
      const tokenResponse = await apiCall("/token", {
        method: "GET",
        headers: tokenHeaders,
      });
      const data = await tokenResponse.json();
      const EPHEMERAL_KEY = data?.value || data?.client_secret?.value;
      if (!EPHEMERAL_KEY || typeof EPHEMERAL_KEY !== "string") {
        throw new Error("Missing ephemeral key from /api/token response");
      }

      // Create a peer connection
      const pc = new RTCPeerConnection();

      // Set up to play remote audio from the model
      audioElement.current = document.createElement("audio");
      audioElement.current.autoplay = true;
      pc.ontrack = (e) => (audioElement.current.srcObject = e.streams[0]);

      // Add local audio track for microphone input in the browser
      const ms = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      pc.addTrack(ms.getTracks()[0]);

      // Set up data channel for sending and receiving events
      const dc = pc.createDataChannel("oai-events");
      setDataChannel(dc);

      // Start the session using the Session Description Protocol (SDP)
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Use our server as proxy for SDP exchange
      // Send user JWT in Authorization (for server auth) and ephemeral key in custom header (for OpenAI)
      const sdpResponse = await apiCall("/session", {
        method: "POST",
        body: offer.sdp,
        headers: {
          "Content-Type": "text/plain",
          "X-OpenAI-Ephemeral-Key": EPHEMERAL_KEY,
        },
      });

      if (!sdpResponse.ok) {
        const errorText = await sdpResponse.text();
        throw new Error(`Server error (${sdpResponse.status}): ${errorText}`);
      }

      const sdp = await sdpResponse.text();
      const answer = { type: "answer", sdp };
      await pc.setRemoteDescription(answer);

      peerConnection.current = pc;
    } catch (error) {
      console.error("Failed to start session:", error);
      alert("Failed to start session. Please try again.");
    }
  }

  // Stop current session, clean up peer connection and data channel
  function stopSession() {
    if (dataChannel) {
      dataChannel.close();
    }

    peerConnection.current.getSenders().forEach((sender) => {
      if (sender.track) {
        sender.track.stop();
      }
    });

    if (peerConnection.current) {
      peerConnection.current.close();
    }

    setIsSessionActive(false);
    setDataChannel(null);
    peerConnection.current = null;
  }

  // Send a message to the model
  function sendClientEvent(message) {
    if (dataChannel) {
      const timestamp = new Date().toLocaleTimeString();
      message.event_id = message.event_id || crypto.randomUUID();

      // send event before setting timestamp since the backend peer doesn't expect this field
      dataChannel.send(JSON.stringify(message));

      // if guard just in case the timestamp exists by miracle
      if (!message.timestamp) {
        message.timestamp = timestamp;
      }
      setEvents((prev) => [message, ...prev]);
    } else {
      console.error(
        "Failed to send message - no data channel available",
        message,
      );
    }
  }

  // Send a text message to the model
  function sendTextMessage(message) {
    const event = {
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [
          {
            type: "input_text",
            text: message,
          },
        ],
      },
    };

    sendClientEvent(event);
    sendClientEvent({ type: "response.create" });
  }

  // Update session instructions during an active session
  function updateSessionInstructions(instructions) {
    if (!dataChannel) {
      console.error("Cannot update instructions - no active session");
      return;
    }

    const sessionUpdate = {
      type: "session.update",
      session: {
        instructions: instructions,
      },
    };

    sendClientEvent(sessionUpdate);
    setCurrentSystemPrompt(instructions);
  }

  // Refresh saved settings when they are updated in Settings page
  function refreshUserSettings() {
    setSettingsLoaded(false);
    setSavedSystemPrompt(null);
    setSavedVoice(null);
  }

  // Attach event listeners to the data channel when a new one is created
  useEffect(() => {
    if (dataChannel) {
      // Append new server events to the list
      dataChannel.addEventListener("message", (e) => {
        const event = JSON.parse(e.data);
        if (!event.timestamp) {
          event.timestamp = new Date().toLocaleTimeString();
        }

        setEvents((prev) => [event, ...prev]);
      });

      // Set session active when the data channel is opened
      dataChannel.addEventListener("open", () => {
        setIsSessionActive(true);
        setEvents([]);
      });
    }
  }, [dataChannel]);

  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={
            <Console
              isSessionActive={isSessionActive}
              events={events}
              startSession={(customPrompt, customVoice) => startSession(customPrompt || currentSystemPrompt, customVoice || currentVoice)}
              stopSession={stopSession}
              sendClientEvent={sendClientEvent}
              sendTextMessage={sendTextMessage}
              updateSessionInstructions={updateSessionInstructions}
              currentSystemPrompt={currentSystemPrompt}
              currentVoice={currentVoice}
            />
          }
        />
        <Route
          path="/settings"
          element={
            <Settings
              isSessionActive={isSessionActive}
              sendClientEvent={sendClientEvent}
              sendTextMessage={sendTextMessage}
              updateSessionInstructions={updateSessionInstructions}
              currentSystemPrompt={currentSystemPrompt}
              currentVoice={currentVoice}
              events={events}
              onVoiceChange={(voice) => {
                // Voice changes only apply to new sessions
                setCurrentVoice(voice);
                refreshUserSettings(); // Refresh cached settings
              }}
              onPromptChange={(prompt) => {
                // Prompt changes update current session if active, otherwise just refresh cache
                if (isSessionActive) {
                  updateSessionInstructions(prompt);
                }
                refreshUserSettings(); // Refresh cached settings
              }}
            />
          }
        />
      </Routes>
    </Router>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

function AppContent() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthForm />;
  }

  return <RealtimeConsole />;
}
