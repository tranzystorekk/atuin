import React from "react";
import { createReactBlockSpec } from "@blocknote/react";
import "./index.css";

import CodeMirror from "@uiw/react-codemirror";
import { keymap } from "@codemirror/view";
import { langs } from "@uiw/codemirror-extensions-langs";

import { Play, Square } from "lucide-react";
import { useState } from "react";

import { extensions } from "./extensions";
import { invoke } from "@tauri-apps/api/core";
import Terminal from "./terminal.tsx";

import "@xterm/xterm/css/xterm.css";
import { AtuinState, useStore } from "@/state/store.ts";

interface RunBlockProps {
  onChange: (val: string) => void;
  onRun?: (pty: string) => void;
  onStop?: (pty: string) => void;
  id: string;
  code: string;
  type: string;
  pty: string;
  isEditable: boolean;
}

const RunBlock = ({
  onChange,
  id,
  code,
  isEditable,
  onRun,
  onStop,
  pty,
}: RunBlockProps) => {
  const [value, setValue] = useState<String>(code);
  const cleanupPtyTerm = useStore((store: AtuinState) => store.cleanupPtyTerm);
  const terminals = useStore((store: AtuinState) => store.terminals);

  const [currentRunbook, incRunbookPty, decRunbookPty] = useStore(
    (store: AtuinState) => [
      store.currentRunbook,
      store.incRunbookPty,
      store.decRunbookPty,
    ],
  );

  const isRunning = pty !== null;

  const handleToggle = async (event: any | null) => {
    if (event) event.stopPropagation();

    // If there's no code, don't do anything
    if (!value) return;

    if (isRunning) {
      await invoke("pty_kill", { pid: pty });

      terminals[pty].terminal.dispose();
      cleanupPtyTerm(pty);

      if (onStop) onStop(pty);
      decRunbookPty(currentRunbook);
    }

    if (!isRunning) {
      let pty = await invoke<string>("pty_open");
      if (onRun) onRun(pty);

      incRunbookPty(currentRunbook);

      let val = !value.endsWith("\n") ? value + "\r\n" : value;
      await invoke("pty_write", { pid: pty, data: val });
    }
  };

  const handleCmdEnter = (view) => {
    handleToggle(null);
    return true;
  };

  const customKeymap = keymap.of([
    {
      key: "Mod-Enter",
      run: handleCmdEnter,
    },
  ]);

  return (
    <div className="w-full !max-w-full !outline-none overflow-none">
      <div className="flex flex-row items-start">
        <div className="flex">
          <button
            onClick={handleToggle}
            className={`flex items-center justify-center flex-shrink-0 w-8 h-8 mr-2 rounded border focus:outline-none focus:ring-2 transition-all duration-300 ease-in-out ${
              isRunning
                ? "border-red-200 bg-red-50 text-red-600 hover:bg-red-100 hover:border-red-300 focus:ring-red-300"
                : "border-green-200 bg-green-50 text-green-600 hover:bg-green-100 hover:border-green-300 focus:ring-green-300"
            }`}
            aria-label={isRunning ? "Stop code" : "Run code"}
          >
            <span
              className={`inline-block transition-transform duration-300 ease-in-out ${isRunning ? "rotate-180" : ""}`}
            >
              {isRunning ? <Square size={16} /> : <Play size={16} />}
            </span>
          </button>
        </div>
        <div className="flex-1 min-w-0 w-40">
          <CodeMirror
            id={id}
            placeholder={"Write your code here..."}
            className="!pt-0 max-w-full border border-gray-300 rounded"
            value={code}
            editable={isEditable}
            autoFocus
            onChange={(val) => {
              setValue(val);
              onChange(val);
            }}
            extensions={[customKeymap, ...extensions(), langs.shell()]}
            basicSetup={false}
          />
          <div
            className={`overflow-hidden transition-all duration-300 ease-in-out min-w-0 ${
              isRunning ? "block" : "hidden"
            }`}
          >
            {pty && <Terminal pty={pty} />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default createReactBlockSpec(
  {
    type: "run",
    propSchema: {
      type: {
        default: "bash",
      },
      code: { default: "" },
      pty: { default: null },
    },
    content: "none",
  },
  {
    // @ts-ignore
    render: ({ block, editor, code, type }) => {
      const onInputChange = (val: string) => {
        editor.updateBlock(block, {
          props: { ...block.props, code: val },
        });
      };

      const onRun = (pty: string) => {
        editor.updateBlock(block, {
          props: { ...block.props, pty: pty },
        });
      };

      const onStop = (pty: string) => {
        editor.updateBlock(block, {
          props: { ...block.props, pty: null },
        });
      };

      return (
        <RunBlock
          onChange={onInputChange}
          id={block?.id}
          code={block.props.code}
          type={block.props.type}
          pty={block.props.pty}
          isEditable={editor.isEditable}
          onRun={onRun}
          onStop={onStop}
        />
      );
    },
    toExternalHTML: ({ block }) => {
      return (
        <pre lang="beep boop">
          <code lang="bash">{block?.props?.code}</code>
        </pre>
      );
    },
  },
);
