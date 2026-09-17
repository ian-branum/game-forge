"use client";
import type { SandboxScenario } from "./schema";

export default function SandboxGame({ scenario }: { scenario: SandboxScenario }) {
  return (
    <div style={{ width: "100%", height: "100vh", background: "#05071a" }}>
      <iframe
        srcDoc={scenario.html}
        sandbox="allow-scripts"
        style={{
          width: "100%",
          height: "100%",
          border: "none",
          background: "#05071a",
        }}
        title={scenario.title}
      />
    </div>
  );
}
