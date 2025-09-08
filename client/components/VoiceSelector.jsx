import { useState, useEffect } from "react";
import { Volume2 } from "react-feather";
import { useAuth } from "../contexts/AuthContext";

const voiceOptions = [
  { value: 'cedar', label: 'Cedar', description: 'Warm and friendly' },
  { value: 'alloy', label: 'Alloy', description: 'Clear and professional' },
  { value: 'marin', label: 'Marin', description: 'Smooth and calm' }
];

const defaultVoice = 'cedar';

export default function VoiceSelector({ isSessionActive, onVoiceChange }) {
  const [selectedVoice, setSelectedVoice] = useState(defaultVoice);
  const [isLoading, setIsLoading] = useState(false);
  const { apiCall } = useAuth();

  // Load voice setting from server when component mounts
  useEffect(() => {
    loadVoiceSetting();
  }, []);

  const loadVoiceSetting = async () => {
    try {
      setIsLoading(true);
      const response = await apiCall("/voice");
      if (response.ok) {
        const data = await response.json();
        setSelectedVoice(data.voice);
      }
    } catch (error) {
      console.error("Failed to load voice setting:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVoiceChange = async (newVoice) => {
    if (newVoice === selectedVoice) return;

    try {
      setIsLoading(true);
      const response = await apiCall("/voice", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ voice: newVoice }),
      });

      if (response.ok) {
        setSelectedVoice(newVoice);
        // Notify parent component about the voice change
        if (onVoiceChange) {
          onVoiceChange(newVoice);
        }
      } else {
        console.error("Failed to save voice setting");
      }
    } catch (error) {
      console.error("Error saving voice setting:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getVoiceDescription = (voice) => {
    const option = voiceOptions.find(opt => opt.value === voice);
    return option ? option.description : '';
  };

  return (
    <section className="bg-gray-50 rounded-md p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-md font-semibold flex items-center gap-2">
          <Volume2 size={16} />
          Voice Setting
        </h3>
      </div>

      <div className="space-y-3">
        <select
          value={selectedVoice}
          onChange={(e) => handleVoiceChange(e.target.value)}
          className="w-full p-3 border border-gray-300 rounded-md text-sm bg-white"
          disabled={isLoading}
        >
          {voiceOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label} - {option.description}
            </option>
          ))}
        </select>

        <div className="text-xs text-gray-500">
          {getVoiceDescription(selectedVoice)}
        </div>

        {isSessionActive && (
          <p className="text-xs text-amber-600">
            ⚠️ Changes will apply to new sessions
          </p>
        )}
      </div>
    </section>
  );
}
