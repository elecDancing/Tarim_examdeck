import React from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import type { AppData } from "../types";

const STORAGE_KEY = "examdeck:v3";

function seedHomeDeck(studyPlanDeckIds = ["deck_fixture"]) {
  const now = new Date("2026-06-28T00:00:00.000Z").toISOString();
  const data: AppData = {
    questions: [
      {
        id: "q_fixture_1",
        uid: "fixture-1",
        type: "判断题",
        stemHtml: "测试题干。",
        stemText: "测试题干。",
        options: [
          { key: "A", html: "对", text: "对" },
          { key: "B", html: "错", text: "错" }
        ],
        answerKeys: ["A"],
        answerText: "A",
        explanationHtml: "",
        tags: [],
        source: "测试",
        rawFront: "",
        rawBack: ""
      }
    ],
    decks: [
      {
        id: "deck_fixture",
        name: "测试题库",
        questionIds: ["q_fixture_1"],
        createdAt: now,
        updatedAt: now
      }
    ],
    stats: {},
    dailyStats: {},
    notes: {},
    favoriteQuestionIds: [],
    slashedQuestionIds: [],
    autoHardQuestionIds: [],
    studyPlanDeckIds,
    sessions: [],
    activeSession: null,
    practices: {},
    dailyReviewSessions: {},
    dailyReviewSession: null,
    dailyMistakeSummary: null,
    dailyReviewCompletion: null,
    seedImported: true
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

describe("app end-to-end smoke", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: false,
      status: 404,
      text: async () => ""
    })));
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
  });

  it("mounts the Mac app shell without crashing", async () => {
    createRoot(container).render(<App />);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(document.body.textContent).toContain("里木刷题王");
    expect(document.body.textContent).toContain("题库首页");
  });

  it("shows normal deck cards only after adding them to the study plan", async () => {
    seedHomeDeck([]);
    createRoot(container).render(<App />);
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(document.querySelector<HTMLElement>(".study-plan-panel")).toBeTruthy();
    expect(document.body.textContent).toContain("加入");
    expect(document.querySelector<HTMLButtonElement>(".deck-card-menu-button")).toBeFalsy();

    const addButton = [...document.querySelectorAll<HTMLButtonElement>(".study-plan-item")]
      .find((button) => button.textContent?.includes("测试题库"));
    expect(addButton).toBeTruthy();

    addButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(document.querySelector<HTMLButtonElement>(".deck-card-menu-button")).toBeTruthy();
    expect(document.body.textContent).toContain("已加入");
    const selectedButton = [...document.querySelectorAll<HTMLButtonElement>(".study-plan-item")]
      .find((button) => button.textContent?.includes("测试题库"));
    expect(selectedButton?.disabled).toBe(true);
  });

  it("opens confirmation dialogs from the home deck card menu actions", async () => {
    seedHomeDeck();
    createRoot(container).render(<App />);
    await new Promise((resolve) => setTimeout(resolve, 50));

    const menuButton = document.querySelector<HTMLButtonElement>(".deck-card-menu-button");
    expect(menuButton).toBeTruthy();

    menuButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(document.body.textContent).toContain("重置该题库进度");
    expect(document.body.textContent).toContain("移除学习计划");
    expect(document.body.textContent).toContain("删除该题库");

    const resetButton = [...document.querySelectorAll<HTMLButtonElement>(".deck-card-menu-popover button")]
      .find((button) => button.textContent?.includes("重置该题库进度"));
    expect(resetButton).toBeTruthy();

    resetButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(document.body.textContent).toContain("重置这个题库的进度？");
    expect(document.body.textContent).toContain("测试题库");
    expect(document.body.textContent).toContain("题目、收藏和笔记会保留");

    const closeButton = document.querySelector<HTMLButtonElement>(".deck-action-dialog button[aria-label='关闭']");
    closeButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    menuButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    const removeButton = [...document.querySelectorAll<HTMLButtonElement>(".deck-card-menu-popover button")]
      .find((button) => button.textContent?.includes("移除学习计划"));
    expect(removeButton).toBeTruthy();

    removeButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(document.body.textContent).toContain("移除学习计划？");
    expect(document.body.textContent).toContain("同时会重置该题库进度");

    const closeRemoveButton = document.querySelector<HTMLButtonElement>(".deck-action-dialog button[aria-label='关闭']");
    closeRemoveButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    menuButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    const deleteButton = [...document.querySelectorAll<HTMLButtonElement>(".deck-card-menu-popover button")]
      .find((button) => button.textContent?.includes("删除该题库"));
    expect(deleteButton).toBeTruthy();

    deleteButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(document.body.textContent).toContain("删除这个题库？");
    expect(document.body.textContent).toContain("只属于这个题库的题目和学习记录也会一并删除");
  });
});
