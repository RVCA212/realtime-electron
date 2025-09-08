import { useEffect, useState } from "react";

function FunctionCallOutput({ functionCallOutput }) {
  const { theme, colors } = JSON.parse(functionCallOutput.arguments);

  const colorBoxes = colors.map((color) => (
    <div
      key={color}
      className="w-full h-16 rounded-md flex items-center justify-center border border-gray-200"
      style={{ backgroundColor: color }}
    >
      <p className="text-sm font-bold text-black bg-slate-100 rounded-md p-2 border border-black">
        {color}
      </p>
    </div>
  ));

  return (
    <div className="flex flex-col gap-2">
      <p>Theme: {theme}</p>
      {colorBoxes}
      <pre className="text-xs bg-gray-100 rounded-md p-2 overflow-x-auto">
        {JSON.stringify(functionCallOutput, null, 2)}
      </pre>
    </div>
  );
}

export default function ToolPanel({
  isSessionActive,
  sendClientEvent,
  events,
}) {
  const [functionCallOutput, setFunctionCallOutput] = useState(null);

  useEffect(() => {
    if (!events || events.length === 0) return;

    console.log("🎨 ToolPanel - Processing events:", events.length);

    // Check all recent events for function calls
    events.forEach((event, index) => {
      console.log(`🎨 ToolPanel - Event ${index}:`, event.type, event);

      // Look for color palette function calls in various event types
      if (event.type === "response.output_item.done" && event.item?.type === "function_call" && event.item?.name === "display_color_palette") {
        console.log("🎨 ToolPanel - Found complete color palette function call:", event.item);
        setFunctionCallOutput(event.item);

        setTimeout(() => {
          sendClientEvent({
            type: "response.create",
            response: {
              instructions: `
              ask for feedback about the color palette - don't repeat
              the colors, just ask if they like the colors.
            `,
            },
          });
        }, 500);
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
          output.name === "display_color_palette"
        ) {
          console.log("🎨 ToolPanel - Found color palette function call in response.done:", output);
          setFunctionCallOutput(output);
          setTimeout(() => {
            sendClientEvent({
              type: "response.create",
              response: {
                instructions: `
                ask for feedback about the color palette - don't repeat
                the colors, just ask if they like the colors.
              `,
              },
            });
          }, 500);
        }
      });
    }
  }, [events, sendClientEvent]);

  useEffect(() => {
    if (!isSessionActive) {
      setFunctionCallOutput(null);
    }
  }, [isSessionActive]);

  return (
    <section className="h-full w-full flex flex-col gap-4">
      <div className="h-full bg-gray-50 rounded-md p-4">
        <h2 className="text-lg font-bold">Color Palette Tool</h2>
        {isSessionActive
          ? (
            functionCallOutput
              ? <FunctionCallOutput functionCallOutput={functionCallOutput} />
              : <p>Ask for advice on a color palette...</p>
          )
          : <p>Start the session to use this tool...</p>}
      </div>
    </section>
  );
}
