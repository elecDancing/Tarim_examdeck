import React, { useState } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SearchTextInput } from "../components/SearchTextInput";

function SearchFixture() {
  const [query, setQuery] = useState("");
  return (
    <div className="search-panel">
      <SearchTextInput value={query} onChange={setQuery} placeholder="搜索" />
      <output data-testid="query">{query}</output>
      <button type="button" onClick={() => setQuery("")}>clear</button>
    </div>
  );
}

describe("SearchTextInput", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(<SearchFixture />));
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.innerHTML = "";
  });

  it("即使 Android 输入法一直处于组词状态也立即提交搜索", () => {
    const input = container.querySelector<HTMLInputElement>("input")!;
    const output = container.querySelector<HTMLOutputElement>("output")!;

    act(() => input.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true })));
    input.value = "安全";
    act(() => input.dispatchEvent(new InputEvent("input", { bubbles: true, data: "安全", isComposing: true, inputType: "insertCompositionText" })));
    expect(output.textContent).toBe("安全");
  });

  it("在输入法没有派发 input 事件时仍能从原生输入框同步文字", async () => {
    const input = container.querySelector<HTMLInputElement>("input")!;
    const output = container.querySelector<HTMLOutputElement>("output")!;

    act(() => input.focus());
    input.value = "压力";
    await act(async () => { await new Promise((resolve) => requestAnimationFrame(resolve)); });
    expect(output.textContent).toBe("压力");
  });

  it("立即提交英文、粘贴和删除产生的原生 input 事件", () => {
    const input = container.querySelector<HTMLInputElement>("input")!;
    const output = container.querySelector<HTMLOutputElement>("output")!;

    input.value = "PLC";
    act(() => input.dispatchEvent(new InputEvent("input", { bubbles: true, data: "PLC", inputType: "insertText" })));
    expect(output.textContent).toBe("PLC");

    input.value = "PL";
    act(() => input.dispatchEvent(new InputEvent("input", { bubbles: true, data: null, inputType: "deleteContentBackward" })));
    expect(output.textContent).toBe("PL");
  });

  it("在外部清空搜索状态时同步清空原生输入框", () => {
    const input = container.querySelector<HTMLInputElement>("input")!;
    const clearButton = container.querySelector<HTMLButtonElement>("button")!;

    input.value = "压力";
    act(() => input.dispatchEvent(new InputEvent("input", { bubbles: true, data: "压力", inputType: "insertText" })));
    expect(input.value).toBe("压力");

    act(() => clearButton.click());
    expect(input.value).toBe("");
  });
});
