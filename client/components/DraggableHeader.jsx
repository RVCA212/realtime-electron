import logo from "/assets/openai-logomark.svg";

export default function DraggableHeader() {
  return (
    <nav className="draggable-header absolute top-0 left-0 right-0 h-16 flex items-center">
      <div className="flex items-center gap-4 w-full m-4 pb-2 border-0 border-b border-solid border-gray-200">
        <img style={{ width: "24px" }} src={logo} />
        <h1>OpenAI Realtime Console</h1>
      </div>
    </nav>
  );
}