import { useState, useEffect } from "react";

export default function DebugPanel({ events, isSessionActive }) {
  const [toolCallEvents, setToolCallEvents] = useState([]);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (!events || events.length === 0) return;

    // Filter and track tool-related events
    const toolEvents = events.filter(event => 
      event.type?.includes('function_call') || 
      event.type?.includes('tool') ||
      (event.type === 'response.output_item.done' && event.item?.type === 'function_call') ||
      (event.type === 'response.done' && event.response?.output?.some(o => o.type === 'function_call'))
    );

    if (toolEvents.length > 0) {
      console.log("🔍 DebugPanel - Found tool-related events:", toolEvents);
      setToolCallEvents(prev => {
        // Add new events to the beginning and keep only last 20
        const updated = [...toolEvents, ...prev].slice(0, 20);
        return updated;
      });
    }
  }, [events]);

  useEffect(() => {
    if (!isSessionActive) {
      setToolCallEvents([]);
    }
  }, [isSessionActive]);

  const getEventColor = (eventType) => {
    if (eventType.includes('function_call')) return 'bg-blue-100 text-blue-800';
    if (eventType.includes('tool')) return 'bg-green-100 text-green-800';
    if (eventType.includes('response')) return 'bg-purple-100 text-purple-800';
    return 'bg-gray-100 text-gray-800';
  };

  const formatEventData = (event) => {
    const copy = { ...event };
    delete copy.event_id;
    delete copy.timestamp;
    return JSON.stringify(copy, null, 2);
  };

  return (
    <section className="bg-white border border-gray-200 rounded-lg">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">🔍</span>
            <h3 className="font-semibold text-gray-900">Tool Call Debug Panel</h3>
            {toolCallEvents.length > 0 && (
              <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">
                {toolCallEvents.length} events
              </span>
            )}
          </div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            {isExpanded ? '▼ Collapse' : '▶ Expand'}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="p-4">
          {!isSessionActive ? (
            <p className="text-gray-500 text-sm">Start a session to see tool call debugging info</p>
          ) : toolCallEvents.length === 0 ? (
            <p className="text-gray-500 text-sm">No tool calls detected yet. Try asking for weather or a color palette.</p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {toolCallEvents.map((event, index) => (
                <div key={`${event.event_id}-${index}`} className="border border-gray-200 rounded-md">
                  <div className="p-3 border-b border-gray-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getEventColor(event.type)}`}>
                        {event.type}
                      </span>
                      <span className="text-xs text-gray-500">
                        {event.timestamp || new Date().toLocaleTimeString()}
                      </span>
                    </div>
                    
                    {/* Show function call details if available */}
                    {event.item?.type === 'function_call' && (
                      <div className="bg-gray-50 rounded p-2 text-sm">
                        <div className="font-medium text-gray-700">Function: {event.item.name}</div>
                        {event.item.arguments && (
                          <div className="text-gray-600 mt-1">
                            Args: <code className="bg-white px-1 rounded">{event.item.arguments}</code>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Show response function calls */}
                    {event.response?.output && (
                      <div className="bg-gray-50 rounded p-2 text-sm">
                        {event.response.output.map((output, i) => (
                          output.type === 'function_call' && (
                            <div key={i} className="mb-1">
                              <div className="font-medium text-gray-700">Function: {output.name}</div>
                              <div className="text-gray-600">
                                Args: <code className="bg-white px-1 rounded">{output.arguments}</code>
                              </div>
                            </div>
                          )
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <details className="group">
                    <summary className="p-2 text-xs text-gray-600 cursor-pointer hover:bg-gray-50">
                      Raw Event Data
                    </summary>
                    <div className="p-2 border-t border-gray-100">
                      <pre className="text-xs bg-gray-100 p-2 rounded overflow-x-auto text-gray-700">
                        {formatEventData(event)}
                      </pre>
                    </div>
                  </details>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}