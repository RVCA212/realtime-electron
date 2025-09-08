import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";

function WeatherDisplay({ weatherData, actualWeatherData }) {
  console.log("🌤️ WeatherDisplay - Rendering weather data:", { weatherData, actualWeatherData });
  
  // Use actual weather data if available, otherwise fall back to function call arguments
  let displayData;
  if (actualWeatherData) {
    displayData = actualWeatherData;
  } else {
    try {
      displayData = JSON.parse(weatherData.arguments);
    } catch (error) {
      console.error("🌤️ WeatherDisplay - Error parsing weather arguments:", error);
      return <div className="text-red-500">Error displaying weather data</div>;
    }
  }
  
  const { city, temperature, condition, humidity, description } = displayData;

  const getWeatherIcon = (condition) => {
    switch (condition.toLowerCase()) {
      case "sunny":
        return "☀️";
      case "cloudy":
        return "☁️";
      case "rainy":
        return "🌧️";
      case "partly cloudy":
        return "⛅";
      case "windy":
        return "💨";
      default:
        return "🌤️";
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-3xl">{getWeatherIcon(condition)}</span>
          <div>
            <h3 className="text-lg font-bold text-blue-900">{city}</h3>
            <p className="text-blue-700 capitalize">{condition}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="bg-white rounded p-2">
            <span className="font-semibold">Temperature:</span>
            <p className="text-lg font-bold text-blue-600">{temperature}°C</p>
          </div>
          <div className="bg-white rounded p-2">
            <span className="font-semibold">Humidity:</span>
            <p className="text-lg font-bold text-blue-600">{humidity}%</p>
          </div>
        </div>
        <p className="mt-3 text-blue-800 italic">{description}</p>
      </div>
      <pre className="text-xs bg-gray-100 rounded-md p-2 overflow-x-auto">
        {JSON.stringify(weatherData, null, 2)}
      </pre>
    </div>
  );
}

export default function WeatherPanel({
  isSessionActive,
  sendClientEvent,
  events,
}) {
  const [weatherData, setWeatherData] = useState(null);
  const [actualWeatherData, setActualWeatherData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const { apiCall } = useAuth();

  // Function to fetch weather data and send response back to AI
  const handleWeatherToolCall = async (functionCall) => {
    console.log("🌤️ WeatherPanel - Handling weather tool call:", functionCall);
    setIsLoading(true);
    
    try {
      const { city } = JSON.parse(functionCall.arguments);
      console.log(`🌤️ WeatherPanel - Fetching weather for: ${city}`);
      
      // Fetch weather data from our API
      const response = await apiCall(`/weather?city=${encodeURIComponent(city)}`);
      if (response.ok) {
        const weatherData = await response.json();
        console.log("🌤️ WeatherPanel - Received weather data:", weatherData);
        setActualWeatherData(weatherData);
        
        // Send the weather data back to the AI
        const weatherResult = {
          type: "conversation.item.create",
          item: {
            type: "function_call_output",
            call_id: functionCall.call_id,
            output: JSON.stringify({
              city: weatherData.city,
              temperature: weatherData.temperature,
              condition: weatherData.condition,
              humidity: weatherData.humidity,
              description: weatherData.description
            })
          }
        };
        
        console.log("🌤️ WeatherPanel - Sending weather result to AI:", weatherResult);
        sendClientEvent(weatherResult);
        
        // Request a new response from AI
        setTimeout(() => {
          sendClientEvent({ type: "response.create" });
        }, 100);
        
      } else {
        console.error("🌤️ WeatherPanel - Weather API error:", response.status);
        // Send error back to AI
        sendClientEvent({
          type: "conversation.item.create",
          item: {
            type: "function_call_output",
            call_id: functionCall.call_id,
            output: JSON.stringify({ error: `Failed to get weather for ${city}` })
          }
        });
      }
    } catch (error) {
      console.error("🌤️ WeatherPanel - Error handling weather tool call:", error);
      sendClientEvent({
        type: "conversation.item.create",
        item: {
          type: "function_call_output",
          call_id: functionCall.call_id,
          output: JSON.stringify({ error: "Weather service unavailable" })
        }
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!events || events.length === 0) return;
    
    console.log("🌤️ WeatherPanel - Processing events:", events.length);

    // Check all recent events for function calls
    events.forEach((event, index) => {
      console.log(`🌤️ WeatherPanel - Event ${index}:`, event.type, event);
      
      // Look for function calls in various event types
      if (event.type === "response.function_call_arguments.done" && event.name === "get_weather") {
        console.log("🌤️ WeatherPanel - Found weather function call arguments done:", event);
        // This indicates the function arguments are complete
      }
      
      if (event.type === "response.output_item.done" && event.item?.type === "function_call" && event.item?.name === "get_weather") {
        console.log("🌤️ WeatherPanel - Found complete weather function call:", event.item);
        setWeatherData(event.item);
        handleWeatherToolCall(event.item);
      }
    });

    // Also check for completed responses with function calls (legacy support)
    const mostRecentEvent = events[0];
    if (
      mostRecentEvent.type === "response.done" &&
      mostRecentEvent.response.output
    ) {
      mostRecentEvent.response.output.forEach((output) => {
        if (
          output.type === "function_call" &&
          output.name === "get_weather"
        ) {
          console.log("🌤️ WeatherPanel - Found weather function call in response.done:", output);
          setWeatherData(output);
          handleWeatherToolCall(output);
        }
      });
    }
  }, [events, sendClientEvent, apiCall]);

  useEffect(() => {
    if (!isSessionActive) {
      setWeatherData(null);
      setActualWeatherData(null);
    }
  }, [isSessionActive]);

  return (
    <section className="h-full w-full flex flex-col gap-4">
      <div className="h-full bg-gray-50 rounded-md p-4">
        <div className="flex items-center gap-2 mb-2">
          <h2 className="text-lg font-bold">Weather Tool</h2>
          {isLoading && (
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
          )}
        </div>
        {isSessionActive
          ? (
            weatherData || actualWeatherData
              ? <WeatherDisplay weatherData={weatherData} actualWeatherData={actualWeatherData} />
              : isLoading
                ? <p className="text-blue-600">Fetching weather data...</p>
                : <p>Ask about the weather in any city...</p>
          )
          : <p>Start the session to use this tool...</p>}
      </div>
    </section>
  );
}