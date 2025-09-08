import { useState, useEffect } from "react";
import { Settings, Save, RotateCcw } from "react-feather";
import Button from "./Button";
import { useAuth } from "../contexts/AuthContext";

const defaultPrompt = `You are Jenni, an english speaking helpful, friendly AI assistant on the user's mac.
You should: - Be conversational and natural in your responses
- Keep responses concise but informative
- Show enthusiasm when appropriate
- Ask follow-up questions to better understand user needs
IMPORTANT: always speak in english NO MATTER WHAT:`;

export default function SystemPromptPanel({ isSessionActive, onPromptChange }) {
  const [systemPrompt, setSystemPrompt] = useState(defaultPrompt);
  const [isEditing, setIsEditing] = useState(false);
  const [tempPrompt, setTempPrompt] = useState(defaultPrompt);
  const [isLoading, setIsLoading] = useState(false);
  const { apiCall } = useAuth();

  // Load system prompt from server when component mounts
  useEffect(() => {
    loadSystemPrompt();
  }, []);

  const loadSystemPrompt = async () => {
    try {
      setIsLoading(true);
      const response = await apiCall("/system-prompt");
      if (response.ok) {
        const data = await response.json();
        setSystemPrompt(data.prompt);
        setTempPrompt(data.prompt);
      }
    } catch (error) {
      console.error("Failed to load system prompt:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSystemPrompt = async () => {
    try {
      setIsLoading(true);
      const response = await apiCall("/system-prompt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt: tempPrompt }),
      });

      if (response.ok) {
        setSystemPrompt(tempPrompt);
        setIsEditing(false);
        // Notify parent component about the prompt change
        if (onPromptChange) {
          onPromptChange(tempPrompt);
        }
      } else {
        console.error("Failed to save system prompt");
      }
    } catch (error) {
      console.error("Error saving system prompt:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const resetToDefault = () => {
    setTempPrompt(defaultPrompt);
  };

  const cancelEdit = () => {
    setTempPrompt(systemPrompt);
    setIsEditing(false);
  };

  return (
    <section className="bg-gray-50 rounded-md p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-md font-semibold flex items-center gap-2">
          <Settings size={16} />
          System Prompt
        </h3>
        {!isEditing && (
          <Button
            onClick={() => setIsEditing(true)}
            className="bg-blue-600 text-xs py-2 px-3"
            disabled={isLoading}
          >
            Edit
          </Button>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-3">
          <textarea
            value={tempPrompt}
            onChange={(e) => setTempPrompt(e.target.value)}
            className="w-full h-32 p-3 border border-gray-300 rounded-md resize-none text-sm"
            placeholder="Enter your system prompt..."
            disabled={isLoading}
          />
          <div className="flex gap-2 justify-end">
            <Button
              onClick={resetToDefault}
              className="bg-gray-500 text-xs py-2 px-3"
              icon={<RotateCcw size={12} />}
              disabled={isLoading}
            >
              Reset
            </Button>
            <Button
              onClick={cancelEdit}
              className="bg-gray-600 text-xs py-2 px-3"
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={saveSystemPrompt}
              className="bg-green-600 text-xs py-2 px-3"
              icon={<Save size={12} />}
              disabled={isLoading || !tempPrompt.trim()}
            >
              {isLoading ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="text-sm text-gray-700">
          <div className="bg-white p-3 rounded border max-h-24 overflow-y-auto">
            {systemPrompt}
          </div>
          {isSessionActive && (
            <p className="text-xs text-amber-600 mt-2">
              ⚠️ Changes will apply to new sessions
            </p>
          )}
        </div>
      )}
    </section>
  );
}