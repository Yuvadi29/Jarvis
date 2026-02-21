import React, { useState, useCallback, useEffect } from "react";
import { Box, Text, useInput, useApp } from "ink";
import Spinner from "ink-spinner";
import { runQuery } from "../graph/runner.js";
import type { GraphState } from "../graph/state.js";

type AppState = "welcome" | "running" | "done" | "error";

// ─── Inline text input (works across ink v4) ──────────────────────────────────
function QueryInput({
  onSubmit,
  placeholder = "Ask anything...",
  disabled = false,
}: {
  onSubmit: (val: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [value, setValue] = useState("");
  const { exit } = useApp();

  useInput(
    (input, key) => {
      if (key.ctrl && input === "c") exit();
      if (key.return) {
        if (value.trim()) {
          onSubmit(value.trim());
          setValue("");
        }
        return;
      }
      if (key.backspace || key.delete) {
        setValue((v) => v.slice(0, -1));
        return;
      }
      if (!key.ctrl && !key.meta && !key.escape && input) {
        setValue((v) => v + input);
      }
    },
    { isActive: !disabled }
  );

  return (
    <Box>
      <Text color="cyan" bold>
        ❯{" "}
      </Text>
      {value ? (
        <Text>{value}</Text>
      ) : (
        <Text color="gray">{placeholder}</Text>
      )}
      {!disabled && <Text color="cyan">▌</Text>}
    </Box>
  );
}

// ─── Results renderer ─────────────────────────────────────────────────────────
function Results({ state }: { state: GraphState }) {
  return (
    <Box flexDirection="column" marginTop={1}>
      {/* Final synthesized answer */}
      {state.finalAnswer && (
        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor="greenBright"
          paddingX={1}
          paddingY={0}
          marginBottom={1}
        >
          <Text bold color="greenBright">
            ✦ Answer
          </Text>
          <Text>{state.finalAnswer}</Text>
        </Box>
      )}

      {/* Notes */}
      {state.results.notes && state.results.notes.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold color="blueBright">
            📝 From Obsidian:
          </Text>
          {state.results.notes.map((note, i) => (
            <Box key={i} flexDirection="column" marginLeft={2} marginTop={1}>
              <Text bold color="cyan">
                {note.name}
              </Text>
              <Text color="gray">
                {note.excerpt.slice(0, 220).trim()}…
              </Text>
            </Box>
          ))}
        </Box>
      )}

      {/* Web search */}
      {state.results.search && state.results.search.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold color="blueBright">
            🔍 Web results:
          </Text>
          {state.results.search.map((r, i) => (
            <Box key={i} flexDirection="column" marginLeft={2} marginTop={1}>
              <Text bold>{r.title}</Text>
              <Text color="gray" dimColor>
                {r.url}
              </Text>
            </Box>
          ))}
        </Box>
      )}

      {/* Media */}
      {state.results.media && state.results.media.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold color="blueBright">
            🎬 Media:
          </Text>
          {state.results.media.map((m, i) => (
            <Box key={i} flexDirection="column" marginLeft={2} marginTop={1}>
              <Text color="magenta">
                {m.type === "video" ? "▶ " : "🖼  "}
                {m.title}
                {m.channel ? ` — ${m.channel}` : ""}
              </Text>
              <Text color="gray" dimColor>
                {m.url}
              </Text>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export function App() {
  const [appState, setAppState] = useState<AppState>("welcome");
  const [traceSteps, setTraceSteps] = useState<string[]>([]);
  const [finalState, setFinalState] = useState<GraphState | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [currentQuery, setCurrentQuery] = useState("");
  const { exit } = useApp();

  useInput((input, key) => {
    if (key.ctrl && input === "c") exit();
    if (appState === "done" || appState === "error") {
      if (input === "q") exit();
    }
  });

  const handleSubmit = useCallback(async (query: string) => {
    setCurrentQuery(query);
    setAppState("running");
    setTraceSteps([]);
    setFinalState(null);

    try {
      const result = await runQuery(query, (step) => {
        setTraceSteps((prev) => [...prev, step]);
      });
      setFinalState(result);
      setAppState("done");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setAppState("error");
    }
  }, []);

  return (
    <Box flexDirection="column" paddingX={1} paddingY={0}>
      {/* Header */}
      <Box marginBottom={1} marginTop={1}>
        <Text bold color="cyan">🧠 Jarvis</Text>
        <Text color="gray"> · LangGraph + GPT-4o · </Text>
        <Text dimColor color="gray">q to quit</Text>
      </Box>

      {/* Input */}
      {(appState === "welcome" || appState === "done" || appState === "error") && (
        <QueryInput
          onSubmit={handleSubmit}
          placeholder={
            appState === "welcome"
              ? "What do you want to know?"
              : "Ask another question..."
          }
          disabled={appState === "running"}
        />
      )}

      {/* Running */}
      {appState === "running" && (
        <Box flexDirection="column">
          <Box>
            <Text color="yellow">
              <Spinner type="dots" />
            </Text>
            <Text color="yellow"> {currentQuery}</Text>
          </Box>
          <Box flexDirection="column" marginTop={1} marginLeft={2}>
            {traceSteps.map((step, i) => (
              <Text key={i} color="gray">
                {step}
              </Text>
            ))}
          </Box>
        </Box>
      )}

      {/* Trace steps (collapsed after done) */}
      {appState === "done" && traceSteps.length > 0 && (
        <Box flexDirection="column" marginTop={1} marginLeft={2}>
          {traceSteps.map((step, i) => (
            <Text key={i} dimColor color="gray">
              {step}
            </Text>
          ))}
        </Box>
      )}

      {/* Results */}
      {appState === "done" && finalState && <Results state={finalState} />}

      {/* Error */}
      {appState === "error" && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="red">✖ {errorMsg}</Text>
        </Box>
      )}
    </Box>
  );
}